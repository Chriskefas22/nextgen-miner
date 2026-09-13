begin;

-- CP03: corrected 10-day rolling-release economic capacity guard.
-- 50% of recognized net revenue funds a 10-day lot; steady-state daily release
-- is 5% of recognized net revenue before the reserve safety multiplier.
-- Guard protects NEW weighted-H/s expansion only. Existing liabilities remain payable.

create or replace function public.nextgen_economic_capacity_snapshot_internal(p_asset text default 'USDT')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  asset_code text := upper(trim(coalesce(p_asset,'USDT')));
  pool public.nextgen_mining_daily_pools%rowtype;
  gh record;
  weighted numeric := 0;
  raw_hash numeric := 0;
  budget numeric := 0;
  reward_per_1000 numeric := 0;
  daily_net_revenue numeric := 0;
  rolling_revenue numeric := 0;
  rolling_release numeric := 0;
  ratio numeric := null;
  capacity_utilization numeric := 100;
  status text := 'CRITICAL';
  expansion_allowed boolean := false;
  reason text := 'No funded mining pool';
  floor_value numeric := 0.05;
  target_value numeric := 0.08;
  healthy_value numeric := 0.12;
  rsm numeric := 1;
  target_capacity numeric := 0;
  floor_capacity numeric := 0;
  healthy_capacity numeric := 0;
  effective_target_ratio numeric := null;
  effective_floor_ratio numeric := null;
  effective_healthy_ratio numeric := null;
  headroom numeric := 0;
  membership_weighted_users numeric := 0;
  outstanding_liability numeric := 0;
begin
  if asset_code is null or asset_code = '' then
    raise exception 'ASSET_REQUIRED';
  end if;

  select * into gh
  from public.nextgen_mining_economic_guardrails
  order by id desc
  limit 1;

  if found then
    floor_value := greatest(coalesce(gh.reward_floor_usd_per_1000_hash_day, floor_value), 0);
    target_value := greatest(coalesce(gh.reward_target_usd_per_1000_hash_day, target_value), 0);
    healthy_value := greatest(coalesce(gh.reward_healthy_usd_per_1000_hash_day, healthy_value), 0);
  end if;

  select * into pool
  from public.nextgen_mining_daily_pools
  where upper(asset)=asset_code
  order by pool_date desc
  limit 1;

  if pool.pool_date is not null then
    budget := greatest(coalesce(pool.mining_budget_usd,0),0);
    daily_net_revenue := greatest(coalesce(pool.net_revenue_usd,0),0);
    rolling_revenue := greatest(coalesce(pool.rolling_10d_net_revenue_usd,0),0);
    rolling_release := greatest(coalesce(pool.rolling_10d_mining_release_usd,0),0);
    rsm := greatest(coalesce(pool.reserve_safety_multiplier,1),0);
  end if;

  select coalesce(sum(o.outstanding_usd),0) into outstanding_liability
  from public.nextgen_mining_liability_open o;
  outstanding_liability := greatest(outstanding_liability,0);

  select
    coalesce(sum(l.hashrate),0),
    coalesce(sum(
      l.hashrate
      * greatest(coalesce(l.efficiency,0),0)
      * least(greatest(coalesce(um.energy_percent,0),0),100)/100.0
      * coalesce((
          select p.mining_factor
          from public.nextgen_memberships mm
          join public.nextgen_membership_plans p on p.id=mm.plan_id
          where mm.user_id=um.user_id
            and mm.status='active'
            and mm.starts_at<=now()
            and mm.expires_at>now()
          order by mm.expires_at desc
          limit 1
        ),1.0)
    ),0),
    count(distinct um.user_id)
  into raw_hash, weighted, membership_weighted_users
  from public.nextgen_user_miners um
  join public.nextgen_miner_levels l
    on l.miner_id=um.miner_id
   and l.level=um.current_level
  where um.status='active';

  if weighted > 0 and budget > 0 then
    reward_per_1000 := (budget/weighted)*1000;
  end if;

  if target_value > 0 then
    target_capacity := case when budget > 0 then (budget/target_value)*1000 else 0 end;
  end if;
  if floor_value > 0 then
    floor_capacity := case when budget > 0 then (budget/floor_value)*1000 else 0 end;
  end if;
  if healthy_value > 0 then
    healthy_capacity := case when budget > 0 then (budget/healthy_value)*1000 else 0 end;
  end if;

  headroom := greatest(target_capacity-weighted,0);
  if rolling_revenue > 0 then
    ratio := weighted/rolling_revenue;
    effective_target_ratio := target_capacity/rolling_revenue;
    effective_floor_ratio := floor_capacity/rolling_revenue;
    effective_healthy_ratio := healthy_capacity/rolling_revenue;
  end if;

  if reward_per_1000 >= healthy_value then
    status := 'HEALTHY';
    expansion_allowed := true;
    reason := 'Capacity has healthy funded headroom';
  elsif reward_per_1000 >= target_value then
    status := 'TARGET';
    expansion_allowed := true;
    reason := 'Capacity is within target funded envelope';
  elsif reward_per_1000 >= floor_value then
    status := 'FLOOR';
    expansion_allowed := false;
    reason := 'Pause new weighted-H/s expansion until funded capacity recovers';
  else
    status := 'CRITICAL';
    expansion_allowed := false;
    reason := case when budget <= 0 then 'No funded mining budget available for new capacity' else 'Mining capacity exceeds the funded reward envelope' end;
  end if;

  capacity_utilization := case
    when target_capacity <= 0 then 100
    else least(greatest((weighted/target_capacity)*100,0),100000)
  end;

  return jsonb_build_object(
    'ok',true,
    'engine','economic_capacity_guard_cp03',
    'asset',asset_code,
    'status',status,
    'expansion_allowed',expansion_allowed,
    'reason',reason,
    'healthy_reward_usd_per_1000',healthy_value,
    'target_reward_usd_per_1000',target_value,
    'floor_reward_usd_per_1000',floor_value,
    'raw_hash',round(raw_hash,4),
    'weighted_hash',round(weighted,4),
    'membership_weighted_users',membership_weighted_users,
    'recognized_net_revenue_usd_day',round(daily_net_revenue,8),
    'rolling_10d_net_revenue_usd',round(rolling_revenue,8),
    'rolling_10d_mining_release_usd',round(rolling_release,8),
    'mining_budget_usd',round(budget,8),
    'reserve_coverage_ratio',coalesce(pool.reserve_coverage_ratio,0),
    'reserve_safety_multiplier',rsm,
    'outstanding_mining_liability_usd',round(outstanding_liability,8),
    'reward_usd_per_1000_weighted_hash',round(reward_per_1000,8),
    'weighted_hash_per_revenue_usd',ratio,
    'capacity_utilization_percent',round(capacity_utilization,4),
    'target_safe_weighted_hash',round(target_capacity,4),
    'floor_safe_weighted_hash',round(floor_capacity,4),
    'healthy_safe_weighted_hash',round(healthy_capacity,4),
    'new_weighted_hash_headroom',round(headroom,4),
    'effective_target_capacity_ratio_hs_per_usd',effective_target_ratio,
    'effective_floor_capacity_ratio_hs_per_usd',effective_floor_ratio,
    'effective_healthy_capacity_ratio_hs_per_usd',effective_healthy_ratio,
    'theoretical_target_capacity_ratio_hs_per_usd',case when target_value>0 then 50/target_value else null end,
    'theoretical_floor_capacity_ratio_hs_per_usd',case when floor_value>0 then 50/floor_value else null end,
    'theoretical_healthy_capacity_ratio_hs_per_usd',case when healthy_value>0 then 50/healthy_value else null end,
    'pool_date',pool.pool_date,
    'prepared_at',pool.prepared_at,
    'economic_rule_version',coalesce(pool.economic_rule_version,'economic_v1_0')
  );
end;
$function$;

create or replace function public.nextgen_assert_economic_capacity_for_expansion(p_asset text, p_additional_weight numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  snapshot jsonb;
  extra numeric := greatest(coalesce(p_additional_weight,0),0);
  current_weight numeric := 0;
  target_capacity numeric := 0;
  projected_weight numeric := 0;
  projected_reward numeric := 0;
  allowed boolean := false;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if upper(trim(coalesce(p_asset,'')))='' then raise exception 'ASSET_REQUIRED'; end if;
  if extra <= 0 then
    return jsonb_build_object('ok',true,'expansion_allowed',true,'additional_weight',0);
  end if;

  snapshot := public.nextgen_economic_capacity_snapshot_internal(p_asset);
  current_weight := coalesce((snapshot->>'weighted_hash')::numeric,0);
  projected_weight := current_weight + extra;
  target_capacity := coalesce((snapshot->>'target_safe_weighted_hash')::numeric,0);
  allowed := coalesce((snapshot->>'expansion_allowed')::boolean,false);

  if projected_weight > 0 and coalesce((snapshot->>'mining_budget_usd')::numeric,0) > 0 then
    projected_reward := ((snapshot->>'mining_budget_usd')::numeric / projected_weight) * 1000;
  end if;

  if not allowed or projected_weight > target_capacity or projected_reward < coalesce((snapshot->>'target_reward_usd_per_1000')::numeric,0) then
    raise exception using
      errcode='P0001',
      message='MINING_CAPACITY_GUARD',
      detail=jsonb_build_object(
        'status',snapshot->>'status',
        'reason',snapshot->>'reason',
        'current_weighted_hash',current_weight,
        'additional_weight',extra,
        'projected_weighted_hash',projected_weight,
        'target_safe_weighted_hash',target_capacity,
        'projected_reward_usd_per_1000',projected_reward,
        'target_reward_usd_per_1000',snapshot->>'target_reward_usd_per_1000'
      )::text;
  end if;

  return jsonb_build_object(
    'ok',true,
    'expansion_allowed',true,
    'additional_weight',extra,
    'projected_weighted_hash',projected_weight,
    'target_safe_weighted_hash',target_capacity,
    'projected_reward_usd_per_1000',projected_reward
  );
end;
$function$;

create or replace function public.nextgen_economic_capacity_snapshot(p_asset text default 'USDT')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.nextgen_is_owner() then
    raise exception 'OWNER_ONLY';
  end if;
  return public.nextgen_economic_capacity_snapshot_internal(p_asset);
end;
$function$;

revoke all on function public.nextgen_economic_capacity_snapshot_internal(text) from public, anon, authenticated;
revoke all on function public.nextgen_economic_capacity_snapshot(text) from public, anon, authenticated;
grant execute on function public.nextgen_economic_capacity_snapshot(text) to authenticated;
revoke all on function public.nextgen_assert_economic_capacity_for_expansion(text,numeric) from public, anon;
grant execute on function public.nextgen_assert_economic_capacity_for_expansion(text,numeric) to authenticated;

commit;
