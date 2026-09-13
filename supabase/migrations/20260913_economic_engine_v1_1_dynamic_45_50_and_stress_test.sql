begin;

-- NGM Economic Engine v1.1
-- Base mining allocation 45%, maximum 50%, minimum 40%.
-- Reserve absorbs the inverse allocation shift so all recognized net revenue
-- remains allocated at exactly 100%.
-- Revenue lots remain 10 days; pool share is divided by active weighted H/s.

alter table public.nextgen_mining_economy_settings
  add column if not exists max_mining_allocation_bps integer not null default 5000,
  add column if not exists base_mining_allocation_bps integer not null default 4500,
  add column if not exists min_mining_allocation_bps integer not null default 4000;

update public.nextgen_mining_economy_settings
set base_mining_allocation_bps=4500,
    max_mining_allocation_bps=5000,
    min_mining_allocation_bps=4000,
    monetization_to_mining_bps=4500,
    updated_at=now()
where id=(select id from public.nextgen_mining_economy_settings order by updated_at desc nulls last limit 1);

alter table public.nextgen_mining_daily_pools
  add column if not exists mining_allocation_bps integer not null default 4500,
  add column if not exists reserve_allocation_bps integer not null default 3500;

insert into public.nextgen_economic_rule_versions
  (version,status,denomination_diamond_per_usd,mining_bps,reserve_bps,donation_bps,owner_platform_bps,settlement_hours,merge_multiplier,conversion_fee_bps,activated_at)
select 'economic_v1_1','active',10000,4500,3500,1000,1000,24,1.8,100,now()
where not exists(select 1 from public.nextgen_economic_rule_versions where version='economic_v1_1');

update public.nextgen_economic_rule_versions
set status='retired'
where version='economic_v1_0' and status='active';

create or replace function public.nextgen_resolve_mining_allocation_bps(p_prior_reserve_coverage numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  coverage numeric:=coalesce(p_prior_reserve_coverage,1);
  mining_bps integer:=4500;
  reserve_bps integer:=3500;
begin
  if coverage>=1.50 then
    mining_bps:=5000; reserve_bps:=3000;
  elsif coverage>=1.20 then
    mining_bps:=4750; reserve_bps:=3250;
  elsif coverage<1.00 then
    mining_bps:=4000; reserve_bps:=4000;
  end if;
  return jsonb_build_object(
    'mining_bps',mining_bps,
    'reserve_bps',reserve_bps,
    'donation_bps',1000,
    'owner_platform_bps',1000,
    'total_bps',10000,
    'prior_reserve_coverage',coverage
  );
end;
$function$;

-- IMPORTANT:
-- This is the production daily pool preparation function. It now resolves
-- the allocation from the prior reserve coverage and records the actual
-- allocation used on each daily pool row.
create or replace function public.nextgen_prepare_mining_day(p_asset text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  asset_code text:=upper(trim(p_asset));
  day_date date:=timezone('utc',now())::date;
  revenue_date date:=day_date-1;
  day_start timestamptz:=day_date::timestamptz;
  rule public.nextgen_economic_rule_versions%rowtype;
  ps public.nextgen_mining_pool_settings%rowtype;
  existing public.nextgen_mining_daily_pools%rowtype;

  gross_rev numeric:=0;
  net_rev numeric:=0;
  reserve_add numeric:=0;
  mining_base numeric:=0;
  donation_add numeric:=0;
  owner_add numeric:=0;
  reserve_balance numeric:=0;
  liability numeric:=0;
  coverage numeric:=1;
  prior_coverage numeric:=1;
  rsm numeric:=1;

  rolling_gross numeric:=0;
  rolling_net numeric:=0;
  rolling_release numeric:=0;
  mining_budget_total numeric:=0;
  asset_budget numeric:=0;
  total_hash numeric:=0;
  total_weight numeric:=0;
  active_users integer:=0;
  active_miners integer:=0;
  reward_rate numeric:=0;
  rate numeric:=0;
  rate_updated timestamptz;

  deposit_gross numeric:=0;
  deposit_net numeric:=0;
  deposit_fee_bps integer:=100;
  prior_lot_exists boolean:=false;
  allocation jsonb;
begin
  if asset_code is null or asset_code='' then
    raise exception 'ASSET_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtext('nextgen_mining_prepare_global'));

  select * into rule
  from public.nextgen_economic_rule_versions
  where status='active'
  order by activated_at desc nulls last
  limit 1;

  if not found then
    raise exception 'ECONOMIC_RULE_NOT_ACTIVE';
  end if;

  select * into ps
  from public.nextgen_mining_pool_settings
  where upper(asset)=asset_code
    and enabled=true
  for update;

  if not found or ps.pool_share_bps<=0 then
    raise exception 'MINING_ASSET_DISABLED';
  end if;

  if ps.pool_share_bps>10000 then
    raise exception 'INVALID_POOL_SHARE';
  end if;

  select exists(
    select 1
    from public.nextgen_mining_revenue_lots l
    where l.lot_date=revenue_date
      and upper(l.asset)=asset_code
  ) into prior_lot_exists;

  select * into existing
  from public.nextgen_mining_daily_pools
  where pool_date=day_date
    and upper(asset)=asset_code
  for update;

  if found
     and existing.prepared_at is not null
     and existing.economic_rule_version=rule.version
     and prior_lot_exists then
    return jsonb_build_object(
      'prepared',true,
      'already_prepared',true,
      'pool_date',day_date,
      'asset',asset_code,
      'mining_budget_usd',existing.mining_budget_usd,
      'reserve_balance_usd',existing.reserve_balance_usd,
      'reserve_coverage_ratio',existing.reserve_coverage_ratio,
      'reserve_safety_multiplier',existing.reserve_safety_multiplier,
      'rolling_10d_net_revenue_usd',existing.rolling_10d_net_revenue_usd,
      'rolling_10d_mining_release_usd',existing.rolling_10d_mining_release_usd,
      'economic_rule_version',existing.economic_rule_version,
      'mining_allocation_bps',existing.mining_allocation_bps
    );
  elsif found and coalesce(existing.allocated_usd,0)=0 then
    delete from public.nextgen_mining_daily_user_weights
    where pool_date=day_date and asset=asset_code;
    delete from public.nextgen_mining_daily_pools
    where pool_date=day_date and upper(asset)=asset_code;
  elsif found then
    raise exception 'LEGACY_POOL_ALREADY_ALLOCATED';
  end if;

  select coalesce(s.transaction_fee_bps,100)
    into deposit_fee_bps
  from public.nextgen_economy_settings s
  order by s.updated_at desc nulls last
  limit 1;

  deposit_fee_bps:=greatest(least(coalesce(deposit_fee_bps,100),10000),0);

  select coalesce(sum(x.gross_value),0),
         coalesce(sum(x.net_value),0)
    into gross_rev,net_rev
  from (
    select o.revenue_usd gross_value,
           o.revenue_usd*(10000-o.reward_share_bps)/10000.0 net_value
    from public.nextgen_offer_completions oc
    join public.nextgen_offers o on o.id=oc.offer_id
    where oc.status='posted'
      and (oc.created_at at time zone 'utc')::date=revenue_date

    union all

    select c.revenue_usd gross_value,
           c.revenue_usd*(10000-c.reward_share_bps)/10000.0 net_value
    from public.nextgen_ptc_sessions s
    join public.nextgen_ptc_campaigns c on c.id=s.campaign_id
    where s.status='completed'
      and s.completed_at is not null
      and (s.completed_at at time zone 'utc')::date=revenue_date

    union all

    select c.revenue_usd gross_value,
           c.revenue_usd*(10000-c.reward_share_bps)/10000.0 net_value
    from public.nextgen_shortlink_completions sc
    join public.nextgen_shortlink_campaigns c on c.id=sc.campaign_id
    where sc.status='posted'
      and (sc.created_at at time zone 'utc')::date=revenue_date

    union all

    select m.price_usd gross_value,
           m.price_usd net_value
    from public.nextgen_memberships m
    where (m.created_at at time zone 'utc')::date=revenue_date

    union all

    select e.gross_revenue_usd gross_value,
           e.net_revenue_usd net_value
    from public.nextgen_monetization_revenue_events e
    where e.event_date=revenue_date
      and lower(e.status) in ('posted','approved','settled','completed')
  ) x;

  select coalesce(sum(d.usd_amount),0),
         coalesce(sum(d.usd_amount)*deposit_fee_bps/10000.0,0)
    into deposit_gross,deposit_net
  from public.nextgen_deposits d
  where lower(coalesce(d.status,''))='approved'
    and (coalesce(d.settled_at,d.reviewed_at,d.created_at) at time zone 'utc')::date=revenue_date;

  gross_rev:=greatest(gross_rev+deposit_net,0);
  net_rev:=greatest(net_rev+deposit_net,0);

  select coalesce((select balance_usd from public.nextgen_reserve_ledger order by id desc limit 1),0)
    into reserve_balance;

  select coalesce(sum(o.outstanding_usd),0)
    into liability
  from public.nextgen_mining_liability_open o;

  liability:=greatest(liability,0);

  prior_coverage:=case
    when liability<=0 then 1
    else reserve_balance/liability
  end;

  allocation:=public.nextgen_resolve_mining_allocation_bps(prior_coverage);

  rule.mining_bps:=coalesce((allocation->>'mining_bps')::integer,4500);
  rule.reserve_bps:=coalesce((allocation->>'reserve_bps')::integer,3500);
  rule.donation_bps:=1000;
  rule.owner_platform_bps:=1000;

  reserve_add:=round(net_rev*rule.reserve_bps/10000.0,8);
  mining_base:=round(net_rev*rule.mining_bps/10000.0,8);
  donation_add:=round(net_rev*rule.donation_bps/10000.0,8);
  owner_add:=round(net_rev*rule.owner_platform_bps/10000.0,8);

  if not exists(
    select 1
    from public.nextgen_reserve_ledger
    where event_date=day_date
      and source_type='recognized_revenue'
      and source_reference=revenue_date::text
  ) then
    reserve_balance:=reserve_balance+reserve_add;

    insert into public.nextgen_reserve_ledger(
      event_date,source_type,source_reference,recognized_revenue_usd,
      reserve_in_usd,reserve_out_usd,balance_usd,rule_version
    )
    values(
      day_date,'recognized_revenue',revenue_date::text,net_rev,
      reserve_add,0,reserve_balance,rule.version
    );
  end if;

  insert into public.nextgen_mining_revenue_lots(
    lot_date,asset,gross_revenue_usd,net_revenue_usd,mining_allocation_usd,
    lot_days,daily_release_target_usd,start_release_date,end_release_date,
    rule_version
  )
  values(
    revenue_date,asset_code,gross_rev,net_rev,mining_base,
    10,round(mining_base/10.0,8),revenue_date+1,revenue_date+10,
    rule.version
  )
  on conflict(lot_date,asset) do update set
    gross_revenue_usd=excluded.gross_revenue_usd,
    net_revenue_usd=excluded.net_revenue_usd,
    mining_allocation_usd=excluded.mining_allocation_usd,
    lot_days=excluded.lot_days,
    daily_release_target_usd=excluded.daily_release_target_usd,
    start_release_date=excluded.start_release_date,
    end_release_date=excluded.end_release_date,
    rule_version=excluded.rule_version;

  select coalesce(sum(l.gross_revenue_usd),0),
         coalesce(sum(l.net_revenue_usd),0),
         coalesce(sum(l.daily_release_target_usd),0)
    into rolling_gross,rolling_net,rolling_release
  from public.nextgen_mining_revenue_lots l
  where upper(l.asset)=asset_code
    and day_date between l.start_release_date and l.end_release_date;

  if liability<=0 then
    coverage:=1;
    rsm:=1;
  else
    coverage:=reserve_balance/liability;
    rsm:=case
      when coverage>=1.5 then 1.00
      when coverage>=1.2 then 0.85
      else 0.70
    end;
  end if;

  mining_budget_total:=round(rolling_release*rsm,8);
  asset_budget:=round(mining_budget_total*ps.pool_share_bps/10000.0,8);

  select count(*)::integer,
         count(distinct um.user_id)::integer,
         coalesce(sum(l.hashrate),0),
         coalesce(sum(
           l.hashrate
           * greatest(l.efficiency,0)
           * least(greatest(um.energy_percent,0),100)/100.0
           * coalesce((
               select p.mining_factor
               from public.nextgen_memberships mm
               join public.nextgen_membership_plans p on p.id=mm.plan_id
               where mm.user_id=um.user_id
                 and mm.status='active'
                 and mm.starts_at<=day_start
                 and mm.expires_at>day_start
               order by mm.expires_at desc
               limit 1
             ),1.0)
         ),0)
    into active_miners,active_users,total_hash,total_weight
  from public.nextgen_user_miners um
  join public.nextgen_miner_levels l
    on l.miner_id=um.miner_id
   and l.level=um.current_level
  where um.status='active'
    and um.activated_at<=day_start
    and um.recharge_expires_at>day_start;

  insert into public.nextgen_mining_daily_user_weights(
    pool_date,asset,user_id,hashrate,efficiency,energy_percent,
    membership_factor,weighted_hash
  )
  select day_date,
         asset_code,
         um.user_id,
         sum(l.hashrate),
         avg(l.efficiency),
         avg(least(greatest(um.energy_percent,0),100)),
         coalesce((
           select p.mining_factor
           from public.nextgen_memberships mm
           join public.nextgen_membership_plans p on p.id=mm.plan_id
           where mm.user_id=um.user_id
             and mm.status='active'
             and mm.starts_at<=day_start
             and mm.expires_at>day_start
           order by mm.expires_at desc
           limit 1
         ),1.0),
         sum(
           l.hashrate
           * greatest(l.efficiency,0)
           * least(greatest(um.energy_percent,0),100)/100.0
           * coalesce((
               select p.mining_factor
               from public.nextgen_memberships mm
               join public.nextgen_membership_plans p on p.id=mm.plan_id
               where mm.user_id=um.user_id
                 and mm.status='active'
                 and mm.starts_at<=day_start
                 and mm.expires_at>day_start
               order by mm.expires_at desc
               limit 1
             ),1.0)
         )
  from public.nextgen_user_miners um
  join public.nextgen_miner_levels l
    on l.miner_id=um.miner_id
   and l.level=um.current_level
  where um.status='active'
    and um.activated_at<=day_start
    and um.recharge_expires_at>day_start
  group by um.user_id
  on conflict(pool_date,asset,user_id) do update set
    hashrate=excluded.hashrate,
    efficiency=excluded.efficiency,
    energy_percent=excluded.energy_percent,
    membership_factor=excluded.membership_factor,
    weighted_hash=excluded.weighted_hash;

  if total_weight>0 then
    reward_rate:=asset_budget/(86400.0*total_weight);
  end if;

  select rate_usd,updated_at
    into rate,rate_updated
  from public.nextgen_exchange_rates
  where upper(asset)=asset_code
  order by updated_at desc
  limit 1;

  if asset_budget>0
     and (rate is null or rate<=0 or rate_updated<now()-interval '15 minutes') then
    raise exception 'ASSET_RATE_STALE';
  end if;

  rate:=greatest(coalesce(rate,0),0);

  insert into public.nextgen_mining_daily_pools(
    pool_date,asset,gross_revenue_usd,net_revenue_usd,mining_budget_usd,
    rate_usd,active_revenue_users,baseline_total_hashrate,baseline_total_weight,
    reward_rate_usd_per_hash_second,allocated_usd,prepared_at,updated_at,
    reserve_allocation_usd,reserve_balance_usd,outstanding_mining_liability_usd,
    reserve_coverage_ratio,reserve_status,reserve_safety_multiplier,
    economic_rule_version,rolling_10d_gross_revenue_usd,
    rolling_10d_net_revenue_usd,rolling_10d_mining_release_usd,
    mining_lot_days,mining_allocation_bps,reserve_allocation_bps
  )
  values(
    day_date,asset_code,gross_rev,net_rev,asset_budget,
    rate,active_users,total_hash,total_weight,
    reward_rate,0,now(),now(),
    reserve_add,reserve_balance,liability,
    coverage,
    case
      when liability=0 then 'healthy'
      when coverage>=1.5 then 'healthy'
      when coverage>=1.0 then 'guarded'
      else 'critical'
    end,
    rsm,rule.version,rolling_gross,
    rolling_net,rolling_release,
    10,rule.mining_bps,rule.reserve_bps
  );

  return jsonb_build_object(
    'prepared',true,
    'already_prepared',false,
    'pool_date',day_date,
    'revenue_date',revenue_date,
    'asset',asset_code,
    'gross_revenue_usd',gross_rev,
    'net_recognized_revenue_usd',net_rev,
    'mining_allocation_bps',rule.mining_bps,
    'reserve_allocation_bps',rule.reserve_bps,
    'allocation_policy',allocation,
    'allocation_mining_usd',mining_base,
    'allocation_reserve_usd',reserve_add,
    'allocation_donation_usd',donation_add,
    'allocation_owner_platform_usd',owner_add,
    'rolling_10d_net_revenue_usd',rolling_net,
    'rolling_10d_mining_release_usd',rolling_release,
    'reserve_balance_usd',reserve_balance,
    'outstanding_mining_liability_usd',liability,
    'reserve_coverage_ratio',coverage,
    'reserve_safety_multiplier',rsm,
    'mining_budget_usd',asset_budget,
    'baseline_total_hashrate',total_hash,
    'baseline_total_weight',total_weight,
    'reward_rate_usd_per_hash_second',reward_rate,
    'economic_rule_version',rule.version
  );
end;
$function$;

-- Owner-only simulator. It never writes production state.
create or replace function public.nextgen_economic_stress_test(
  p_daily_revenue numeric[],
  p_daily_weighted_hash numeric[],
  p_initial_reserve_usd numeric default 0,
  p_initial_liability_usd numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid:=auth.uid();
  n integer:=coalesce(array_length(p_daily_revenue,1),0);
  i integer;
  j integer;
  revenue numeric;
  weight numeric;
  reserve numeric:=greatest(coalesce(p_initial_reserve_usd,0),0);
  liability numeric:=greatest(coalesce(p_initial_liability_usd,0),0);
  coverage numeric;
  rsm numeric;
  mining_bps integer;
  reserve_bps integer;
  rolling_release numeric:=0;
  release_j numeric;
  budget numeric:=0;
  reward_per_1000 numeric:=0;
  target_capacity numeric:=0;
  floor_capacity numeric:=0;
  healthy_capacity numeric:=0;
  target_reward numeric:=0.08;
  floor_reward numeric:=0.05;
  healthy_reward numeric:=0.12;
  allocs integer[]:='{}';
  rows jsonb:='[]'::jsonb;
  pass boolean:=true;
begin
  if uid is null or not public.nextgen_is_owner() then
    raise exception 'OWNER_ONLY';
  end if;

  if n=0 then
    return jsonb_build_object(
      'ok',true,
      'engine','economic_v1_1_stress_simulator',
      'days',0,
      'rows',rows,
      'summary',jsonb_build_object('pass',true,'reason','NO_INPUT')
    );
  end if;

  if array_length(p_daily_weighted_hash,1)<>n then
    raise exception 'ARRAY_LENGTH_MISMATCH';
  end if;

  for i in 1..n loop
    revenue:=greatest(coalesce(p_daily_revenue[i],0),0);
    weight:=greatest(coalesce(p_daily_weighted_hash[i],0),0);

    coverage:=case when liability<=0 then 1 else reserve/liability end;

    mining_bps:=case
      when coverage>=1.5 then 5000
      when coverage>=1.2 then 4750
      when coverage<1.0 then 4000
      else 4500
    end;

    reserve_bps:=10000-mining_bps-1000-1000;

    allocs:=array_append(allocs,mining_bps);

    reserve:=reserve + revenue*reserve_bps/10000.0;

    coverage:=case when liability<=0 then 1 else reserve/liability end;

    rsm:=case
      when coverage>=1.5 then 1.00
      when coverage>=1.2 then 0.85
      else 0.70
    end;

    rolling_release:=0;

    for j in greatest(i-9,1)..i loop
      release_j:=greatest(coalesce(p_daily_revenue[j],0),0)
        * allocs[j]/10000.0/10.0;
      rolling_release:=rolling_release+release_j;
    end loop;

    budget:=rolling_release*rsm;

    reward_per_1000:=case
      when weight>0 then budget/weight*1000
      else 0
    end;

    target_capacity:=case
      when target_reward>0 then budget/target_reward*1000
      else 0
    end;

    floor_capacity:=case
      when floor_reward>0 then budget/floor_reward*1000
      else 0
    end;

    healthy_capacity:=case
      when healthy_reward>0 then budget/healthy_reward*1000
      else 0
    end;

    if weight>target_capacity then
      pass:=false;
    end if;

    rows:=rows||jsonb_build_array(
      jsonb_build_object(
        'day',i,
        'revenue_usd',revenue,
        'weighted_hash',weight,
        'mining_allocation_bps',mining_bps,
        'reserve_allocation_bps',reserve_bps,
        'rolling_release_usd',rolling_release,
        'rsm',rsm,
        'mining_budget_usd',budget,
        'reward_usd_per_1000',reward_per_1000,
        'target_safe_weighted_hash',target_capacity,
        'floor_safe_weighted_hash',floor_capacity,
        'healthy_safe_weighted_hash',healthy_capacity,
        'expansion_allowed',
          reward_per_1000>=target_reward and weight<=target_capacity
      )
    );
  end loop;

  return jsonb_build_object(
    'ok',true,
    'engine','economic_v1_1_stress_simulator',
    'days',n,
    'rows',rows,
    'summary',jsonb_build_object(
      'pass',pass,
      'note','Simulation only; production state is not changed.'
    )
  );
end;
$function$;

revoke all on function public.nextgen_resolve_mining_allocation_bps(numeric) from public,anon,authenticated;
revoke all on function public.nextgen_economic_stress_test(numeric[],numeric[],numeric,numeric) from public,anon;
grant execute on function public.nextgen_economic_stress_test(numeric[],numeric[],numeric,numeric) to authenticated;

commit;
