# NextGen Miner — Pre-Launch Results

## Static checks
- app.js: JavaScript syntax check passed with Node.js `node --check`.
- `config.js`: points to the new NextGen Miner Supabase project and uses a publishable key; Turnstile Site Key intentionally remains blank until Cloudflare is configured.
- Vercel config: `vercel.json` present; API functions use Node.js 22 runtime.
- Required QR assets: 21/21 present.
- Miner artwork: family/tier/level assets referenced by the UI are present.
- Resources/Workers/Transport artwork: Level 01 and Level 50 assets present for all three modules.
- Public pages: home, how-it-works, plans, levels, live activity, terms, FAQ are present in `index.html`.
- Auth UI: Login + Create Account + password reset + Terms checkbox + Turnstile hook are present.

## Frontend consistency fixes applied
- Fixed transaction history to use canonical `ng_transactions` fields (`tx_type`, `credit_delta`, `usd_delta`).
- Fixed deposit submission to send the required crypto amount as `p_amount` to `ng_submit_deposit`.
- Fixed Admin Console destination creation to use the protected `ng_admin_upsert_destination` RPC instead of attempting to insert into a compatibility view.
- Fixed Admin Console exchange-rate updates to use `ng_admin_set_exchange_rate` RPC.
- Added `currentView` tracking so the hourly deposit policy refresh works reliably.

## Supabase checks
- Project `NextGen Miner` is active/healthy.
- 250 miner levels loaded.
- 150 infrastructure levels loaded.
- 21 active deposit destinations loaded.
- Owner user exists and is linked to `ng_admins` with role `owner`.
- Auth trigger `ng_on_auth_user_created` calls `ng_handle_new_user`.
- `ng_handle_new_user` creates `ng_users`, `ng_wallets`, all three starting infrastructure rows, and credits the configured signup bonus (1,000 Credit) with a ledger entry.
- Hourly confirmation refresh job `nextgen-confirmation-hourly` is active (`0 * * * *`).
- RLS is enabled on the primary NextGen application tables.

## Production blockers / manual configuration
1. Cloudflare Turnstile Site Key + Secret Key are not configured yet.
2. Supabase Auth leaked-password protection is still disabled and should be enabled before public launch.
3. Security Advisor still reports `SECURITY DEFINER` execute grants; these are intentionally used for protected server-side RPCs, but should be reviewed before public launch.
4. Exchange rates are currently configuration values, not a live market-price feed.
5. Deposit confirmation refresh updates platform policy metadata hourly; it does not claim to be a live blockchain confirmation oracle.

## Recommended launch order
GitHub upload → Vercel import → Vercel environment variables → Turnstile → test registration/login → test first-user bonus → test deposit submission → owner approval → mining purchase → infrastructure upgrade → exchange → withdrawal request → owner approval.
