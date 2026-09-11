-- Landing live telemetry + protected registration bonus access
create or replace function public.nextgen_get_landing_telemetry()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_active_miners integer;
  v_total_hashrate numeric;
  v_enabled_networks integer;
  v_enabled_catalog integer;
begin
  select count(*)::integer into v_active_miners
  from public.nextgen_user_miners
  where status = 'active';

  select coalesce(sum(ml.hashrate), 0)::numeric into v_total_hashrate
  from public.nextgen_user_miners um
  join public.nextgen_miner_levels ml
    on ml.miner_id = um.miner_id
   and ml.level = um.current_level
  where um.status = 'active';

  select count(*)::integer into v_enabled_networks
  from public.nextgen_crypto_networks
  where enabled = true;

  select count(*)::integer into v_enabled_catalog
  from public.nextgen_miner_catalog
  where enabled = true;

  return jsonb_build_object(
    'ok', true,
    'active_miners', v_active_miners,
    'total_hashrate_hs', v_total_hashrate,
    'enabled_networks', v_enabled_networks,
    'enabled_miners', v_enabled_catalog,
    'generated_at', now()
  );
end;
$function$;

grant execute on function public.nextgen_get_landing_telemetry() to anon, authenticated;

create or replace function public.nextgen_claim_registration_bonus(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
 v_user auth.users%rowtype; v_campaign public.nextgen_registration_bonus_campaigns%rowtype; v_existing public.nextgen_registration_bonus_claims%rowtype;
 v_identity_hash text; v_identity_exists boolean; v_claim_number integer; v_miner_id bigint; v_claim_type text; v_claim_id bigint; v_remaining integer; v_miner_name text;
begin
 if p_user_id is null then raise exception using errcode='22023',message='USER_ID_REQUIRED'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_user_id then raise exception using errcode='42501',message='USER_CONTEXT_MISMATCH'; end if;
 select * into v_user from auth.users where id=p_user_id;
 if not found then raise exception using errcode='P0002',message='USER_NOT_FOUND'; end if;
 if v_user.email_confirmed_at is null then raise exception using errcode='42501',message='EMAIL_NOT_VERIFIED'; end if;
 if v_user.email is null or btrim(v_user.email)='' then raise exception using errcode='22023',message='EMAIL_REQUIRED'; end if;
 v_identity_hash:=encode(digest(lower(trim(v_user.email)),'sha256'),'hex');

 select * into v_existing
 from public.nextgen_registration_bonus_claims
 where campaign_key='launch-entry-gpu' and user_id=p_user_id
 limit 1;

 if found then
   return jsonb_build_object(
     'ok',true,
     'already_claimed',true,
     'claim_number',v_existing.claim_number,
     'claim_type',v_existing.claim_type,
     'miner_id',v_existing.miner_id
   );
 end if;

 select exists(
   select 1
   from public.nextgen_registration_bonus_identities
   where campaign_key='launch-entry-gpu'
     and identity_hash=v_identity_hash
 ) into v_identity_exists;

 select * into v_campaign
 from public.nextgen_registration_bonus_campaigns
 where campaign_key='launch-entry-gpu'
 for update;

 if not found then raise exception using errcode='P0002',message='CAMPAIGN_NOT_FOUND'; end if;

 if v_campaign.enabled
    and v_campaign.claimed_slots<v_campaign.total_slots
    and not v_identity_exists then

   v_claim_number:=v_campaign.claimed_slots+1;
   v_miner_id:=v_campaign.bonus_miner_id;
   v_claim_type:='launch_bonus';

   update public.nextgen_registration_bonus_campaigns
   set claimed_slots=v_claim_number,
       enabled=case when v_claim_number>=total_slots then false else enabled end,
       ended_at=case when v_claim_number>=total_slots then coalesce(ended_at,now()) else ended_at end,
       updated_at=now()
   where campaign_key=v_campaign.campaign_key;
 else
   v_claim_number:=null;
   v_miner_id:=v_campaign.fallback_miner_id;
   v_claim_type:='fallback_starter';
 end if;

 select name into v_miner_name
 from public.nextgen_miner_catalog
 where id=v_miner_id and enabled=true;

 if v_miner_name is null then
   raise exception using errcode='P0002',message='STARTER_MINER_NOT_AVAILABLE';
 end if;

 begin
   insert into public.nextgen_registration_bonus_claims(
     campaign_key,user_id,claim_type,claim_number,miner_id,metadata
   )
   values(
     v_campaign.campaign_key,
     p_user_id,
     v_claim_type,
     v_claim_number,
     v_miner_id,
     jsonb_build_object(
       'source','auth_email_verified',
       'verified_at',v_user.email_confirmed_at,
       'identity_protected',true
     )
   )
   returning id into v_claim_id;

   if not v_identity_exists then
     insert into public.nextgen_registration_bonus_identities(
       campaign_key,identity_hash,first_user_id,first_claim_id,claimed_at
     )
     values(
       v_campaign.campaign_key,
       v_identity_hash,
       p_user_id,
       v_claim_id,
       now()
     );
   end if;

   insert into public.nextgen_user_miners(
     user_id,miner_id,current_level,status,total_spent_diamond
   )
   values(p_user_id,v_miner_id,1,'active',0)
   on conflict(user_id,miner_id) do nothing;

   insert into public.nextgen_transactions(
     user_id,tx_type,diamond_delta,usd_delta,asset,network,crypto_amount,reference_id,note
   )
   values(
     p_user_id,
     'bonus_miner',
     0,0,'diamond','internal',0,v_claim_id,
     case when v_claim_type='launch_bonus'
          then 'Launch bonus miner: Entry GPU'
          else 'Fallback starter miner: Basic CPU'
     end
   );
 exception when unique_violation then
   select * into v_existing
   from public.nextgen_registration_bonus_claims
   where campaign_key=v_campaign.campaign_key
     and user_id=p_user_id
   limit 1;

   if found then
     return jsonb_build_object(
       'ok',true,
       'already_claimed',true,
       'claim_number',v_existing.claim_number,
       'claim_type',v_existing.claim_type,
       'miner_id',v_existing.miner_id
     );
   end if;
   raise;
 end;

 v_remaining:=greatest(0,v_campaign.total_slots-v_campaign.claimed_slots);

 return jsonb_build_object(
   'ok',true,
   'already_claimed',false,
   'claim_number',v_claim_number,
   'claim_type',v_claim_type,
   'miner_id',v_miner_id,
   'miner_name',v_miner_name,
   'remaining_slots',v_remaining
 );
end;
$function$;

grant execute on function public.nextgen_get_registration_bonus_status() to anon, authenticated;
grant execute on function public.nextgen_claim_registration_bonus(uuid) to authenticated;
revoke execute on function public.nextgen_claim_registration_bonus(uuid) from anon;
