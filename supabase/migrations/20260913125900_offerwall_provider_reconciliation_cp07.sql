
-- CP07: Offerwall/provider reconciliation, reversal protection, canonical monetization revenue
-- Applied to production: 2026-09-13

alter table public.nextgen_monetization_revenue_events
  add column if not exists provider_key text,
  add column if not exists recoverable_at timestamptz,
  add column if not exists reversal_of_event_id bigint,
  add column if not exists reconciliation_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='nextgen_monetization_revenue_events_reversal_fk'
  ) then
    alter table public.nextgen_monetization_revenue_events
      add constraint nextgen_monetization_revenue_events_reversal_fk
      foreign key (reversal_of_event_id)
      references public.nextgen_monetization_revenue_events(id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='nextgen_monetization_revenue_events_status_check'
  ) then
    alter table public.nextgen_monetization_revenue_events
      add constraint nextgen_monetization_revenue_events_status_check
      check (lower(status) in ('pending','posted','approved','settled','completed','reversed','invalid'));
  end if;
end $$;

create index if not exists idx_ngm_revenue_events_recoverable_date
  on public.nextgen_monetization_revenue_events(event_date, status, recoverable_at);

create index if not exists idx_ngm_revenue_events_provider
  on public.nextgen_monetization_revenue_events(provider_key, source_reference);

create index if not exists idx_ngm_revenue_events_reversal
  on public.nextgen_monetization_revenue_events(reversal_of_event_id);

create or replace function public.nextgen_post_monetization_revenue(
  p_event_date date,
  p_source_type text,
  p_source_reference text,
  p_gross_revenue_usd numeric,
  p_user_reward_usd numeric default 0,
  p_status text default 'pending',
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id bigint;
  v_net numeric;
  v_status text:=lower(trim(coalesce(p_status,'pending')));
  v_provider_key text:=lower(trim(coalesce(p_metadata->>'provider_key',p_source_type)));
  v_recoverable_at timestamptz;
begin
  if p_event_date is null then raise exception 'REVENUE_DATE_REQUIRED'; end if;
  if coalesce(length(trim(p_source_type)),0)=0 or coalesce(length(trim(p_source_reference)),0)=0
    then raise exception 'REVENUE_SOURCE_REQUIRED'; end if;
  if p_gross_revenue_usd is null or p_gross_revenue_usd<0 then raise exception 'INVALID_GROSS_REVENUE'; end if;
  if p_user_reward_usd is null or p_user_reward_usd<0 or p_user_reward_usd>p_gross_revenue_usd
    then raise exception 'INVALID_USER_REWARD'; end if;
  if v_status not in ('pending','posted','approved','settled','completed')
    then raise exception 'INVALID_REVENUE_STATUS'; end if;

  if v_status in ('settled','completed') then
    v_recoverable_at:=now();
  end if;

  v_net:=round(p_gross_revenue_usd-p_user_reward_usd,8);

  insert into public.nextgen_monetization_revenue_events(
    event_date,source_type,source_reference,gross_revenue_usd,user_reward_usd,net_revenue_usd,
    status,metadata,provider_key,recoverable_at,reconciliation_note
  )
  values(
    p_event_date,trim(p_source_type),trim(p_source_reference),round(p_gross_revenue_usd,8),
    round(p_user_reward_usd,8),v_net,v_status,coalesce(p_metadata,'{}'::jsonb),
    v_provider_key,v_recoverable_at,
    case when v_status in ('settled','completed') then 'Provider event accepted as recoverable.' else 'Awaiting provider reconciliation.' end
  )
  on conflict(source_type,source_reference) do update set
    event_date=excluded.event_date,
    gross_revenue_usd=excluded.gross_revenue_usd,
    user_reward_usd=excluded.user_reward_usd,
    net_revenue_usd=excluded.net_revenue_usd,
    status=excluded.status,
    metadata=excluded.metadata,
    provider_key=excluded.provider_key,
    recoverable_at=case
      when excluded.status in ('settled','completed') then coalesce(public.nextgen_monetization_revenue_events.recoverable_at,excluded.recoverable_at)
      else null
    end,
    reconciliation_note=excluded.reconciliation_note
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.nextgen_reconcile_monetization_reversal(
  p_original_event_id bigint,
  p_reversal_usd numeric,
  p_reversal_reference text,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path=''
as $function$
declare
  original public.nextgen_monetization_revenue_events%rowtype;
  reversal_id bigint;
  already_reversed numeric:=0;
  remaining numeric:=0;
  provider_key text;
begin
  if p_original_event_id is null then raise exception 'ORIGINAL_EVENT_REQUIRED'; end if;
  if p_reversal_usd is null or p_reversal_usd<=0 then raise exception 'INVALID_REVERSAL_AMOUNT'; end if;
  if coalesce(length(trim(p_reversal_reference)),0)=0 then raise exception 'REVERSAL_REFERENCE_REQUIRED'; end if;
  if coalesce(length(trim(p_reason)),0)<3 then raise exception 'REVERSAL_REASON_REQUIRED'; end if;

  select * into original
  from public.nextgen_monetization_revenue_events
  where id=p_original_event_id
  for update;

  if not found then raise exception 'ORIGINAL_EVENT_NOT_FOUND'; end if;
  if lower(original.status) not in ('settled','completed','reversed')
    then raise exception 'ORIGINAL_EVENT_NOT_RECOVERABLE'; end if;
  if original.net_revenue_usd<=0 then raise exception 'ORIGINAL_EVENT_HAS_NO_RECOVERABLE_NET'; end if;

  perform pg_advisory_xact_lock(hashtext('nextgen_revenue_reversal:'||p_original_event_id::text));

  select coalesce(sum(abs(net_revenue_usd)),0) into already_reversed
  from public.nextgen_monetization_revenue_events
  where reversal_of_event_id=p_original_event_id
    and lower(status) in ('settled','completed');

  remaining:=greatest(original.net_revenue_usd-already_reversed,0);
  if p_reversal_usd>remaining+0.00000001 then
    raise exception using errcode='P0001',message='REVERSAL_EXCEEDS_RECOVERABLE_REVENUE',
      detail=jsonb_build_object(
        'original_event_id',p_original_event_id,
        'original_net_revenue_usd',original.net_revenue_usd,
        'already_reversed_usd',already_reversed,
        'remaining_recoverable_usd',remaining,
        'requested_reversal_usd',p_reversal_usd
      )::text;
  end if;

  provider_key:=coalesce(original.provider_key,lower(trim(original.source_type)));

  insert into public.nextgen_monetization_revenue_events(
    event_date,source_type,source_reference,gross_revenue_usd,user_reward_usd,net_revenue_usd,
    status,metadata,provider_key,recoverable_at,reversal_of_event_id,reconciliation_note
  )
  values(
    original.event_date,'provider_reversal',trim(p_reversal_reference),
    round(-p_reversal_usd,8),0,round(-p_reversal_usd,8),'settled',
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object(
      'original_event_id',p_original_event_id,'original_source_type',original.source_type,
      'original_source_reference',original.source_reference,'reason',left(trim(p_reason),500)
    ),
    provider_key,now(),p_original_event_id,
    left(trim(p_reason),500)
  )
  on conflict(source_type,source_reference) do update set
    event_date=excluded.event_date,
    gross_revenue_usd=excluded.gross_revenue_usd,
    user_reward_usd=excluded.user_reward_usd,
    net_revenue_usd=excluded.net_revenue_usd,
    status=excluded.status,
    metadata=excluded.metadata,
    provider_key=excluded.provider_key,
    recoverable_at=excluded.recoverable_at,
    reversal_of_event_id=excluded.reversal_of_event_id,
    reconciliation_note=excluded.reconciliation_note
  returning id into reversal_id;

  update public.nextgen_monetization_revenue_events
  set status=case
      when already_reversed+p_reversal_usd >= original.net_revenue_usd-0.00000001 then 'reversed'
      else status
    end,
    reconciliation_note=case
      when already_reversed+p_reversal_usd >= original.net_revenue_usd-0.00000001 then 'Fully reversed; recoverable revenue is exhausted.'
      else reconciliation_note
    end
  where id=p_original_event_id;

  return reversal_id;
end;
$function$;

create or replace function public.nextgen_offerwall_reconciliation_snapshot()
returns jsonb
language plpgsql
security definer
stable
set search_path=''
as $function$
declare
  uid uuid:=auth.uid();
  provider_count integer:=0;
  enabled_provider_count integer:=0;
  event_count bigint:=0;
  recoverable_count bigint:=0;
  pending_count bigint:=0;
  reversed_count bigint:=0;
  recoverable_net numeric:=0;
  reversal_net numeric:=0;
  bad_event_count bigint:=0;
  orphaned_completion_count bigint:=0;
begin
  if uid is null or not public.nextgen_is_owner() then raise exception 'OWNER_ONLY'; end if;

  select count(*),count(*) filter(where enabled) into provider_count,enabled_provider_count
  from public.nextgen_offer_providers;

  select count(*) into event_count from public.nextgen_monetization_revenue_events;
  select count(*) into recoverable_count
  from public.nextgen_monetization_revenue_events
  where lower(status) in ('settled','completed') and recoverable_at is not null and net_revenue_usd>0;
  select count(*) into pending_count
  from public.nextgen_monetization_revenue_events
  where lower(status) in ('pending','posted','approved') or recoverable_at is null;
  select count(*) into reversed_count
  from public.nextgen_monetization_revenue_events
  where lower(status)='reversed' or reversal_of_event_id is not null;
  select coalesce(sum(net_revenue_usd),0) into recoverable_net
  from public.nextgen_monetization_revenue_events
  where lower(status) in ('settled','completed') and recoverable_at is not null and net_revenue_usd>0;
  select coalesce(sum(net_revenue_usd),0) into reversal_net
  from public.nextgen_monetization_revenue_events
  where reversal_of_event_id is not null and lower(status) in ('settled','completed');

  select count(*) into bad_event_count
  from public.nextgen_monetization_revenue_events
  where (gross_revenue_usd<0 or user_reward_usd<0 or user_reward_usd>gross_revenue_usd)
     or (lower(status) in ('settled','completed') and recoverable_at is null);

  select count(*) into orphaned_completion_count
  from public.nextgen_offer_completions oc
  where lower(oc.status) in ('posted','approved','settled','completed')
    and not exists(
      select 1
      from public.nextgen_monetization_revenue_events e
      where e.source_reference=oc.external_reference
        and e.source_type in ('offerwall','offer','offer_completion')
    );

  return jsonb_build_object(
    'ok',true,'engine','offerwall_reconciliation_cp07',
    'provider_count',provider_count,'enabled_provider_count',enabled_provider_count,
    'event_count',event_count,'recoverable_event_count',recoverable_count,
    'pending_or_unreconciled_event_count',pending_count,'reversed_event_count',reversed_count,
    'recoverable_net_revenue_usd',round(recoverable_net,8),
    'reversal_net_revenue_usd',round(reversal_net,8),
    'invalid_event_count',bad_event_count,
    'orphaned_posted_offer_completion_count',orphaned_completion_count,
    'mining_engine_rule','Only settled/completed monetization events with recoverable_at contribute to mining revenue.'
  );
end;
$function$;

create or replace function public.nextgen_prepare_mining_day(p_asset text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  asset_code text:=upper(trim(p_asset)); day_date date:=timezone('utc',now())::date; revenue_date date:=day_date-1; day_start timestamptz:=day_date::timestamptz;
  rule public.nextgen_economic_rule_versions%rowtype; ps public.nextgen_mining_pool_settings%rowtype; existing public.nextgen_mining_daily_pools%rowtype;
  gross_rev numeric:=0; net_rev numeric:=0; reserve_add numeric:=0; mining_base numeric:=0; donation_add numeric:=0; owner_add numeric:=0; reserve_balance numeric:=0; liability numeric:=0; coverage numeric:=1; prior_coverage numeric:=1; rsm numeric:=1;
  rolling_gross numeric:=0; rolling_net numeric:=0; rolling_release numeric:=0; mining_budget_total numeric:=0; asset_budget numeric:=0; total_hash numeric:=0; total_weight numeric:=0; active_users integer:=0; active_miners integer:=0; reward_rate numeric:=0; rate numeric:=0; rate_updated timestamptz;
  deposit_net numeric:=0; deposit_fee_bps integer:=100; prior_lot_exists boolean:=false; allocation jsonb;
begin
  if asset_code is null or asset_code='' then raise exception 'ASSET_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtext('nextgen_mining_prepare_global'));
  select * into rule from public.nextgen_economic_rule_versions where status='active' order by activated_at desc nulls last limit 1;
  if not found then raise exception 'ECONOMIC_RULE_NOT_ACTIVE'; end if;
  select * into ps from public.nextgen_mining_pool_settings where upper(asset)=asset_code and enabled=true for update;
  if not found or ps.pool_share_bps<=0 then raise exception 'MINING_ASSET_DISABLED'; end if;
  if ps.pool_share_bps>10000 then raise exception 'INVALID_POOL_SHARE'; end if;

  select exists(select 1 from public.nextgen_mining_revenue_lots l where l.lot_date=revenue_date and upper(l.asset)=asset_code) into prior_lot_exists;
  select * into existing from public.nextgen_mining_daily_pools where pool_date=day_date and upper(asset)=asset_code for update;
  if found and existing.prepared_at is not null and existing.economic_rule_version=rule.version and prior_lot_exists then
    return jsonb_build_object('prepared',true,'already_prepared',true,'pool_date',day_date,'asset',asset_code,'mining_budget_usd',existing.mining_budget_usd,'reserve_balance_usd',existing.reserve_balance_usd,'reserve_coverage_ratio',existing.reserve_coverage_ratio,'reserve_safety_multiplier',existing.reserve_safety_multiplier,'rolling_10d_net_revenue_usd',existing.rolling_10d_net_revenue_usd,'rolling_10d_mining_release_usd',existing.rolling_10d_mining_release_usd,'economic_rule_version',existing.economic_rule_version,'mining_allocation_bps',existing.mining_allocation_bps);
  elsif found and coalesce(existing.allocated_usd,0)=0 then
    delete from public.nextgen_mining_daily_user_weights where pool_date=day_date and asset=asset_code;
    delete from public.nextgen_mining_daily_pools where pool_date=day_date and upper(asset)=asset_code;
  elsif found then raise exception 'LEGACY_POOL_ALREADY_ALLOCATED'; end if;

  select coalesce(s.transaction_fee_bps,100) into deposit_fee_bps from public.nextgen_economy_settings s order by s.updated_at desc nulls last limit 1;
  deposit_fee_bps:=greatest(least(coalesce(deposit_fee_bps,100),10000),0);

  /* Canonical monetization source:
     raw offer/PTC/shortlink completion tables no longer feed mining directly.
     They must first reconcile into nextgen_monetization_revenue_events. */
  select coalesce(sum(e.gross_revenue_usd),0),coalesce(sum(e.net_revenue_usd),0)
  into gross_rev,net_rev
  from public.nextgen_monetization_revenue_events e
  where e.event_date=revenue_date
    and lower(e.status) in ('settled','completed')
    and e.recoverable_at is not null;

  select coalesce(sum(d.usd_amount),0)*deposit_fee_bps/10000.0 into deposit_net
  from public.nextgen_deposits d
  where lower(coalesce(d.status,''))='approved'
    and (coalesce(d.settled_at,d.reviewed_at,d.created_at) at time zone 'utc')::date=revenue_date;

  gross_rev:=greatest(gross_rev+greatest(deposit_net,0),0);
  net_rev:=greatest(net_rev+greatest(deposit_net,0),0);

  select coalesce((select balance_usd from public.nextgen_reserve_ledger order by id desc limit 1),0) into reserve_balance;
  select coalesce(sum(o.outstanding_usd),0) into liability from public.nextgen_mining_liability_open o; liability:=greatest(liability,0);
  prior_coverage:=case when liability<=0 then 1 else reserve_balance/liability end;
  allocation:=public.nextgen_resolve_mining_allocation_bps(prior_coverage);
  rule.mining_bps:=coalesce((allocation->>'mining_bps')::integer,4500); rule.reserve_bps:=coalesce((allocation->>'reserve_bps')::integer,3500); rule.donation_bps:=1000; rule.owner_platform_bps:=1000;
  reserve_add:=round(net_rev*rule.reserve_bps/10000.0,8); mining_base:=round(net_rev*rule.mining_bps/10000.0,8); donation_add:=round(net_rev*rule.donation_bps/10000.0,8); owner_add:=round(net_rev*rule.owner_platform_bps/10000.0,8);

  if not exists(select 1 from public.nextgen_reserve_ledger where event_date=day_date and source_type='recognized_revenue' and source_reference=revenue_date::text) then
    reserve_balance:=reserve_balance+reserve_add;
    insert into public.nextgen_reserve_ledger(event_date,source_type,source_reference,recognized_revenue_usd,reserve_in_usd,reserve_out_usd,balance_usd,rule_version)
    values(day_date,'recognized_revenue',revenue_date::text,net_rev,reserve_add,0,reserve_balance,rule.version);
  end if;

  insert into public.nextgen_mining_revenue_lots(lot_date,asset,gross_revenue_usd,net_revenue_usd,mining_allocation_usd,lot_days,daily_release_target_usd,start_release_date,end_release_date,rule_version)
  values(revenue_date,asset_code,gross_rev,net_rev,mining_base,10,round(mining_base/10.0,8),revenue_date+1,revenue_date+10,rule.version)
  on conflict(lot_date,asset) do update set
    gross_revenue_usd=excluded.gross_revenue_usd,
    net_revenue_usd=excluded.net_revenue_usd,
    mining_allocation_usd=excluded.mining_allocation_usd,
    lot_days=excluded.lot_days,
    daily_release_target_usd=excluded.daily_release_target_usd,
    start_release_date=excluded.start_release_date,
    end_release_date=excluded.end_release_date,
    rule_version=excluded.rule_version;

  select coalesce(sum(l.gross_revenue_usd),0),coalesce(sum(l.net_revenue_usd),0),coalesce(sum(l.daily_release_target_usd),0)
  into rolling_gross,rolling_net,rolling_release
  from public.nextgen_mining_revenue_lots l
  where upper(l.asset)=asset_code and day_date between l.start_release_date and l.end_release_date;

  if liability<=0 then coverage:=1; rsm:=1; else coverage:=reserve_balance/liability; rsm:=case when coverage>=1.5 then 1.00 when coverage>=1.2 then 0.85 else 0.70 end; end if;
  mining_budget_total:=round(rolling_release*rsm,8); asset_budget:=round(mining_budget_total*ps.pool_share_bps/10000.0,8);

  select count(*)::integer,count(distinct um.user_id)::integer,coalesce(sum(l.hashrate),0),
    coalesce(sum(l.hashrate*greatest(l.efficiency,0)*least(greatest(um.energy_percent,0),100)/100.0*
      coalesce((select p.mining_factor from public.nextgen_memberships mm join public.nextgen_membership_plans p on p.id=mm.plan_id where mm.user_id=um.user_id and mm.status='active' and mm.starts_at<=day_start and mm.expires_at>day_start order by mm.expires_at desc limit 1),1.0)),0)
  into active_miners,active_users,total_hash,total_weight
  from public.nextgen_user_miners um join public.nextgen_miner_levels l on l.miner_id=um.miner_id and l.level=um.current_level
  where um.status='active' and um.activated_at<=day_start and um.recharge_expires_at>day_start;

  insert into public.nextgen_mining_daily_user_weights(pool_date,asset,user_id,hashrate,efficiency,energy_percent,membership_factor,weighted_hash)
  select day_date,asset_code,um.user_id,sum(l.hashrate),avg(l.efficiency),avg(least(greatest(um.energy_percent,0),100)),
    coalesce((select p.mining_factor from public.nextgen_memberships mm join public.nextgen_membership_plans p on p.id=mm.plan_id where mm.user_id=um.user_id and mm.status='active' and mm.starts_at<=day_start and mm.expires_at>day_start order by mm.expires_at desc limit 1),1.0),
    sum(l.hashrate*greatest(l.efficiency,0)*least(greatest(um.energy_percent,0),100)/100.0*
      coalesce((select p.mining_factor from public.nextgen_memberships mm join public.nextgen_membership_plans p on p.id=mm.plan_id where mm.user_id=um.user_id and mm.status='active' and mm.starts_at<=day_start and mm.expires_at>day_start order by mm.expires_at desc limit 1),1.0))
  from public.nextgen_user_miners um join public.nextgen_miner_levels l on l.miner_id=um.miner_id and l.level=um.current_level
  where um.status='active' and um.activated_at<=day_start and um.recharge_expires_at>day_start group by um.user_id
  on conflict(pool_date,asset,user_id) do update set hashrate=excluded.hashrate,efficiency=excluded.efficiency,energy_percent=excluded.energy_percent,membership_factor=excluded.membership_factor,weighted_hash=excluded.weighted_hash;

  if total_weight>0 then reward_rate:=asset_budget/(86400.0*total_weight); end if;
  select rate_usd,updated_at into rate,rate_updated from public.nextgen_exchange_rates where upper(asset)=asset_code order by updated_at desc limit 1;
  if asset_budget>0 and (rate is null or rate<=0 or rate_updated<now()-interval '15 minutes') then raise exception 'ASSET_RATE_STALE'; end if;
  rate:=greatest(coalesce(rate,0),0);

  insert into public.nextgen_mining_daily_pools(
    pool_date,asset,gross_revenue_usd,net_revenue_usd,mining_budget_usd,rate_usd,active_revenue_users,
    baseline_total_hashrate,baseline_total_weight,reward_rate_usd_per_hash_second,allocated_usd,prepared_at,updated_at,
    reserve_allocation_usd,reserve_balance_usd,outstanding_mining_liability_usd,reserve_coverage_ratio,reserve_status,
    reserve_safety_multiplier,economic_rule_version,rolling_10d_gross_revenue_usd,rolling_10d_net_revenue_usd,
    rolling_10d_mining_release_usd,mining_lot_days,mining_allocation_bps,reserve_allocation_bps)
  values(
    day_date,asset_code,gross_rev,net_rev,asset_budget,rate,active_users,total_hash,total_weight,reward_rate,0,now(),now(),
    reserve_add,reserve_balance,liability,coverage,
    case when liability=0 then 'healthy' when coverage>=1.5 then 'healthy' when coverage>=1.0 then 'guarded' else 'critical' end,
    rsm,rule.version,rolling_gross,rolling_net,rolling_release,10,rule.mining_bps,rule.reserve_bps);

  return jsonb_build_object(
    'prepared',true,'already_prepared',false,'pool_date',day_date,'revenue_date',revenue_date,'asset',asset_code,
    'gross_revenue_usd',gross_rev,'net_recognized_revenue_usd',net_rev,'canonical_recoverable_revenue_source','nextgen_monetization_revenue_events',
    'mining_allocation_bps',rule.mining_bps,'reserve_allocation_bps',rule.reserve_bps,
    'allocation_policy',allocation,'allocation_mining_usd',mining_base,'allocation_reserve_usd',reserve_add,
    'allocation_donation_usd',donation_add,'allocation_owner_platform_usd',owner_add,
    'rolling_10d_net_revenue_usd',rolling_net,'rolling_10d_mining_release_usd',rolling_release,
    'reserve_balance_usd',reserve_balance,'outstanding_mining_liability_usd',liability,'reserve_coverage_ratio',coverage,
    'reserve_safety_multiplier',rsm,'mining_budget_usd',asset_budget,'baseline_total_hashrate',total_hash,
    'baseline_total_weight',total_weight,'reward_rate_usd_per_hash_second',reward_rate,'economic_rule_version',rule.version);
end;
$function$;

revoke execute on function public.nextgen_offerwall_reconciliation_snapshot() from public;
grant execute on function public.nextgen_offerwall_reconciliation_snapshot() to authenticated;

revoke execute on function public.nextgen_reconcile_monetization_reversal(bigint,numeric,text,text,jsonb) from public;
grant execute on function public.nextgen_reconcile_monetization_reversal(bigint,numeric,text,text,jsonb) to service_role;

revoke execute on function public.nextgen_post_monetization_revenue(date,text,text,numeric,numeric,text,jsonb) from public;
grant execute on function public.nextgen_post_monetization_revenue(date,text,text,numeric,numeric,text,jsonb) to service_role;

