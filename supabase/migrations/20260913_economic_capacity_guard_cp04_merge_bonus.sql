begin;
-- CP04: close remaining miner-capacity expansion paths.
-- Merge and registration/free starter creation now pass the same CP03 economic guard.

create or replace function public.nextgen_merge_miners(p_first_user_miner_id bigint, p_second_user_miner_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid:=auth.uid(); a public.nextgen_user_miners%rowtype; b public.nextgen_user_miners%rowtype;
  lvl_next public.nextgen_miner_levels%rowtype; lvl_current public.nextgen_miner_levels%rowtype;
  fee public.nextgen_miner_merge_fees%rowtype; w public.nextgen_wallets%rowtype;
  survivor bigint; consumed bigint; new_status text; new_expiry timestamptz; new_energy numeric;
  merge_time timestamptz:=now(); old_hashrate numeric; membership_factor numeric:=1.0;
  old_weight numeric:=0; new_weight numeric:=0; additional_weight numeric:=0;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_first_user_miner_id is null or p_second_user_miner_id is null or p_first_user_miner_id=p_second_user_miner_id then raise exception 'INVALID_MERGE_TARGETS'; end if;
  perform pg_advisory_xact_lock(hashtext('nextgen_merge:'||least(p_first_user_miner_id,p_second_user_miner_id)::text||':'||greatest(p_first_user_miner_id,p_second_user_miner_id)::text));
  select * into a from public.nextgen_user_miners where id=p_first_user_miner_id and user_id=uid for update;
  if not found then raise exception 'MINER_NOT_FOUND'; end if;
  select * into b from public.nextgen_user_miners where id=p_second_user_miner_id and user_id=uid for update;
  if not found then raise exception 'MINER_NOT_FOUND'; end if;
  if a.is_merged or b.is_merged or a.status='merged' or b.status='merged' then raise exception 'MINER_ALREADY_MERGED'; end if;
  if a.miner_id<>b.miner_id or a.current_level<>b.current_level then raise exception 'MERGE_REQUIRES_IDENTICAL_MINERS'; end if;
  if a.current_level>=10 then raise exception 'MAX_LEVEL'; end if;
  select * into lvl_current from public.nextgen_miner_levels where miner_id=a.miner_id and level=a.current_level;
  select * into lvl_next from public.nextgen_miner_levels where miner_id=a.miner_id and level=a.current_level+1;
  if not found or lvl_current.hashrate<=0 or lvl_next.hashrate<=0 then raise exception 'LEVEL_NOT_CONFIGURED'; end if;
  select * into fee from public.nextgen_miner_merge_fees where from_level=a.current_level and to_level=a.current_level+1 and active=true;
  if not found then raise exception 'MERGE_FEE_NOT_CONFIGURED'; end if;
  select * into w from public.nextgen_wallets where user_id=uid for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if w.diamond_balance<fee.fee_diamond then raise exception 'INSUFFICIENT_DIAMOND'; end if;

  select coalesce(p.mining_factor,1.0) into membership_factor
  from public.nextgen_memberships mm join public.nextgen_membership_plans p on p.id=mm.plan_id
  where mm.user_id=uid and mm.status='active' and mm.starts_at<=merge_time and mm.expires_at>merge_time
  order by mm.expires_at desc limit 1;

  old_weight := lvl_current.hashrate*greatest(lvl_current.efficiency,0)*least(greatest(coalesce(a.energy_percent,0),0),100)/100.0*membership_factor
             +  lvl_current.hashrate*greatest(lvl_current.efficiency,0)*least(greatest(coalesce(b.energy_percent,0),0),100)/100.0*membership_factor;
  new_energy := round((a.energy_percent+b.energy_percent)/2.0,2);
  new_weight := lvl_next.hashrate*greatest(lvl_next.efficiency,0)*least(greatest(new_energy,0),100)/100.0*membership_factor;
  additional_weight := greatest(new_weight-old_weight,0);
  if additional_weight>0 then perform public.nextgen_assert_economic_capacity_for_expansion('USDT',additional_weight); end if;

  survivor:=least(a.id,b.id); consumed:=greatest(a.id,b.id); old_hashrate:=lvl_current.hashrate;
  new_expiry:=greatest(a.recharge_expires_at,b.recharge_expires_at);
  new_status:=case when new_expiry>merge_time then 'active' else 'paused' end;

  update public.nextgen_user_miners set current_level=lvl_next.level,total_spent_diamond=a.total_spent_diamond+b.total_spent_diamond+fee.fee_diamond,status=new_status,is_merged=false,merged_into_user_miner_id=null,merged_at=null,merge_fee_diamond=fee.fee_diamond,last_upgrade_at=merge_time,last_recharge_at=greatest(a.last_recharge_at,b.last_recharge_at),recharge_expires_at=new_expiry,energy_percent=new_energy,energy_updated_at=merge_time,last_accrual_at=least(a.last_accrual_at,b.last_accrual_at) where id=survivor;
  update public.nextgen_user_miners set status='merged',is_merged=true,merged_into_user_miner_id=survivor,merged_at=merge_time,merge_fee_diamond=fee.fee_diamond where id=consumed;
  update public.nextgen_wallets set diamond_balance=diamond_balance-fee.fee_diamond,updated_at=merge_time where user_id=uid;
  insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,reference_id,note) values(uid,'miner_merge',-fee.fee_diamond,survivor::text,format('Merged user miners %s + %s into level %s; fee %s Diamond',a.id,b.id,lvl_next.level,fee.fee_diamond));

  return jsonb_build_object('ok',true,'user_miner_id',survivor,'consumed_user_miner_id',consumed,'miner_id',a.miner_id,'from_level',a.current_level,'to_level',lvl_next.level,'hashrate',lvl_next.hashrate,'efficiency',lvl_next.efficiency,'merge_fee_diamond',fee.fee_diamond,'merge_multiplier',round(lvl_next.hashrate/old_hashrate,4),'additional_weighted_hash',additional_weight);
end
$function$;

create or replace function public.nextgen_claim_registration_bonus(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
 v_user auth.users%rowtype; v_campaign public.nextgen_registration_bonus_campaigns%rowtype; v_existing public.nextgen_registration_bonus_claims%rowtype;
 v_identity_hash text; v_identity_exists boolean; v_claim_number integer; v_miner_id bigint; v_claim_type text; v_claim_id bigint; v_remaining integer; v_miner_name text;
 v_membership_factor numeric:=1.0; v_bonus_weight numeric:=0;
begin
 if p_user_id is null then raise exception using errcode='22023',message='USER_ID_REQUIRED'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_user_id then raise exception using errcode='42501',message='USER_CONTEXT_MISMATCH'; end if;
 select * into v_user from auth.users where id=p_user_id; if not found then raise exception using errcode='P0002',message='USER_NOT_FOUND'; end if;
 if v_user.email_confirmed_at is null then raise exception using errcode='42501',message='EMAIL_NOT_VERIFIED'; end if;
 if v_user.email is null or btrim(v_user.email)='' then raise exception using errcode='22023',message='EMAIL_REQUIRED'; end if;
 v_identity_hash:=encode(digest(lower(trim(v_user.email)),'sha256'),'hex');
 select * into v_existing from public.nextgen_registration_bonus_claims where campaign_key='launch-entry-gpu' and user_id=p_user_id limit 1;
 if found then return jsonb_build_object('ok',true,'already_claimed',true,'claim_number',v_existing.claim_number,'claim_type',v_existing.claim_type,'miner_id',v_existing.miner_id); end if;
 select exists(select 1 from public.nextgen_registration_bonus_identities where campaign_key='launch-entry-gpu' and identity_hash=v_identity_hash) into v_identity_exists;
 select * into v_campaign from public.nextgen_registration_bonus_campaigns where campaign_key='launch-entry-gpu' for update; if not found then raise exception using errcode='P0002',message='CAMPAIGN_NOT_FOUND'; end if;
 if v_campaign.enabled and v_campaign.claimed_slots<v_campaign.total_slots and not v_identity_exists then v_claim_number:=v_campaign.claimed_slots+1; v_miner_id:=v_campaign.bonus_miner_id; v_claim_type:='launch_bonus'; else v_claim_number:=null; v_miner_id:=v_campaign.fallback_miner_id; v_claim_type:='fallback_starter'; end if;
 select name into v_miner_name from public.nextgen_miner_catalog where id=v_miner_id and enabled=true; if v_miner_name is null then raise exception using errcode='P0002',message='STARTER_MINER_NOT_AVAILABLE'; end if;
 select coalesce(p.mining_factor,1.0) into v_membership_factor from public.nextgen_memberships mm join public.nextgen_membership_plans p on p.id=mm.plan_id where mm.user_id=p_user_id and mm.status='active' and mm.starts_at<=now() and mm.expires_at>now() order by mm.expires_at desc limit 1;
 select coalesce(m.base_hashrate,0)*greatest(coalesce(ml.efficiency,1),0)*v_membership_factor into v_bonus_weight from public.nextgen_miner_catalog m join public.nextgen_miner_levels ml on ml.miner_id=m.id and ml.level=1 where m.id=v_miner_id;
 if v_bonus_weight>0 then perform public.nextgen_assert_economic_capacity_for_expansion('USDT',v_bonus_weight); end if;
 if v_claim_type='launch_bonus' then update public.nextgen_registration_bonus_campaigns set claimed_slots=v_claim_number,enabled=case when v_claim_number>=total_slots then false else enabled end,ended_at=case when v_claim_number>=total_slots then coalesce(ended_at,now()) else ended_at end,updated_at=now() where campaign_key=v_campaign.campaign_key; end if;
 begin
   insert into public.nextgen_registration_bonus_claims(campaign_key,user_id,claim_type,claim_number,miner_id,metadata) values(v_campaign.campaign_key,p_user_id,v_claim_type,v_claim_number,v_miner_id,jsonb_build_object('source','auth_email_verified','verified_at',v_user.email_confirmed_at,'identity_protected',true)) returning id into v_claim_id;
   if not v_identity_exists then insert into public.nextgen_registration_bonus_identities(campaign_key,identity_hash,first_user_id,first_claim_id,claimed_at) values(v_campaign.campaign_key,v_identity_hash,p_user_id,v_claim_id,now()); end if;
   insert into public.nextgen_user_miners(user_id,miner_id,current_level,status,total_spent_diamond) values(p_user_id,v_miner_id,1,'active',0) on conflict(user_id,miner_id) do nothing;
   insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,usd_delta,asset,network,crypto_amount,reference_id,note) values(p_user_id,'bonus_miner',0,0,'diamond','internal',0,v_claim_id,case when v_claim_type='launch_bonus' then 'Launch bonus miner: Entry GPU' else 'Fallback starter miner: Basic CPU' end);
 exception when unique_violation then
   select * into v_existing from public.nextgen_registration_bonus_claims where campaign_key=v_campaign.campaign_key and user_id=p_user_id limit 1;
   if found then return jsonb_build_object('ok',true,'already_claimed',true,'claim_number',v_existing.claim_number,'claim_type',v_existing.claim_type,'miner_id',v_existing.miner_id); end if;
   raise;
 end;
 v_remaining:=greatest(0,v_campaign.total_slots-v_campaign.claimed_slots);
 return jsonb_build_object('ok',true,'already_claimed',false,'claim_number',v_claim_number,'claim_type',v_claim_type,'miner_id',v_miner_id,'miner_name',v_miner_name,'remaining_slots',v_remaining);
end;
$function$;

revoke execute on function public.nextgen_merge_miners(bigint,bigint) from anon;
revoke execute on function public.nextgen_claim_registration_bonus(uuid) from anon;
commit;
