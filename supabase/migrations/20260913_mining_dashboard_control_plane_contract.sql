-- Authoritative read contract for Next.js/Vercel.
-- The application must not calculate mining rewards locally.

create or replace function public.nextgen_mining_dashboard_snapshot(p_asset text default 'USDT')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  asset_code text := upper(trim(coalesce(p_asset,'USDT')));
  today_utc date := timezone('utc',now())::date;
  current_pool public.nextgen_mining_daily_pools%rowtype;
  previous_pool public.nextgen_mining_daily_pools%rowtype;
  crypto jsonb;
  recent jsonb;
  diamond_balance numeric := 0;
  reserved_diamond numeric := 0;
  total_crypto numeric := 0;
  active_miners integer := 0;
  active_hash numeric := 0;
  today_reward numeric := 0;
  total_reward numeric := 0;
  outstanding_liability numeric := 0;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if asset_code is null or asset_code='' then raise exception 'ASSET_REQUIRED'; end if;

  select coalesce(w.diamond_balance,0), coalesce(w.reserved_diamond,0)
    into diamond_balance,reserved_diamond
  from public.nextgen_wallets w
  where w.user_id=uid;

  select * into current_pool from public.nextgen_mining_daily_pools
  where pool_date=today_utc and upper(asset)=asset_code;

  select * into previous_pool from public.nextgen_mining_daily_pools
  where pool_date=today_utc-1 and upper(asset)=asset_code;

  select count(*)::integer, coalesce(sum(l.hashrate),0)
    into active_miners, active_hash
  from public.nextgen_user_miners um
  join public.nextgen_miner_levels l on l.miner_id=um.miner_id and l.level=um.current_level
  where um.user_id=uid and um.status='active';

  select coalesce(sum(p.crypto_amount),0), coalesce(sum(p.allocated_usd),0)
    into total_crypto,total_reward
  from public.nextgen_mining_payouts p
  where p.user_id=uid and upper(p.asset)=asset_code;

  select coalesce(sum(p.allocated_usd),0)
    into today_reward
  from public.nextgen_mining_payouts p
  where p.user_id=uid and upper(p.asset)=asset_code and p.pool_date=today_utc;

  select coalesce(sum(l.usd_delta),0)
    into outstanding_liability
  from public.nextgen_mining_liability_ledger l
  where l.user_id=uid and upper(l.asset)=asset_code;

  select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) into recent
  from (
    select p.created_at,
      jsonb_build_object('reference_id',p.id,'pool_date',p.pool_date,'asset',p.asset,
        'allocated_usd',p.allocated_usd,'crypto_amount',p.crypto_amount,'created_at',p.created_at) as item
    from public.nextgen_mining_payouts p
    where p.user_id=uid and upper(p.asset)=asset_code
    order by p.created_at desc
    limit 10
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object('asset',b.asset,'balance',b.balance,'reserved_balance',b.reserved_balance) order by b.asset),'[]'::jsonb)
    into crypto
  from public.nextgen_crypto_balances b
  where b.user_id=uid;

  return jsonb_build_object(
    'engine','authoritative_settlement_v2','economic_rule_version','economic_v1_0',
    'asset',asset_code,'today_utc',today_utc,
    'diamond_balance',diamond_balance,'reserved_diamond',reserved_diamond,
    'active_miners',active_miners,'active_hashrate',active_hash,
    'today_mining_reward_usd',today_reward,'total_mining_reward_usd',total_reward,
    'total_mining_reward_crypto',total_crypto,'outstanding_mining_liability_usd',outstanding_liability,
    'current_pool',case when current_pool.pool_date is null then null else jsonb_build_object(
      'pool_date',current_pool.pool_date,'mining_budget_usd',current_pool.mining_budget_usd,
      'allocated_usd',current_pool.allocated_usd,'reserve_balance_usd',current_pool.reserve_balance_usd,
      'reserve_coverage_ratio',current_pool.reserve_coverage_ratio,'reserve_safety_multiplier',current_pool.reserve_safety_multiplier,
      'reserve_status',current_pool.reserve_status,'baseline_total_hashrate',current_pool.baseline_total_hashrate,
      'baseline_total_weight',current_pool.baseline_total_weight,'prepared_at',current_pool.prepared_at)
    end,
    'previous_pool',case when previous_pool.pool_date is null then null else jsonb_build_object(
      'pool_date',previous_pool.pool_date,'mining_budget_usd',previous_pool.mining_budget_usd,
      'allocated_usd',previous_pool.allocated_usd,'reserve_balance_usd',previous_pool.reserve_balance_usd,
      'reserve_coverage_ratio',previous_pool.reserve_coverage_ratio,'reserve_safety_multiplier',previous_pool.reserve_safety_multiplier,
      'reserve_status',previous_pool.reserve_status,'baseline_total_hashrate',previous_pool.baseline_total_hashrate,
      'baseline_total_weight',previous_pool.baseline_total_weight,'prepared_at',previous_pool.prepared_at)
    end,
    'crypto_balances',crypto,'recent_mining_settlements',recent
  );
end;
$function$;

revoke all on function public.nextgen_mining_dashboard_snapshot(text) from public, anon, authenticated;
grant execute on function public.nextgen_mining_dashboard_snapshot(text) to authenticated;
