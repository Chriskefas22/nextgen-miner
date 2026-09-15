-- CP20.1 — Final Source/DB/Deployment Synchronization
-- Applied to Supabase project mmqprhuvhghyuvudsyma.
-- This migration makes the registration bonus grant its actual free miner entitlement
-- and exposes the authenticated faucet snapshot used by the synced UI.

create or replace function public.nextgen_claim_registration_bonus(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_campaign public.nextgen_registration_bonus_campaigns%rowtype;
  v_claim public.nextgen_registration_bonus_claims%rowtype;
  v_identity_hash text;
  v_user_miner_id bigint;
  v_existing_bonus_count integer := 0;
begin
  if v_uid is null or p_user_id is null or v_uid <> p_user_id then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtext('nextgen_registration_bonus:' || v_uid::text));

  select * into v_campaign
  from public.nextgen_registration_bonus_campaigns
  where campaign_key = 'launch-entry-gpu'
    and enabled = true
    and started_at <= now()
    and (ended_at is null or ended_at > now())
  for update;

  if not found then raise exception 'BONUS_CAMPAIGN_UNAVAILABLE'; end if;

  v_identity_hash := encode(digest(v_uid::text, 'sha256'), 'hex');

  if exists (
    select 1 from public.nextgen_registration_bonus_identities
    where campaign_key = v_campaign.campaign_key
      and identity_hash = v_identity_hash
  ) then
    raise exception 'BONUS_ALREADY_CLAIMED';
  end if;

  if exists (
    select 1 from public.nextgen_registration_bonus_claims
    where campaign_key = v_campaign.campaign_key
      and user_id = v_uid
  ) then
    raise exception 'BONUS_ALREADY_CLAIMED';
  end if;

  if v_campaign.claimed_slots >= v_campaign.total_slots then
    raise exception 'BONUS_SLOTS_EXHAUSTED';
  end if;

  insert into public.nextgen_registration_bonus_claims(
    campaign_key, user_id, claim_type, claim_number, miner_id, metadata
  ) values (
    v_campaign.campaign_key,
    v_uid,
    'launch_bonus',
    v_campaign.claimed_slots + 1,
    v_campaign.bonus_miner_id,
    jsonb_build_object('source', 'cp20.1', 'reward_class', 'free_bonus')
  ) returning * into v_claim;

  insert into public.nextgen_registration_bonus_identities(
    campaign_key, identity_hash, first_user_id, first_claim_id
  ) values (
    v_campaign.campaign_key, v_identity_hash, v_uid, v_claim.id
  );

  select count(*)::integer into v_existing_bonus_count
  from public.nextgen_user_miners
  where user_id = v_uid
    and reward_class = 'free_bonus'
    and is_merged = false;

  if v_existing_bonus_count > 0 then
    raise exception 'BONUS_MINER_ALREADY_PRESENT';
  end if;

  insert into public.nextgen_user_miners(
    user_id,
    miner_id,
    current_level,
    total_spent_diamond,
    status,
    is_merged,
    reward_class,
    free_bonus_recovered_usd
  ) values (
    v_uid,
    v_campaign.bonus_miner_id,
    1,
    0,
    'active',
    false,
    'free_bonus',
    0
  ) returning id into v_user_miner_id;

  update public.nextgen_registration_bonus_campaigns
  set claimed_slots = claimed_slots + 1,
      updated_at = now()
  where campaign_key = v_campaign.campaign_key;

  insert into public.nextgen_transactions(
    user_id, tx_type, diamond_delta, reference_id, note
  ) values (
    v_uid,
    'registration_bonus',
    0,
    v_claim.id::text,
    'Registration bonus: free bonus miner'
  );

  return jsonb_build_object(
    'ok', true,
    'claim_id', v_claim.id,
    'campaign_key', v_campaign.campaign_key,
    'miner_id', v_claim.miner_id,
    'user_miner_id', v_user_miner_id,
    'reward_class', 'free_bonus',
    'claimed_slots', v_campaign.claimed_slots + 1,
    'remaining_slots', greatest(v_campaign.total_slots - v_campaign.claimed_slots - 1, 0)
  );
end;
$function$;

revoke execute on function public.nextgen_claim_registration_bonus(uuid) from anon, public;
grant execute on function public.nextgen_claim_registration_bonus(uuid) to authenticated, postgres;

create or replace function public.nextgen_faucet_snapshot()
returns jsonb
language plpgsql
security definer
stable
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  cfg public.nextgen_faucet_settings%rowtype;
  last_claim_at timestamptz;
  daily_used numeric := 0;
  next_claim_at timestamptz := null;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into cfg
  from public.nextgen_faucet_settings
  where id = true;

  if not found then raise exception 'FAUCET_CONFIG_NOT_FOUND'; end if;

  select max(claimed_at) into last_claim_at
  from public.nextgen_faucet_claims
  where user_id = uid;

  select coalesce(sum(reward_diamond), 0) into daily_used
  from public.nextgen_faucet_claims
  where user_id = uid
    and claimed_at >= date_trunc('day', now())
    and claimed_at < date_trunc('day', now()) + interval '1 day';

  if last_claim_at is not null then
    next_claim_at := last_claim_at + make_interval(secs => cfg.cooldown_seconds);
  end if;

  return jsonb_build_object(
    'enabled', cfg.enabled,
    'reward_diamond', cfg.reward_diamond,
    'cooldown_seconds', cfg.cooldown_seconds,
    'daily_cap_diamond', cfg.daily_cap_diamond,
    'daily_used', daily_used,
    'last_claim_at', last_claim_at,
    'next_claim_at', next_claim_at,
    'can_claim', cfg.enabled
      and daily_used + cfg.reward_diamond <= cfg.daily_cap_diamond
      and (next_claim_at is null or next_claim_at <= now())
  );
end;
$function$;

revoke execute on function public.nextgen_faucet_snapshot() from anon, public;
grant execute on function public.nextgen_faucet_snapshot() to authenticated, postgres;
