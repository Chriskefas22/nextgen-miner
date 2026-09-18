/* CP25.2 — FARM ROOM SUMMARY + CLAIMABLE PREVIEW */

create or replace function public.nextgen_mining_claim_preview(p_asset text default 'USDT') returns jsonb language plpgsql security definer stable set search_path to '' as $fn$
declare uid uuid:=auth.uid(); asset_code text:=upper(trim(coalesce(p_asset,'USDT'))); settlement_date date:=timezone('utc',now())::date-1; pool public.nextgen_mining_daily_pools%rowtype; weight public.nextgen_mining_daily_user_weights%rowtype; payout_id bigint; standard_budget numeric:=0; standard_allocated numeric:=0; free_allocated numeric:=0; allocated numeric:=0; available numeric:=0; crypto_amt numeric:=0; reason text:='UNKNOWN'; status text:='NOT_READY';
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if; if asset_code is null or asset_code='' then raise exception 'ASSET_REQUIRED'; end if;
 select * into pool from public.nextgen_mining_daily_pools where pool_date=settlement_date and upper(asset)=asset_code;
 if not found or pool.prepared_at is null then reason:='MINING_POOL_NOT_PREPARED'; elsif coalesce(pool.mining_budget_usd,0)<=0 then reason:='NO_FUNDED_MINING_POOL'; else
  select * into weight from public.nextgen_mining_daily_user_weights where pool_date=settlement_date and upper(asset)=asset_code and user_id=uid;
  if not found or (coalesce(weight.standard_weighted_hash,0)<=0 and coalesce(weight.free_weighted_hash,0)<=0) then reason:='NO_SETTLEMENT_WEIGHT'; else
   select id into payout_id from public.nextgen_mining_payouts where pool_date=settlement_date and upper(asset)=asset_code and user_id=uid limit 1;
   if payout_id is not null then status:='ALREADY_SETTLED'; reason:='ALREADY_SETTLED'; else
    standard_budget:=greatest(pool.mining_budget_usd-coalesce(pool.free_pool_budget_usd,0),0);
    if coalesce(pool.standard_total_weight,0)>0 and standard_budget>0 then standard_allocated:=round(standard_budget*greatest(weight.standard_weighted_hash,0)/pool.standard_total_weight,8); end if;
    if coalesce(pool.free_total_weight,0)>0 and coalesce(pool.free_pool_budget_usd,0)>0 and coalesce(weight.free_weighted_hash,0)>0 then free_allocated:=round(pool.free_pool_budget_usd*weight.free_weighted_hash/pool.free_total_weight,8); if coalesce(weight.free_target_daily_usd,0)>0 then free_allocated:=least(free_allocated,greatest(weight.free_target_daily_usd,0)); else free_allocated:=0; end if; end if;
    allocated:=greatest(standard_allocated+free_allocated,0); available:=greatest(pool.mining_budget_usd-pool.allocated_usd,0); allocated:=least(allocated,available);
    if allocated>0 and coalesce(pool.rate_usd,0)>0 then crypto_amt:=round(allocated/pool.rate_usd,18); status:='READY'; reason:='SETTLEMENT_AVAILABLE'; else allocated:=0; crypto_amt:=0; reason:=case when available<=0 then 'SETTLEMENT_POOL_EXHAUSTED' when coalesce(pool.rate_usd,0)<=0 then 'MINING_RATE_UNAVAILABLE' else 'MINING_REWARD_TOO_SMALL' end; end if;
   end if;
  end if;
 end if;
 return jsonb_build_object('asset',asset_code,'settlement_date',settlement_date,'status',status,'reason',reason,'payout_id',payout_id,'amount_usd',allocated,'crypto_amount',crypto_amt,'standard_amount_usd',standard_allocated,'free_bonus_amount_usd',free_allocated,'pool_budget_usd',coalesce(pool.mining_budget_usd,0),'pool_allocated_usd',coalesce(pool.allocated_usd,0),'pool_remaining_usd',greatest(coalesce(pool.mining_budget_usd,0)-coalesce(pool.allocated_usd,0),0),'economic_rule_version',pool.economic_rule_version);
end;
$fn$;
revoke all on function public.nextgen_mining_claim_preview(text) from public,anon; grant execute on function public.nextgen_mining_claim_preview(text) to authenticated;

alter function public.nextgen_farm_snapshot(text) rename to nextgen_farm_snapshot_legacy_cp25_2;
create or replace function public.nextgen_farm_snapshot(p_asset text default 'USDT') returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare uid uuid:=auth.uid(); base jsonb; live jsonb; rooms jsonb; first_room jsonb; room_summary jsonb; expiry timestamptz; live_status text; room_count integer:=0;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if; base:=public.nextgen_farm_snapshot_legacy_cp25_2(p_asset); live:=coalesce(base->'live_earnings','{}'::jsonb); rooms:=public.nextgen_rooms_snapshot(); room_count:=coalesce((rooms->>'room_count')::integer,0); first_room:=coalesce(rooms->'rooms'->0,'{}'::jsonb); expiry:=nullif(live->>'recharge_expires_at','')::timestamptz; live_status:=coalesce(live->>'status','PAUSED');
 room_summary:=jsonb_build_object('name',coalesce(first_room->>'name','Starter Rack'),'room_count',room_count,'capacity',coalesce((first_room->>'capacity_slots')::integer,12),'workers',coalesce((first_room->>'used_slots')::integer,0),'load_percent',case when coalesce((first_room->>'capacity_slots')::numeric,0)>0 then round(coalesce((first_room->>'used_slots')::numeric,0)/(first_room->>'capacity_slots')::numeric*100,2) else 0 end,'hashrate',coalesce((first_room->>'hashrate')::numeric,0),'power_watts',coalesce((first_room->>'power_watts')::numeric,0));
 return base||jsonb_build_object('room',room_summary,'rooms_snapshot',rooms,'live_earnings',live||jsonb_build_object('status',live_status,'recharge_expires_at',expiry));
end;
$fn$;
revoke all on function public.nextgen_farm_snapshot_legacy_cp25_2(text) from public,anon,authenticated; revoke all on function public.nextgen_farm_snapshot(text) from public,anon; grant execute on function public.nextgen_farm_snapshot(text) to authenticated;
