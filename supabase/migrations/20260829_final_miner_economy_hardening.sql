-- NextGen Miner — FINAL miner purchase + mining economy hardening
-- Purpose: supersedes the earlier direct-level purchase migration.
-- Canonical hashrate unit: GH/s.
-- Purchase rule: sequential progression per miner family (L1 -> L2 -> ... -> L50).
-- A user may NOT skip levels, even if their Credit balance is sufficient.
-- Earning rule: Miner output is bottlenecked by Resources, Workers and Transport.
-- This migration is safe to re-run (CREATE OR REPLACE / guarded settings update).

begin;

-- ---------------------------------------------------------------------------
-- 1) Final economy constants
-- ---------------------------------------------------------------------------
update public.ng_economy_settings
set min_deposit_usd = 0.01,
    min_withdraw_usd = 1.00,
    updated_at = now()
where id = true;

comment on column public.ng_miner_levels.hashrate is
  'Canonical miner hashrate unit: GH/s. Display as GH/s; do not reinterpret as H/s.';

-- ---------------------------------------------------------------------------
-- 2) FINAL miner purchase rule
--    L1 is the entry level. Every higher level requires the previous level
--    in the same miner family to be active. Balance is checked server-side
--    under a row lock, so the client cannot bypass the rule.
-- ---------------------------------------------------------------------------
create or replace function public.ng_purchase_miner(p_family text, p_level integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.ng_miner_levels%rowtype;
  w public.ng_wallets%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.ng_users
    where id = uid
      and status = 'active'
  ) then
    raise exception 'account_not_active';
  end if;

  if p_family is null or p_level is null or p_level < 1 or p_level > 50 then
    raise exception 'invalid_miner_level';
  end if;

  select *
  into p
  from public.ng_miner_levels
  where family = p_family
    and level = p_level;

  if not found then
    raise exception 'miner_not_found';
  end if;

  if exists (
    select 1
    from public.ng_user_miners
    where user_id = uid
      and family = p_family
      and level = p_level
      and status = 'active'
  ) then
    raise exception 'already_owned';
  end if;

  -- Sequential progression is mandatory for every family.
  if p_level > 1 and not exists (
    select 1
    from public.ng_user_miners
    where user_id = uid
      and family = p_family
      and level = p_level - 1
      and status = 'active'
  ) then
    raise exception 'previous_level_required';
  end if;

  -- Lock wallet before checking/spending available Credit.
  select *
  into w
  from public.ng_wallets
  where user_id = uid
  for update;

  if not found then
    raise exception 'wallet_not_found';
  end if;

  if w.credit_balance - w.reserved_credit < p.price_credit then
    raise exception 'insufficient_credit';
  end if;

  update public.ng_wallets
  set credit_balance = credit_balance - p.price_credit,
      updated_at = now()
  where user_id = uid;

  insert into public.ng_user_miners(user_id, family, level)
  values (uid, p_family, p_level);

  insert into public.ng_transactions(
    user_id,
    tx_type,
    credit_delta,
    note
  )
  values (
    uid,
    'miner_purchase',
    -p.price_credit,
    initcap(p_family) || ' Miner L' || p_level
  );

  return jsonb_build_object(
    'ok', true,
    'family', p_family,
    'level', p_level,
    'price_credit', p.price_credit,
    'hash_power_gh', p.hashrate,
    'hashrate_unit', 'GH/s'
  );
end;
$$;

revoke all on function public.ng_purchase_miner(text, integer) from public;
grant execute on function public.ng_purchase_miner(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) FINAL mining formula
--
-- base_hourly = sum of active miner hourly output.
-- Resources factor  = min(1, resource capacity / base daily output).
-- Workers factor    = min(1, worker capacity / 10) when miners exist.
-- Transport factor  = min(1, transport capacity / base daily output).
-- Effective factor  = minimum of the three infrastructure factors.
-- Reward            = base_hourly * elapsed_hours * effective_factor.
--
-- The lowest infrastructure capacity therefore becomes the bottleneck.
-- Elapsed time is capped at 24h per sync to prevent unbounded catch-up.
-- ---------------------------------------------------------------------------
create or replace function public.ng_sync_earnings()
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_ts timestamptz := now();
  last_ts timestamptz;
  hours numeric := 0;
  base_hourly numeric := 0;
  cap_r numeric := 0;
  cap_w numeric := 0;
  cap_t numeric := 0;
  resource_factor numeric := 1;
  worker_factor numeric := 1;
  transport_factor numeric := 1;
  effective_factor numeric := 0;
  reward numeric := 0;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(last_seen_at, created_at)
  into last_ts
  from public.ng_users
  where id = uid;

  if last_ts is null then
    last_ts := now_ts;
  end if;

  hours := least(
    24,
    greatest(0, extract(epoch from (now_ts - last_ts)) / 3600)
  );

  select coalesce(sum(l.income_hour_credit), 0)
  into base_hourly
  from public.ng_user_miners um
  join public.ng_miner_levels l
    on l.family = um.family
   and l.level = um.level
  where um.user_id = uid
    and um.status = 'active';

  select
    coalesce(max(case when operation_type = 'resources' then ol.capacity end), 0),
    coalesce(max(case when operation_type = 'workers' then ol.capacity end), 0),
    coalesce(max(case when operation_type = 'transport' then ol.capacity end), 0)
  into cap_r, cap_w, cap_t
  from public.ng_user_operations uo
  left join public.ng_operation_levels ol
    on ol.operation_type = uo.operation_type
   and ol.level = uo.level
  where uo.user_id = uid;

  if base_hourly > 0 then
    resource_factor := least(
      1,
      coalesce(cap_r / nullif(base_hourly * 24, 0), 0)
    );

    transport_factor := least(
      1,
      coalesce(cap_t / nullif(base_hourly * 24, 0), 0)
    );
  end if;

  if exists (
    select 1
    from public.ng_user_miners
    where user_id = uid
      and status = 'active'
  ) then
    worker_factor := least(
      1,
      greatest(0, coalesce(cap_w, 0) / 10.0)
    );
  end if;

  effective_factor := case
    when base_hourly <= 0 then 0
    else greatest(
      0,
      least(resource_factor, worker_factor, transport_factor)
    )
  end;

  reward := round(base_hourly * hours * effective_factor, 6);

  if reward > 0 then
    update public.ng_wallets
    set credit_balance = credit_balance + reward,
        updated_at = now_ts
    where user_id = uid;

    insert into public.ng_transactions(
      user_id,
      tx_type,
      credit_delta,
      note
    )
    values (
      uid,
      'mining_reward',
      reward,
      'Mining earnings'
    );
  end if;

  update public.ng_users
  set last_seen_at = now_ts
  where id = uid;

  return reward;
end;
$$;

revoke all on function public.ng_sync_earnings() from public;
grant execute on function public.ng_sync_earnings() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Final withdrawal safety / eligibility
--    - Minimum withdrawal: $1.
--    - User must have at least $1 cumulative APPROVED deposit/top-up before
--      withdrawal is allowed.
--    - Reserved Credit remains protected by the existing wallet constraints.
-- ---------------------------------------------------------------------------
create or replace function public.ng_request_withdrawal(
  p_asset text,
  p_network text,
  p_usd_amount numeric,
  p_destination text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  minv numeric;
  maxv numeric;
  rate numeric;
  credit numeric;
  approved_topup_usd numeric := 0;
  id bigint;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select min_withdraw_usd, max_withdraw_usd, payout_credit_per_usd
  into minv, maxv, rate
  from public.ng_economy_settings
  where id = true;

  if p_usd_amount < minv or p_usd_amount > maxv then
    raise exception 'withdrawal_amount_out_of_range';
  end if;

  select coalesce(sum(usd_amount), 0)
  into approved_topup_usd
  from public.ng_deposits
  where user_id = uid
    and status = 'approved';

  if approved_topup_usd < 1.00 then
    raise exception 'minimum_topup_required';
  end if;

  credit := round(p_usd_amount * rate, 6);

  update public.ng_wallets
  set reserved_credit = reserved_credit + credit,
      updated_at = now()
  where user_id = uid
    and credit_balance - reserved_credit >= credit;

  if not found then
    raise exception 'insufficient_available_credit';
  end if;

  insert into public.ng_withdrawals(
    user_id,
    asset,
    network,
    credit_amount,
    usd_amount,
    destination
  )
  values (
    uid,
    p_asset,
    p_network,
    credit,
    p_usd_amount,
    p_destination
  )
  returning id into id;

  return id;
end;
$$;

revoke all on function public.ng_request_withdrawal(text, text, numeric, text) from public;
grant execute on function public.ng_request_withdrawal(text, text, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Non-destructive catalog integrity checks.
--    These fail the migration if the final catalog is incomplete or the
--    published Hour/Day/Month relationships are inconsistent.
-- ---------------------------------------------------------------------------
do $$
declare
  miner_count bigint;
  op_count bigint;
  bad_hashrate bigint;
  bad_day bigint;
  bad_month bigint;
  bad_level bigint;
begin
  select count(*) into miner_count from public.ng_miner_levels;
  if miner_count <> 250 then
    raise exception 'final_catalog_invalid: expected 250 miner levels, got %', miner_count;
  end if;

  select count(*) into op_count from public.ng_operation_levels;
  if op_count <> 150 then
    raise exception 'final_catalog_invalid: expected 150 operation levels, got %', op_count;
  end if;

  select count(*)
  into bad_level
  from public.ng_miner_levels
  where level < 1 or level > 50 or price_credit < 0 or hashrate < 0;
  if bad_level <> 0 then
    raise exception 'final_catalog_invalid: invalid miner level/price/hashrate rows: %', bad_level;
  end if;

  select count(*)
  into bad_hashrate
  from (
    select family, level, hashrate,
           lag(hashrate) over (partition by family order by level) as prev_hashrate
    from public.ng_miner_levels
  ) q
  where prev_hashrate is not null and hashrate <= prev_hashrate;
  if bad_hashrate <> 0 then
    raise exception 'final_catalog_invalid: hashrate must increase by level: % rows', bad_hashrate;
  end if;

  select count(*)
  into bad_day
  from public.ng_miner_levels
  where abs(income_day_credit - income_hour_credit * 24) > 0.00001;
  if bad_day <> 0 then
    raise exception 'final_catalog_invalid: Hour/Day mismatch: % rows', bad_day;
  end if;

  select count(*)
  into bad_month
  from public.ng_miner_levels
  where abs(income_month_credit - income_hour_credit * 24 * 30) > 0.00001;
  if bad_month <> 0 then
    raise exception 'final_catalog_invalid: Hour/Month mismatch: % rows', bad_month;
  end if;
end;
$$;

commit;

-- End of final migration.
