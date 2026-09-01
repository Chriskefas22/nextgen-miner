-- NextGen Miner
-- Security hardening for the production Supabase schema.
-- Applied to production on 2026-09-01.
-- This migration records privilege changes only.
-- It does not mutate user/business data.

begin;

-- Client roles must not have destructive table privileges.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Public catalog data.
grant select on public.nextgen_miner_catalog,
  public.nextgen_miner_levels
  to anon, authenticated;

-- Authenticated read-only reference/config data.
grant select on public.nextgen_deposit_destinations,
  public.nextgen_economy_settings,
  public.nextgen_exchange_rates,
  public.nextgen_faucet_settings,
  public.nextgen_mining_pool_settings,
  public.nextgen_offer_providers,
  public.nextgen_offers,
  public.nextgen_ptc_campaigns,
  public.nextgen_quests,
  public.nextgen_shortlink_campaigns,
  public.nextgen_supported_crypto_assets
  to authenticated;

-- Authenticated reads governed by RLS ownership/policy.
grant select on public.nextgen_admins,
  public.nextgen_deposits,
  public.nextgen_faucet_claims,
  public.nextgen_offer_completions,
  public.nextgen_ptc_sessions,
  public.nextgen_referrals,
  public.nextgen_reward_ledger,
  public.nextgen_shortlink_completions,
  public.nextgen_transactions,
  public.nextgen_user_miners,
  public.nextgen_user_quests,
  public.nextgen_wallets,
  public.nextgen_withdrawals
  to authenticated;

-- Administrative/security helper functions are not client endpoints.
revoke execute on function public.nextgen_is_admin()
  from anon, authenticated;

revoke execute on function public.nextgen_is_owner(uuid)
  from anon, authenticated;

-- Administrative review RPCs are server-side only.
revoke execute on function public.nextgen_admin_review_deposit(uuid, boolean, text)
  from anon, authenticated;

revoke execute on function public.nextgen_admin_review_withdrawal(uuid, boolean, text)
  from anon, authenticated;

commit;
