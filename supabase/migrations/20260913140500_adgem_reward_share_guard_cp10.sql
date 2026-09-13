-- CP10: AdGem reward share hard guard.
-- Production already applied; keep this file in GitHub for migration parity.
-- User reward may not exceed 25% of provider payout.
-- With NextGen denomination 10,000 Diamond = $1, configure AdGem at 2,500 Diamond / $1 payout.

create or replace function public.nextgen_process_adgem_reward(
  p_request_id text,
  p_conversion_id text,
  p_player_id uuid,
  p_campaign_id text,
  p_payout_usd numeric,
  p_amount_diamond numeric,
  p_event_timestamp bigint,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_provider public.nextgen_offer_providers%rowtype;
  v_offer public.nextgen_offers%rowtype;
  v_existing public.nextgen_offer_completions%rowtype;
  v_wallet numeric;
  v_reward_id bigint;
  v_completion_id bigint;
  v_revenue_event_id bigint;
  v_diamond_per_usd numeric;
  v_user_reward_usd numeric;
  v_source_ref text;
  v_reward_ref text;
  v_event_date date;
begin
  if coalesce(length(trim(p_request_id)),0)=0 then raise exception 'ADGEM_REQUEST_ID_REQUIRED'; end if;
  if coalesce(length(trim(p_conversion_id)),0)=0 then raise exception 'ADGEM_CONVERSION_ID_REQUIRED'; end if;
  if p_player_id is null then raise exception 'ADGEM_PLAYER_REQUIRED'; end if;
  if coalesce(length(trim(p_campaign_id)),0)=0 then raise exception 'ADGEM_CAMPAIGN_REQUIRED'; end if;
  if p_payout_usd is null or p_payout_usd<=0 then raise exception 'ADGEM_INVALID_PAYOUT'; end if;
  if p_amount_diamond is null or p_amount_diamond<=0 then raise exception 'ADGEM_INVALID_REWARD'; end if;
  if p_event_timestamp is null or p_event_timestamp<=0 then raise exception 'ADGEM_TIMESTAMP_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtext('nextgen_adgem_conversion:'||trim(p_conversion_id)));

  select * into v_provider from public.nextgen_offer_providers where lower(provider_key)='adgem' and enabled=true limit 1;
  if not found then raise exception 'ADGEM_PROVIDER_DISABLED'; end if;

  select * into v_existing from public.nextgen_offer_completions where external_reference='adgem:'||trim(p_conversion_id) limit 1;
  if found then
    if v_existing.user_id<>p_player_id then raise exception 'ADGEM_CONVERSION_USER_MISMATCH'; end if;
    return jsonb_build_object('ok',true,'idempotent',true,'completion_id',v_existing.id,'status',v_existing.status,'conversion_id',p_conversion_id);
  end if;

  perform 1 from auth.users where id=p_player_id;
  if not found then raise exception 'ADGEM_PLAYER_NOT_FOUND'; end if;

  select * into v_offer from public.nextgen_offers where provider_id=v_provider.id and external_offer_id=trim(p_campaign_id) and enabled=true limit 1;
  if not found then raise exception 'ADGEM_OFFER_NOT_CONFIGURED'; end if;

  select diamond_per_usd into v_diamond_per_usd from public.nextgen_economy_settings where id=true;
  if v_diamond_per_usd is null or v_diamond_per_usd<=0 then raise exception 'DIAMOND_DENOMINATION_INVALID'; end if;

  v_user_reward_usd:=round(p_amount_diamond/v_diamond_per_usd,8);
  if v_user_reward_usd>p_payout_usd*0.25+0.00000001 then
    raise exception using errcode='P0001',message='ADGEM_REWARD_SHARE_EXCEEDS_25PCT',detail=jsonb_build_object('payout_usd',p_payout_usd,'amount_diamond',p_amount_diamond,'diamond_per_usd',v_diamond_per_usd,'user_reward_usd',v_user_reward_usd,'max_user_reward_usd',round(p_payout_usd*0.25,8))::text;
  end if;

  v_source_ref:='adgem:'||trim(p_conversion_id);
  v_reward_ref:='adgem:'||trim(p_conversion_id);
  v_event_date:=timezone('utc',to_timestamp(p_event_timestamp))::date;

  insert into public.nextgen_offer_completions(user_id,offer_id,external_reference,status,revenue_usd,reward_diamond)
  values (p_player_id,v_offer.id,v_source_ref,'posted',round(p_payout_usd,8),round(p_amount_diamond,8))
  returning id into v_completion_id;

  insert into public.nextgen_reward_ledger(user_id,source_key,amount_diamond,external_reference,status,metadata)
  values (p_player_id,'adgem',round(p_amount_diamond,8),v_reward_ref,'posted',coalesce(p_payload,'{}'::jsonb)||jsonb_build_object('provider','adgem','request_id',trim(p_request_id),'conversion_id',trim(p_conversion_id),'campaign_id',trim(p_campaign_id),'payout_usd',round(p_payout_usd,8),'diamond_per_usd',v_diamond_per_usd,'user_reward_usd',v_user_reward_usd,'reward_share_bps',2500))
  returning id into v_reward_id;

  insert into public.nextgen_monetization_revenue_events(event_date,source_type,source_reference,gross_revenue_usd,user_reward_usd,net_revenue_usd,status,metadata,provider_key,recoverable_at,reconciliation_note)
  values (v_event_date,'offerwall',v_source_ref,round(p_payout_usd,8),v_user_reward_usd,round(p_payout_usd-v_user_reward_usd,8),'settled',coalesce(p_payload,'{}'::jsonb)||jsonb_build_object('provider','adgem','request_id',trim(p_request_id),'conversion_id',trim(p_conversion_id),'campaign_id',trim(p_campaign_id),'offer_id',v_offer.id,'reward_ledger_id',v_reward_id,'offer_completion_id',v_completion_id,'reward_share_bps',2500),'adgem',now(),'AdGem signed payable conversion accepted as recoverable.')
  returning id into v_revenue_event_id;

  insert into public.nextgen_wallets(user_id,diamond_balance,reserved_diamond) values(p_player_id,0,0) on conflict(user_id) do nothing;
  update public.nextgen_wallets set diamond_balance=diamond_balance+round(p_amount_diamond,8),updated_at=now() where user_id=p_player_id returning diamond_balance into v_wallet;
  if v_wallet is null then raise exception 'ADGEM_WALLET_UPDATE_FAILED'; end if;

  return jsonb_build_object('ok',true,'idempotent',false,'provider','adgem','request_id',p_request_id,'conversion_id',p_conversion_id,'completion_id',v_completion_id,'reward_ledger_id',v_reward_id,'revenue_event_id',v_revenue_event_id,'user_reward_diamond',round(p_amount_diamond,8),'user_reward_usd',v_user_reward_usd,'gross_revenue_usd',round(p_payout_usd,8),'net_recoverable_revenue_usd',round(p_payout_usd-v_user_reward_usd,8),'diamond_balance',v_wallet,'reward_share_bps',2500);
end;
$function$;

revoke execute on function public.nextgen_process_adgem_reward(text,text,uuid,text,numeric,numeric,bigint,jsonb) from public;
grant execute on function public.nextgen_process_adgem_reward(text,text,uuid,text,numeric,numeric,bigint,jsonb) to service_role;
