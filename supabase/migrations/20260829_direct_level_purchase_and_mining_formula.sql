-- NextGen Miner: direct miner level purchase + server-side mining formula.
-- Users may buy any active catalog level when available Credit covers the price.
-- GH/s is the canonical displayed hashrate unit.

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
  if uid is null or not exists (
    select 1 from public.ng_users where id = uid and status = 'active'
  ) then
    raise exception 'account_not_active';
  end if;

  select * into p
  from public.ng_miner_levels
  where family = p_family and level = p_level;

  if not found then raise exception 'miner_not_found'; end if;

  if exists (
    select 1 from public.ng_user_miners
    where user_id = uid and family = p_family and level = p_level and status = 'active'
  ) then
    raise exception 'already_owned';
  end if;

  select * into w from public.ng_wallets where user_id = uid for update;

  if w.credit_balance - w.reserved_credit < p.price_credit then
    raise exception 'insufficient_credit';
  end if;

  update public.ng_wallets
  set credit_balance = credit_balance - p.price_credit, updated_at = now()
  where user_id = uid;

  insert into public.ng_user_miners(user_id, family, level)
  values(uid, p_family, p_level);

  insert into public.ng_transactions(user_id, tx_type, credit_delta, note)
  values(uid, 'miner_purchase', -p.price_credit, initcap(p_family) || ' Miner L' || p_level);

  return jsonb_build_object(
    'ok', true,
    'family', p_family,
    'level', p_level,
    'price_credit', p.price_credit,
    'hash_power_gh', p.hashrate
  );
end;
$$;

revoke all on function public.ng_purchase_miner(text, integer) from public;
grant execute on function public.ng_purchase_miner(text, integer) to authenticated;

-- Effective mining formula. Base output is reduced only when infrastructure is the bottleneck.
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
  hours numeric;
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
  if uid is null then raise exception 'not_authenticated'; end if;

  select coalesce(last_seen_at, created_at)
  into last_ts
  from public.ng_users
  where id = uid;

  hours := least(24, greatest(0, extract(epoch from (now_ts - last_ts)) / 3600));

  select coalesce(sum(l.income_hour_credit), 0)
  into base_hourly
  from public.ng_user_miners um
  join public.ng_miner_levels l
    on l.family = um.family and l.level = um.level
  where um.user_id = uid and um.status = 'active';

  select
    coalesce(max(case when operation_type='resources' then ol.capacity end), 0),
    coalesce(max(case when operation_type='workers' then ol.capacity end), 0),
    coalesce(max(case when operation_type='transport' then ol.capacity end), 0)
  into cap_r, cap_w, cap_t
  from public.ng_user_operations uo
  left join public.ng_operation_levels ol
    on ol.operation_type = uo.operation_type and ol.level = uo.level
  where uo.user_id = uid;

  if base_hourly > 0 then
    resource_factor := least(1, coalesce(cap_r / (base_hourly * 24), 0));
    transport_factor := least(1, coalesce(cap_t / (base_hourly * 24), 0));
  end if;

  if exists(select 1 from public.ng_user_miners where user_id=uid and status='active') then
    worker_factor := least(1, greatest(0, coalesce(cap_w,0) / 10.0));
  end if;

  effective_factor := case
    when base_hourly <= 0 then 0
    else greatest(0, least(resource_factor, worker_factor, transport_factor))
  end;

  reward := round(base_hourly * hours * effective_factor, 6);

  if reward > 0 then
    update public.ng_wallets
    set credit_balance = credit_balance + reward, updated_at = now()
    where user_id = uid;

    insert into public.ng_transactions(user_id, tx_type, credit_delta, note)
    values(uid, 'mining_reward', reward, 'Mining earnings');
  end if;

  update public.ng_users set last_seen_at = now_ts where id = uid;
  return reward;
end;
$$;

revoke all on function public.ng_sync_earnings() from public;
grant execute on function public.ng_sync_earnings() to authenticated;
