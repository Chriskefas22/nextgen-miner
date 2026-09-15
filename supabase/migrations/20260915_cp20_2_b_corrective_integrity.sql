-- CP20.2-B corrective integrity follow-up.
-- Fixes production-discovered NULL membership defaults and quest snapshot ambiguity.

begin;

create or replace function public.nextgen_purchase_miner(p_miner_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid:=auth.uid();
  m public.nextgen_miner_catalog%rowtype;
  w public.nextgen_wallets%rowtype;
  new_id bigint;
  projected_weight numeric := 0;
  membership_factor numeric := 1.0;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into m from public.nextgen_miner_catalog where id=p_miner_id and enabled=true for update;
  if not found then raise exception 'MINER_NOT_FOUND'; end if;
  if m.base_price_diamond=0 and exists(select 1 from public.nextgen_user_miners um where um.user_id=uid and um.miner_id=p_miner_id and um.is_merged=false) then raise exception 'FREE_MINER_ALREADY_CLAIMED'; end if;
  if m.base_price_diamond>0 then
    select * into w from public.nextgen_wallets where user_id=uid for update;
    if not found or coalesce(w.diamond_balance,0)<m.base_price_diamond then raise exception 'INSUFFICIENT_DIAMOND'; end if;
  end if;
  select coalesce(p.mining_factor,1.0) into membership_factor
  from public.nextgen_memberships mm join public.nextgen_membership_plans p on p.id=mm.plan_id
  where mm.user_id=uid and mm.status='active' and mm.starts_at<=now() and mm.expires_at>now()
  order by mm.expires_at desc limit 1;
  membership_factor:=coalesce(membership_factor,1.0);
  projected_weight:=greatest(coalesce(m.base_hashrate,0),0)*greatest(membership_factor,0);
  if projected_weight>0 then perform public.nextgen_assert_economic_capacity_for_expansion('USDT',projected_weight); end if;
  if m.base_price_diamond>0 then update public.nextgen_wallets set diamond_balance=diamond_balance-m.base_price_diamond,updated_at=now() where user_id=uid; end if;
  insert into public.nextgen_user_miners(user_id,miner_id,current_level,total_spent_diamond,status,is_merged)
  values(uid,p_miner_id,1,m.base_price_diamond,'active',false) returning id into new_id;
  insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,reference_id,note)
  values(uid,'miner_purchase',-m.base_price_diamond,new_id::text,case when m.base_price_diamond=0 then 'Free starter miner claim' else 'Miner purchase and activation' end);
  return jsonb_build_object('ok',true,'user_miner_id',new_id,'miner_id',p_miner_id,'level',1,'hashrate',m.base_hashrate,'price_diamond',m.base_price_diamond);
end;
$function$;

create or replace function public.nextgen_upgrade_miner(p_user_miner_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare uid uuid:=auth.uid(); um public.nextgen_user_miners%rowtype; lvl public.nextgen_miner_levels%rowtype; w public.nextgen_wallets%rowtype; discount_bps integer:=0; final_price numeric; saved numeric; membership_factor numeric:=1.0; old_weight numeric:=0; next_weight numeric:=0;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into um from public.nextgen_user_miners where id=p_user_miner_id and user_id=uid for update;
  if not found then raise exception 'MINER_NOT_FOUND'; end if;
  if um.is_merged or um.status='merged' then raise exception 'MINER_ALREADY_MERGED'; end if;
  if um.current_level>=10 then raise exception 'MAX_LEVEL'; end if;
  select * into lvl from public.nextgen_miner_levels where miner_id=um.miner_id and level=um.current_level+1;
  if not found then raise exception 'LEVEL_NOT_CONFIGURED'; end if;
  select coalesce(p.upgrade_discount_bps,0),coalesce(p.mining_factor,1.0) into discount_bps,membership_factor
  from public.nextgen_memberships m join public.nextgen_membership_plans p on p.id=m.plan_id
  where m.user_id=uid and m.status='active' and m.starts_at<=now() and m.expires_at>now()
  order by m.expires_at desc limit 1;
  discount_bps:=coalesce(discount_bps,0); membership_factor:=coalesce(membership_factor,1.0);
  final_price:=round(coalesce(lvl.upgrade_price_diamond,0)*(10000-discount_bps)/10000.0,4); saved:=coalesce(lvl.upgrade_price_diamond,0)-final_price;
  select * into w from public.nextgen_wallets where user_id=uid for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if coalesce(w.diamond_balance,0)<final_price then raise exception 'INSUFFICIENT_DIAMOND'; end if;
  old_weight:=coalesce((select ml2.hashrate*greatest(ml2.efficiency,0)*least(greatest(coalesce(um.energy_percent,0),0),100)/100.0*membership_factor from public.nextgen_miner_levels ml2 where ml2.miner_id=um.miner_id and ml2.level=um.current_level),0);
  next_weight:=coalesce(lvl.hashrate,0)*greatest(coalesce(lvl.efficiency,0),0)*least(greatest(coalesce(um.energy_percent,0),0),100)/100.0*membership_factor;
  if coalesce(um.reward_class,'standard')<>'free_bonus' then perform public.nextgen_assert_economic_capacity_for_expansion('USDT',greatest(next_weight-old_weight,0)); end if;
  update public.nextgen_wallets set diamond_balance=diamond_balance-final_price,updated_at=now() where user_id=uid;
  update public.nextgen_user_miners set current_level=lvl.level,total_spent_diamond=total_spent_diamond+final_price,last_upgrade_at=now() where id=um.id;
  insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,reference_id,note) values(uid,'miner_upgrade',-final_price,p_user_miner_id::text,'Miner level upgrade');
  return jsonb_build_object('ok',true,'level',lvl.level,'hashrate',lvl.hashrate,'upgrade_price_diamond',final_price,'discount_bps',discount_bps,'saved_diamond',saved,'reward_class',coalesce(um.reward_class,'standard'));
end;
$function$;

create or replace function public.nextgen_merge_miners(p_first_user_miner_id bigint,p_second_user_miner_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare uid uuid:=auth.uid(); a public.nextgen_user_miners%rowtype; b public.nextgen_user_miners%rowtype; lvl_next public.nextgen_miner_levels%rowtype; lvl_current public.nextgen_miner_levels%rowtype; fee public.nextgen_miner_merge_fees%rowtype; w public.nextgen_wallets%rowtype; survivor bigint; consumed bigint; new_status text; new_expiry timestamptz; new_energy numeric; merge_time timestamptz:=now(); old_hashrate numeric; membership_factor numeric:=1.0; old_weight numeric:=0; new_weight numeric:=0; additional_weight numeric:=0;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if; if p_first_user_miner_id is null or p_second_user_miner_id is null or p_first_user_miner_id=p_second_user_miner_id then raise exception 'INVALID_MERGE_TARGETS'; end if;
 perform pg_advisory_xact_lock(hashtext('nextgen_merge:'||least(p_first_user_miner_id,p_second_user_miner_id)::text||':'||greatest(p_first_user_miner_id,p_second_user_miner_id)::text));
 select * into a from public.nextgen_user_miners where id=p_first_user_miner_id and user_id=uid for update; if not found then raise exception 'MINER_NOT_FOUND'; end if;
 select * into b from public.nextgen_user_miners where id=p_second_user_miner_id and user_id=uid for update; if not found then raise exception 'MINER_NOT_FOUND'; end if;
 if a.is_merged or b.is_merged or a.status='merged' or b.status='merged' then raise exception 'MINER_ALREADY_MERGED'; end if; if a.miner_id<>b.miner_id or a.current_level<>b.current_level then raise exception 'MERGE_REQUIRES_IDENTICAL_MINERS'; end if; if a.current_level>=10 then raise exception 'MAX_LEVEL'; end if;
 select * into lvl_current from public.nextgen_miner_levels where miner_id=a.miner_id and level=a.current_level; select * into lvl_next from public.nextgen_miner_levels where miner_id=a.miner_id and level=a.current_level+1; if not found or lvl_current.hashrate<=0 or lvl_next.hashrate<=0 then raise exception 'LEVEL_NOT_CONFIGURED'; end if;
 select * into fee from public.nextgen_miner_merge_fees where from_level=a.current_level and to_level=a.current_level+1 and active=true; if not found then raise exception 'MERGE_FEE_NOT_CONFIGURED'; end if;
 select * into w from public.nextgen_wallets where user_id=uid for update; if not found then raise exception 'WALLET_NOT_FOUND'; end if; if coalesce(w.diamond_balance,0)<fee.fee_diamond then raise exception 'INSUFFICIENT_DIAMOND'; end if;
 select coalesce(p.mining_factor,1.0) into membership_factor from public.nextgen_memberships mm join public.nextgen_membership_plans p on p.id=mm.plan_id where mm.user_id=uid and mm.status='active' and mm.starts_at<=merge_time and mm.expires_at>merge_time order by mm.expires_at desc limit 1; membership_factor:=coalesce(membership_factor,1.0);
 old_weight:=lvl_current.hashrate*greatest(lvl_current.efficiency,0)*least(greatest(coalesce(a.energy_percent,0),0),100)/100.0*membership_factor+lvl_current.hashrate*greatest(lvl_current.efficiency,0)*least(greatest(coalesce(b.energy_percent,0),0),100)/100.0*membership_factor;
 new_energy:=round((coalesce(a.energy_percent,0)+coalesce(b.energy_percent,0))/2.0,2); new_weight:=lvl_next.hashrate*greatest(lvl_next.efficiency,0)*least(greatest(new_energy,0),100)/100.0*membership_factor; additional_weight:=greatest(new_weight-old_weight,0);
 if additional_weight>0 and coalesce(a.reward_class,'standard')<>'free_bonus' then perform public.nextgen_assert_economic_capacity_for_expansion('USDT',additional_weight); end if;
 survivor:=least(a.id,b.id); consumed:=greatest(a.id,b.id); old_hashrate:=lvl_current.hashrate; new_expiry:=greatest(a.recharge_expires_at,b.recharge_expires_at); new_status:=case when new_expiry>merge_time then 'active' else 'paused' end;
 update public.nextgen_user_miners set current_level=lvl_next.level,total_spent_diamond=a.total_spent_diamond+b.total_spent_diamond+fee.fee_diamond,status=new_status,is_merged=false,merged_into_user_miner_id=null,merged_at=null,merge_fee_diamond=fee.fee_diamond,last_upgrade_at=merge_time,last_recharge_at=greatest(a.last_recharge_at,b.last_recharge_at),recharge_expires_at=new_expiry,energy_percent=new_energy,energy_updated_at=merge_time,last_accrual_at=least(a.last_accrual_at,b.last_accrual_at),reward_class=case when coalesce(a.reward_class,'standard')='free_bonus' and coalesce(b.reward_class,'standard')='free_bonus' then 'free_bonus' else coalesce(a.reward_class,'standard') end,free_bonus_recovered_usd=case when coalesce(a.reward_class,'standard')='free_bonus' and coalesce(b.reward_class,'standard')='free_bonus' then coalesce(a.free_bonus_recovered_usd,0)+coalesce(b.free_bonus_recovered_usd,0) else coalesce(a.free_bonus_recovered_usd,0) end where id=survivor;
 update public.nextgen_user_miners set status='merged',is_merged=true,merged_into_user_miner_id=survivor,merged_at=merge_time,merge_fee_diamond=fee.fee_diamond where id=consumed;
 update public.nextgen_wallets set diamond_balance=diamond_balance-fee.fee_diamond,updated_at=merge_time where user_id=uid;
 insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,reference_id,note) values(uid,'miner_merge',-fee.fee_diamond,survivor::text,format('Merged user miners %s + %s into level %s; fee %s Diamond',a.id,b.id,lvl_next.level,fee.fee_diamond));
 return jsonb_build_object('ok',true,'user_miner_id',survivor,'consumed_user_miner_id',consumed,'miner_id',a.miner_id,'from_level',a.current_level,'to_level',lvl_next.level,'hashrate',lvl_next.hashrate,'efficiency',lvl_next.efficiency,'merge_fee_diamond',fee.fee_diamond,'merge_multiplier',round(lvl_next.hashrate/old_hashrate,4),'additional_weighted_hash',additional_weight,'reward_class',case when coalesce(a.reward_class,'standard')='free_bonus' and coalesce(b.reward_class,'standard')='free_bonus' then 'free_bonus' else coalesce(a.reward_class,'standard') end);
end;
$function$;

create or replace function public.nextgen_quests_snapshot()
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare uid uuid:=auth.uid(); period_start timestamptz:=date_trunc('day',now()); period_end timestamptz:=period_start+interval '1 day'; v_period_key text:=to_char(period_start,'YYYY-MM-DD'); result jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 with quest_progress as (
  select q.id,q.quest_key,q.title,q.description,q.target_count,q.reward_diamond,q.period,coalesce(uq.progress,0) stored_progress,uq.claimed_at,
    case q.quest_key
      when 'faucet_20' then (select count(*)::numeric from public.nextgen_faucet_claims fc where fc.user_id=uid and fc.claimed_at>=period_start and fc.claimed_at<period_end)
      when 'offer_5' then (select count(*)::numeric from public.nextgen_offer_completions oc where oc.user_id=uid and lower(oc.status)='posted' and oc.created_at>=period_start and oc.created_at<period_end)
      when 'ptc_100' then (select count(*)::numeric from public.nextgen_ptc_sessions ps where ps.user_id=uid and lower(ps.status)='completed' and coalesce(ps.completed_at,ps.started_at)>=period_start and coalesce(ps.completed_at,ps.started_at)<period_end)
      when 'shortlink_10' then (select count(*)::numeric from public.nextgen_shortlink_completions sc where sc.user_id=uid and lower(sc.status)='posted' and sc.created_at>=period_start and sc.created_at<period_end)
      else coalesce(uq.progress,0) end measured_progress,
    v_period_key snapshot_period_key
  from public.nextgen_quests q left join public.nextgen_user_quests uq on uq.user_id=uid and uq.quest_id=q.id and uq.period_key=v_period_key where q.enabled=true
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'quest_key',quest_key,'title',title,'description',description,'target_count',target_count,'reward_diamond',reward_diamond,'period',period,'progress',least(measured_progress,target_count),'claimed_at',claimed_at,'period_key',snapshot_period_key) order by id),'[]'::jsonb) into result from quest_progress;
 return jsonb_build_object('period_key',v_period_key,'quests',result);
end;
$function$;

commit;
