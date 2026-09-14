create or replace function public.nextgen_owner_economic_dashboard_snapshot(p_asset text default 'USDT')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  asset_code text := upper(trim(coalesce(p_asset,'USDT')));
  capacity jsonb;
  pool public.nextgen_mining_daily_pools%rowtype;
  lot record;
  reserve_row record;
  recon record;
  recognized_today numeric := 0;
  recognized_10d numeric := 0;
  recognized_30d numeric := 0;
  reserve_balance numeric := 0;
  reserve_in_10d numeric := 0;
  reserve_out_10d numeric := 0;
  outstanding_liability numeric := 0;
  open_liability_rows bigint := 0;
  last_recon_at timestamptz := null;
  last_recon_ok boolean := null;
  last_recon_diff numeric := 0;
  last_recon_violations integer := 0;
  current_rule text := 'economic_v1_2_cp12';
  daily_mining_release numeric := 0;
  active_lot_release numeric := 0;
  active_lot_end date := null;
begin
  if uid is null or not public.nextgen_is_owner() then raise exception 'OWNER_ONLY'; end if;
  if asset_code = '' then raise exception 'ASSET_REQUIRED'; end if;
  capacity := public.nextgen_economic_capacity_snapshot_internal(asset_code);
  select * into pool from public.nextgen_mining_daily_pools where upper(asset)=asset_code order by pool_date desc limit 1;
  select coalesce(v.version,'economic_v1_2_cp12') into current_rule from public.nextgen_economic_rule_versions v where v.status='active' order by v.activated_at desc nulls last limit 1;
  select coalesce(sum(e.net_revenue_usd),0) into recognized_today from public.nextgen_monetization_revenue_events e where e.event_date=timezone('utc',now())::date and lower(e.status) in ('settled','completed') and e.recoverable_at is not null and e.net_revenue_usd>0;
  select coalesce(sum(e.net_revenue_usd),0) into recognized_10d from public.nextgen_monetization_revenue_events e where e.event_date between timezone('utc',now())::date-9 and timezone('utc',now())::date and lower(e.status) in ('settled','completed') and e.recoverable_at is not null and e.net_revenue_usd>0;
  select coalesce(sum(e.net_revenue_usd),0) into recognized_30d from public.nextgen_monetization_revenue_events e where e.event_date between timezone('utc',now())::date-29 and timezone('utc',now())::date and lower(e.status) in ('settled','completed') and e.recoverable_at is not null and e.net_revenue_usd>0;
  select r.* into reserve_row from public.nextgen_reserve_ledger r order by r.id desc limit 1;
  reserve_balance := greatest(coalesce(reserve_row.balance_usd,0),0);
  select coalesce(sum(r.reserve_in_usd),0),coalesce(sum(r.reserve_out_usd),0) into reserve_in_10d,reserve_out_10d from public.nextgen_reserve_ledger r where r.event_date between timezone('utc',now())::date-9 and timezone('utc',now())::date;
  select coalesce(sum(o.outstanding_usd),0),count(*) into outstanding_liability,open_liability_rows from public.nextgen_mining_liability_open o;
  outstanding_liability := greatest(outstanding_liability,0);
  select coalesce(sum(l.daily_release_target_usd) filter(where timezone('utc',now())::date between l.start_release_date and l.end_release_date),0) into active_lot_release from public.nextgen_mining_revenue_lots l where upper(l.asset)=asset_code;
  select l.daily_release_target_usd,l.end_release_date into lot from public.nextgen_mining_revenue_lots l where upper(l.asset)=asset_code and timezone('utc',now())::date between l.start_release_date and l.end_release_date order by l.lot_date desc,l.id desc limit 1;
  if lot.daily_release_target_usd is not null then daily_mining_release:=greatest(coalesce(lot.daily_release_target_usd,0),0); active_lot_end:=lot.end_release_date; else daily_mining_release:=greatest(active_lot_release,0); end if;
  select run_at,ok,liability_diff_usd,(pool_violation_count+crypto_violation_count+negative_balance_count+reserved_over_balance_count) as violation_count into recon from public.nextgen_economic_reconciliation_runs order by run_at desc limit 1;
  last_recon_at:=recon.run_at; last_recon_ok:=recon.ok; last_recon_diff:=coalesce(recon.liability_diff_usd,0); last_recon_violations:=coalesce(recon.violation_count,0);
  return jsonb_build_object(
    'ok',true,'engine','owner_economic_dashboard_cp13','asset',asset_code,'as_of',now(),'economic_rule_version',current_rule,
    'allocation',jsonb_build_object('reserve_bps',5000,'mining_bps',2500,'donation_bps',1000,'owner_operating_bps',1500,'mining_lot_days',10),
    'recognized_revenue',jsonb_build_object('today_usd',round(recognized_today,8),'rolling_10d_usd',round(recognized_10d,8),'rolling_30d_usd',round(recognized_30d,8)),
    'reserve',jsonb_build_object('balance_usd',round(reserve_balance,8),'in_10d_usd',round(reserve_in_10d,8),'out_10d_usd',round(reserve_out_10d,8),'coverage_ratio',coalesce((capacity->>'reserve_coverage_ratio')::numeric,0),'status',coalesce(capacity->>'reserve_status','UNKNOWN')),
    'liability',jsonb_build_object('outstanding_usd',round(outstanding_liability,8),'open_rows',open_liability_rows),
    'mining',jsonb_build_object('rolling_10d_release_usd',round(coalesce((capacity->>'rolling_10d_mining_release_usd')::numeric,0),8),'current_daily_release_usd',round(daily_mining_release,8),'mining_budget_usd',round(coalesce((capacity->>'mining_budget_usd')::numeric,0),8),'active_lot_end',active_lot_end),
    'capacity',jsonb_build_object('raw_hash',(capacity->>'raw_hash')::numeric,'weighted_hash',(capacity->>'weighted_hash')::numeric,'reward_usd_per_1000_weighted_hash',(capacity->>'reward_usd_per_1000_weighted_hash')::numeric,'capacity_utilization_percent',(capacity->>'capacity_utilization_percent')::numeric,'target_safe_weighted_hash',(capacity->>'target_safe_weighted_hash')::numeric,'healthy_safe_weighted_hash',(capacity->>'healthy_safe_weighted_hash')::numeric,'floor_safe_weighted_hash',(capacity->>'floor_safe_weighted_hash')::numeric,'new_weighted_hash_headroom',(capacity->>'new_weighted_hash_headroom')::numeric),
    'guard',jsonb_build_object('status',capacity->>'status','expansion_allowed',(capacity->>'expansion_allowed')::boolean,'reason',capacity->>'reason'),
    'pool',case when pool.pool_date is null then null else jsonb_build_object('pool_date',pool.pool_date,'prepared_at',pool.prepared_at,'net_revenue_usd',pool.net_revenue_usd,'mining_budget_usd',pool.mining_budget_usd,'allocated_usd',pool.allocated_usd,'rolling_10d_mining_release_usd',pool.rolling_10d_mining_release_usd,'baseline_total_weight',pool.baseline_total_weight) end,
    'reconciliation',jsonb_build_object('last_run_at',last_recon_at,'last_run_ok',last_recon_ok,'liability_diff_usd',round(last_recon_diff,8),'violation_count',last_recon_violations)
  );
end;
$$;

revoke all on function public.nextgen_owner_economic_dashboard_snapshot(text) from public;
grant execute on function public.nextgen_owner_economic_dashboard_snapshot(text) to authenticated;
