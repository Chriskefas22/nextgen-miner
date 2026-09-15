-- CP20.2-B — Economic Integrity Patch
-- Scope: only confirmed economic/data-integrity failures found by CP20.2-A.
-- Do not use this migration to activate deferred provider modules.

begin;

-- 1) Align the faucet quest with the live faucet cap.
-- Current faucet: 5 Diamond/claim, 50 Diamond/day => max 10 claims/day.
update public.nextgen_quests
set target_count = 10,
    description = 'Claim the faucet 10 times today to complete this quest.'
where quest_key = 'faucet_20'
  and enabled = true;

-- 2) Disable quests whose activity providers are intentionally NOT LIVE.
-- They can be re-enabled only after their corresponding provider/campaign
-- engine is actually live and verified.
update public.nextgen_quests
set enabled = false
where quest_key in ('offer_5', 'ptc_100', 'shortlink_10');

-- 3) Harden the upgrade RPC so already-merged historical rows cannot be
-- upgraded by direct RPC invocation. The client already hides merged rows;
-- this closes the server-side invariant as well.
create or replace function public.nextgen_upgrade_miner(p_user_miner_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  um public.nextgen_user_miners%rowtype;
  lvl public.nextgen_miner_levels%rowtype;
  w public.nextgen_wallets%rowtype;
  discount_bps integer := 0;
  final_price numeric;
  saved numeric;
  membership_factor numeric := 1.0;
  old_weight numeric := 0;
  next_weight numeric := 0;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into um
  from public.nextgen_user_miners
  where id = p_user_miner_id
    and user_id = uid
  for update;

  if not found then
    raise exception 'MINER_NOT_FOUND';
  end if;

  if um.is_merged or um.status = 'merged' then
    raise exception 'MINER_ALREADY_MERGED';
  end if;

  if um.current_level >= 10 then
    raise exception 'MAX_LEVEL';
  end if;

  select *
  into lvl
  from public.nextgen_miner_levels
  where miner_id = um.miner_id
    and level = um.current_level + 1;

  if not found then
    raise exception 'LEVEL_NOT_CONFIGURED';
  end if;

  select
    coalesce(p.upgrade_discount_bps, 0),
    coalesce(p.mining_factor, 1.0)
  into
    discount_bps,
    membership_factor
  from public.nextgen_memberships m
  join public.nextgen_membership_plans p on p.id = m.plan_id
  where m.user_id = uid
    and m.status = 'active'
    and m.starts_at <= now()
    and m.expires_at > now()
  order by m.expires_at desc
  limit 1;

  final_price := round(
    lvl.upgrade_price_diamond * (10000 - discount_bps) / 10000.0,
    4
  );

  saved := lvl.upgrade_price_diamond - final_price;

  select *
  into w
  from public.nextgen_wallets
  where user_id = uid
  for update;

  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  if w.diamond_balance < final_price then
    raise exception 'INSUFFICIENT_DIAMOND';
  end if;

  old_weight := coalesce(
    (
      select
        ml2.hashrate
        * greatest(ml2.efficiency, 0)
        * least(greatest(um.energy_percent, 0), 100) / 100.0
        * membership_factor
      from public.nextgen_miner_levels ml2
      where ml2.miner_id = um.miner_id
        and ml2.level = um.current_level
    ),
    0
  );

  next_weight :=
      lvl.hashrate
      * greatest(lvl.efficiency, 0)
      * least(greatest(um.energy_percent, 0), 100) / 100.0
      * membership_factor;

  if coalesce(um.reward_class, 'standard') <> 'free_bonus' then
    perform public.nextgen_assert_economic_capacity_for_expansion(
      'USDT',
      greatest(next_weight - old_weight, 0)
    );
  end if;

  update public.nextgen_wallets
  set diamond_balance = diamond_balance - final_price,
      updated_at = now()
  where user_id = uid;

  update public.nextgen_user_miners
  set current_level = lvl.level,
      total_spent_diamond = total_spent_diamond + final_price,
      last_upgrade_at = now()
  where id = um.id;

  insert into public.nextgen_transactions(
    user_id,
    tx_type,
    diamond_delta,
    reference_id,
    note
  )
  values(
    uid,
    'miner_upgrade',
    -final_price,
    p_user_miner_id::text,
    'Miner level upgrade'
  );

  return jsonb_build_object(
    'ok', true,
    'level', lvl.level,
    'hashrate', lvl.hashrate,
    'upgrade_price_diamond', final_price,
    'discount_bps', discount_bps,
    'saved_diamond', saved,
    'reward_class', coalesce(um.reward_class, 'standard')
  );
end;
$function$;

revoke execute on function public.nextgen_upgrade_miner(bigint) from anon, public;
grant execute on function public.nextgen_upgrade_miner(bigint) to authenticated, postgres;

commit;
