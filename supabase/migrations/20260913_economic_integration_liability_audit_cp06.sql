begin;

create or replace function public.nextgen_assert_economic_capacity_for_expansion(p_asset text,p_additional_weight numeric)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare uid uuid:=auth.uid(); snapshot jsonb; extra numeric:=greatest(coalesce(p_additional_weight,0),0); current_weight numeric:=0; target_capacity numeric:=0; projected_weight numeric:=0; projected_reward numeric:=0; reserve_coverage numeric:=0; allowed boolean:=false;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if upper(trim(coalesce(p_asset,'')))='' then raise exception 'ASSET_REQUIRED'; end if;
 if extra<=0 then return jsonb_build_object('ok',true,'expansion_allowed',true,'additional_weight',0); end if;
 perform pg_advisory_xact_lock(hashtext('nextgen_economic_capacity:'||upper(trim(p_asset))));
 snapshot:=public.nextgen_economic_capacity_snapshot_internal(p_asset);
 current_weight:=coalesce((snapshot->>'weighted_hash')::numeric,0); projected_weight:=current_weight+extra; target_capacity:=coalesce((snapshot->>'target_safe_weighted_hash')::numeric,0); reserve_coverage:=coalesce((snapshot->>'reserve_coverage_ratio')::numeric,0); allowed:=coalesce((snapshot->>'expansion_allowed')::boolean,false);
 if projected_weight>0 and coalesce((snapshot->>'mining_budget_usd')::numeric,0)>0 then projected_reward:=((snapshot->>'mining_budget_usd')::numeric/projected_weight)*1000; end if;
 if reserve_coverage<1.0 or not allowed or projected_weight>target_capacity or projected_reward<coalesce((snapshot->>'target_reward_usd_per_1000')::numeric,0) then raise exception using errcode='P0001',message='MINING_CAPACITY_GUARD',detail=jsonb_build_object('status',snapshot->>'status','reason',case when reserve_coverage<1.0 then 'Reserve coverage below 1.00x; expansion fail-closed' else snapshot->>'reason' end,'current_weighted_hash',current_weight,'additional_weight',extra,'projected_weighted_hash',projected_weight,'target_safe_weighted_hash',target_capacity,'projected_reward_usd_per_1000',projected_reward,'target_reward_usd_per_1000',snapshot->>'target_reward_usd_per_1000','reserve_coverage_ratio',reserve_coverage)::text; end if;
 return jsonb_build_object('ok',true,'expansion_allowed',true,'additional_weight',extra,'projected_weighted_hash',projected_weight,'target_safe_weighted_hash',target_capacity,'projected_reward_usd_per_1000',projected_reward,'reserve_coverage_ratio',reserve_coverage);
end;
$function$;

create or replace function public.nextgen_claim_mining(p_asset text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare uid uuid:=auth.uid(); asset_code text:=upper(trim(p_asset)); settlement_date date:=timezone('utc',now())::date-1; pool public.nextgen_mining_daily_pools%rowtype; weight public.nextgen_mining_daily_user_weights%rowtype; allocated numeric:=0; available numeric:=0; crypto_amt numeric:=0; payout_id bigint; ledger_id bigint; liability_id bigint;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if asset_code is null or asset_code='' then raise exception 'ASSET_REQUIRED'; end if;
 perform public.nextgen_assert_economic_invariants();
 perform pg_advisory_xact_lock(hashtext('nextgen_mining_settle:'||settlement_date::text||':'||asset_code));
 select * into pool from public.nextgen_mining_daily_pools where pool_date=settlement_date and upper(asset)=asset_code for update;
 if not found or pool.prepared_at is null then raise exception 'MINING_POOL_NOT_PREPARED'; end if;
 if coalesce(trim(pool.economic_rule_version),'')='' then raise exception 'ECONOMIC_RULE_VERSION_MISSING'; end if;
 if pool.mining_budget_usd<=0 then raise exception 'NO_FUNDED_MINING_POOL'; end if;
 select * into weight from public.nextgen_mining_daily_user_weights where pool_date=settlement_date and upper(asset)=asset_code and user_id=uid;
 if not found or weight.weighted_hash<=0 then raise exception 'NO_SETTLEMENT_WEIGHT'; end if;
 select id into payout_id from public.nextgen_mining_payouts where pool_date=settlement_date and upper(asset)=asset_code and user_id=uid;
 if payout_id is not null then return jsonb_build_object('success',true,'already_settled',true,'pool_date',settlement_date,'asset',asset_code,'payout_id',payout_id); end if;
 if pool.baseline_total_weight<=0 then raise exception 'NO_ALLOCATABLE_HASHRATE'; end if;
 allocated:=round(pool.mining_budget_usd*weight.weighted_hash/pool.baseline_total_weight,8); available:=greatest(pool.mining_budget_usd-pool.allocated_usd,0); allocated:=least(greatest(allocated,0),available); if allocated<=0 then raise exception 'SETTLEMENT_POOL_EXHAUSTED'; end if;
 crypto_amt:=round(allocated/nullif(pool.rate_usd,0),18); if crypto_amt<=0 then raise exception 'MINING_REWARD_TOO_SMALL'; end if;
 insert into public.nextgen_mining_payouts(pool_date,asset,user_id,hashrate,total_hashrate,activity_revenue_usd,total_activity_revenue_usd,activity_factor,allocated_usd,crypto_amount) values(settlement_date,asset_code,uid,weight.weighted_hash,pool.baseline_total_weight,0,0,1,allocated,crypto_amt) returning id into payout_id;
 insert into public.nextgen_mining_accrual_ledger(user_id,user_miner_id,asset,started_at,ended_at,elapsed_seconds,hashrate,activity_factor,allocated_usd,crypto_amount,idempotency_key,metadata) values(uid,null,asset_code,settlement_date::timestamptz,settlement_date::timestamptz+interval '24 hours',86400,weight.weighted_hash,1,allocated,crypto_amt,md5(uid::text||':'||settlement_date::text||':'||asset_code||':settlement_v4'),jsonb_build_object('engine','authoritative_settlement_v4','pool_date',settlement_date,'weighted_hash',weight.weighted_hash,'efficiency',weight.efficiency,'energy_percent',weight.energy_percent,'pool_rate_usd',pool.rate_usd,'economic_rule_version',pool.economic_rule_version)) returning id into ledger_id;
 insert into public.nextgen_mining_liability_ledger(user_id,asset,event_type,crypto_delta,usd_delta,payout_id,reference_type,reference_id,idempotency_key,metadata) values(uid,asset_code,'reward',crypto_amt,allocated,payout_id,'mining_payout',payout_id::text,md5('reward:'||payout_id::text),jsonb_build_object('engine','liability_ledger_v1','accrual_ledger_id',ledger_id,'pool_date',settlement_date,'economic_rule_version',pool.economic_rule_version)) returning id into liability_id;
 insert into public.nextgen_crypto_balances(user_id,asset,balance,reserved_balance) values(uid,asset_code,crypto_amt,0) on conflict(user_id,asset) do update set balance=public.nextgen_crypto_balances.balance+excluded.balance,updated_at=now();
 insert into public.nextgen_crypto_ledger(user_id,asset,direction,amount,usd_value,reference_type,reference_id,note) values(uid,asset_code,'mining_reward',crypto_amt,allocated,'mining_settlement',payout_id::text,'24h mining settlement funded by recognized monetization revenue');
 insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,usd_delta,asset,crypto_amount,reference_id,note) values(uid,'mining_reward',0,allocated,asset_code,crypto_amt,payout_id::text,'Authoritative 24h mining settlement');
 update public.nextgen_mining_daily_pools set allocated_usd=pool.allocated_usd+allocated,outstanding_mining_liability_usd=greatest(pool.outstanding_mining_liability_usd+allocated,0),updated_at=now() where pool_date=settlement_date and upper(asset)=asset_code;
 return jsonb_build_object('success',true,'engine','authoritative_settlement_v4','pool_date',settlement_date,'asset',asset_code,'weighted_hash',weight.weighted_hash,'efficiency',weight.efficiency,'energy_percent',weight.energy_percent,'allocated_usd',allocated,'crypto_amount',crypto_amt,'payout_id',payout_id,'liability_ledger_id',liability_id,'economic_rule_version',pool.economic_rule_version);
end;
$function$;

create or replace function public.nextgen_purchase_miner(p_miner_id bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid:=auth.uid(); m public.nextgen_miner_catalog%rowtype; w public.nextgen_wallets%rowtype; new_id bigint; projected_weight numeric; membership_factor numeric:=1.0;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into m from public.nextgen_miner_catalog where id=p_miner_id and enabled=true for update; if not found then raise exception 'MINER_NOT_FOUND'; end if;
 if m.base_price_diamond=0 and exists(select 1 from public.nextgen_user_miners um where um.user_id=uid and um.miner_id=p_miner_id and um.is_merged=false) then raise exception 'FREE_MINER_ALREADY_CLAIMED'; end if;
 if m.base_price_diamond>0 then select * into w from public.nextgen_wallets where user_id=uid for update; if not found or w.diamond_balance<m.base_price_diamond then raise exception 'INSUFFICIENT_DIAMOND'; end if; end if;
 select coalesce(p.mining_factor,1.0) into membership_factor from public.nextgen_memberships mm join public.nextgen_membership_plans p on p.id=mm.plan_id where mm.user_id=uid and mm.status='active' and mm.starts_at<=now() and mm.expires_at>now() order by mm.expires_at desc limit 1;
 projected_weight:=greatest(m.base_hashrate,0)*greatest(membership_factor,0); if projected_weight>0 then perform public.nextgen_assert_economic_capacity_for_expansion('USDT',projected_weight); end if;
 if m.base_price_diamond>0 then update public.nextgen_wallets set diamond_balance=diamond_balance-m.base_price_diamond,updated_at=now() where user_id=uid; end if;
 insert into public.nextgen_user_miners(user_id,miner_id,current_level,total_spent_diamond,status,is_merged) values(uid,p_miner_id,1,m.base_price_diamond,'active',false) returning id into new_id;
 insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,reference_id,note) values(uid,'miner_purchase',-m.base_price_diamond,new_id::text,case when m.base_price_diamond=0 then 'Free starter miner claim' else 'Miner purchase and activation' end);
 return jsonb_build_object('ok',true,'user_miner_id',new_id,'miner_id',p_miner_id,'level',1,'hashrate',m.base_hashrate,'price_diamond',m.base_price_diamond);
end;
$function$;

create or replace function public.nextgen_owner_gift_miner(p_target_user_id uuid,p_miner_id bigint,p_note text default null)
returns bigint language plpgsql security definer set search_path to 'public' as $function$
declare v_owner uuid:=auth.uid(); v_id bigint; v_name text; v_weight numeric:=0; v_membership_factor numeric:=1.0;
begin
 if v_owner is null or not public.nextgen_is_owner() then raise exception 'OWNER_ONLY'; end if;
 if p_target_user_id is null or p_miner_id is null then raise exception 'INVALID_GIFT'; end if;
 if p_note is null or length(trim(p_note))<3 then raise exception 'NOTE_REQUIRED'; end if;
 perform 1 from auth.users where id=p_target_user_id; if not found then raise exception 'USER_NOT_FOUND'; end if;
 select name,base_hashrate into v_name,v_weight from public.nextgen_miner_catalog where id=p_miner_id and enabled=true; if not found then raise exception 'MINER_NOT_FOUND_OR_DISABLED'; end if;
 if exists(select 1 from public.nextgen_user_miners where user_id=p_target_user_id and miner_id=p_miner_id and is_merged=false) then raise exception 'MINER_ALREADY_OWNED'; end if;
 select coalesce(p.mining_factor,1.0) into v_membership_factor from public.nextgen_memberships mm join public.nextgen_membership_plans p on p.id=mm.plan_id where mm.user_id=p_target_user_id and mm.status='active' and mm.starts_at<=now() and mm.expires_at>now() order by mm.expires_at desc limit 1;
 v_weight:=greatest(v_weight,0)*greatest(v_membership_factor,0); if v_weight>0 then perform public.nextgen_assert_economic_capacity_for_expansion('USDT',v_weight); end if;
 insert into public.nextgen_user_miners(user_id,miner_id,current_level,total_spent_diamond,status,activated_at) values(p_target_user_id,p_miner_id,1,0,'active',now()) returning id into v_id;
 insert into public.nextgen_owner_control_audit(owner_user_id,target_user_id,action,miner_id,note) values(v_owner,p_target_user_id,'miner_gift',p_miner_id,left(trim(p_note),500));
 return v_id;
end;
$function$;

create or replace function public.nextgen_economic_liability_audit()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare uid uuid:=auth.uid(); v_reward_usd numeric:=0; v_release_usd numeric:=0; v_outstanding_usd numeric:=0; v_reward_crypto numeric:=0; v_release_crypto numeric:=0; v_outstanding_crypto numeric:=0; v_open_usd numeric:=0; v_open_crypto numeric:=0; v_payout_usd numeric:=0; v_pool_budget_usd numeric:=0; v_bad_payouts integer:=0; v_revenue_bad integer:=0; v_withdraw_bad integer:=0; v_pool_mismatch integer:=0; v_status text:='PASS'; v_issues jsonb:='[]'::jsonb;
begin
 if uid is null or not public.nextgen_is_owner() then raise exception 'OWNER_ONLY'; end if;
 select coalesce(sum(usd_delta) filter(where event_type='reward'),0),-coalesce(sum(usd_delta) filter(where event_type<>'reward'),0),coalesce(sum(usd_delta),0),coalesce(sum(crypto_delta) filter(where event_type='reward'),0),-coalesce(sum(crypto_delta) filter(where event_type<>'reward'),0),coalesce(sum(crypto_delta),0) into v_reward_usd,v_release_usd,v_outstanding_usd,v_reward_crypto,v_release_crypto,v_outstanding_crypto from public.nextgen_mining_liability_ledger;
 select coalesce(sum(outstanding_usd),0),coalesce(sum(outstanding_crypto),0) into v_open_usd,v_open_crypto from public.nextgen_mining_liability_open;
 select coalesce(sum(allocated_usd),0) into v_payout_usd from public.nextgen_mining_payouts;
 select coalesce(sum(mining_budget_usd),0) into v_pool_budget_usd from public.nextgen_mining_daily_pools;
 select count(*) into v_bad_payouts from public.nextgen_mining_payouts p join public.nextgen_mining_daily_pools d on d.pool_date=p.pool_date and upper(d.asset)=upper(p.asset) where p.allocated_usd<0 or p.allocated_usd>d.mining_budget_usd;
 select count(*) into v_revenue_bad from public.nextgen_monetization_revenue_events e where e.gross_revenue_usd<0 or e.user_reward_usd<0 or e.user_reward_usd>e.gross_revenue_usd or e.net_revenue_usd<0;
 select count(*) into v_withdraw_bad from public.nextgen_withdrawals w left join public.nextgen_crypto_balances b on b.user_id=w.user_id and upper(b.asset)=upper(w.asset) where lower(w.status)='pending' and (b.user_id is null or b.reserved_balance<0 or b.reserved_balance>b.balance);
 select count(*) into v_pool_mismatch from (select d.pool_date,d.asset,d.allocated_usd,coalesce(sum(p.allocated_usd),0) payout_usd from public.nextgen_mining_daily_pools d left join public.nextgen_mining_payouts p on p.pool_date=d.pool_date and upper(p.asset)=upper(d.asset) group by d.pool_date,d.asset,d.allocated_usd having abs(d.allocated_usd-coalesce(sum(p.allocated_usd),0))>0.00000001 and d.allocated_usd>0) x;
 if abs(v_outstanding_usd-v_open_usd)>0.00000001 or abs(v_outstanding_crypto-v_open_crypto)>0.00000000000000001 then v_status:='FAIL'; v_issues:=v_issues||jsonb_build_array('LIABILITY_OPEN_VIEW_MISMATCH'); end if;
 if v_outstanding_usd<-0.00000001 or v_outstanding_crypto<-0.00000000000000001 then v_status:='FAIL'; v_issues:=v_issues||jsonb_build_array('NEGATIVE_OUTSTANDING_LIABILITY'); end if;
 if v_bad_payouts>0 then v_status:='FAIL'; v_issues:=v_issues||jsonb_build_array('PAYOUT_EXCEEDS_POOL_BUDGET'); end if;
 if v_revenue_bad>0 then v_status:='FAIL'; v_issues:=v_issues||jsonb_build_array('INVALID_REVENUE_EVENT'); end if;
 if v_withdraw_bad>0 then v_status:='FAIL'; v_issues:=v_issues||jsonb_build_array('INVALID_WITHDRAWAL_RESERVATION'); end if;
 if v_pool_mismatch>0 and v_status='PASS' then v_status:='WARN'; v_issues:=v_issues||jsonb_build_array('POOL_ALLOCATED_DIFFERENT_FROM_SETTLED_PAYOUTS'); end if;
 return jsonb_build_object('ok',true,'audit_version','economic_liability_audit_cp06','status',v_status,'issues',v_issues,'liability',jsonb_build_object('reward_usd',round(v_reward_usd,8),'released_usd',round(v_release_usd,8),'outstanding_usd',round(v_outstanding_usd,8),'reward_crypto',round(v_reward_crypto,18),'released_crypto',round(v_release_crypto,18),'outstanding_crypto',round(v_outstanding_crypto,18),'open_view_usd',round(v_open_usd,8),'open_view_crypto',round(v_open_crypto,18)),'payouts',jsonb_build_object('settled_usd',round(v_payout_usd,8),'bad_payout_rows',v_bad_payouts),'pools',jsonb_build_object('total_budget_usd',round(v_pool_budget_usd,8),'allocation_payout_mismatch_rows',v_pool_mismatch),'revenue',jsonb_build_object('invalid_rows',v_revenue_bad),'withdrawals',jsonb_build_object('invalid_pending_reservations',v_withdraw_bad),'note','This is an integrity audit, not a profitability guarantee.');
end;
$function$;

revoke all on function public.nextgen_economic_liability_audit() from public,anon,authenticated;
grant execute on function public.nextgen_economic_liability_audit() to authenticated;
revoke execute on function public.nextgen_merge_miners(bigint,bigint) from anon;
grant execute on function public.nextgen_merge_miners(bigint,bigint) to authenticated;
revoke execute on function public.nextgen_assert_economic_capacity_for_expansion(text,numeric) from anon;
grant execute on function public.nextgen_assert_economic_capacity_for_expansion(text,numeric) to authenticated;

commit;
