# NextGen Miner landing repair — 2026-09-11

## Files to copy into the repository

- `package.json` → root `package.json`
- `components/landing/LandingPage.tsx` → replaces the current landing component
- `app/api/bonus/claim/route.ts` → new server-side bonus claim endpoint
- `app/auth/login/page.tsx` → replaces the current login page
- `supabase/migrations/20260911_landing_live_telemetry_and_bonus_claim.sql` → reproducible DB migration (already applied directly)

## Supabase changes

Already applied directly to the production NextGen Miner Supabase project:

1. `nextgen_get_landing_telemetry()` security-definer aggregate telemetry RPC.
2. `nextgen_claim_registration_bonus(uuid)` now enforces `auth.uid() = p_user_id`.
3. Bonus claim RPC is executable by authenticated users only.
4. Landing telemetry RPC is executable by anon/authenticated users.

## Why `three` is required

`components/landing/NetworkCore.tsx` imports `three`. The current Vercel build failed because the dependency was absent from `package.json`.

The patch adds:
- `three`
- `@types/three`

## After copying

Run:

npm install
npm run build

Then commit/push to `main`. Vercel should automatically create a new production deployment from the GitHub push.

## Important

Do not reintroduce fake hard-coded live telemetry. The new landing reads aggregate hashrate/miner/network figures from Supabase.

The registration bonus remains protected by the database. The browser cannot choose another user's ID, and the database checks the authenticated user's identity.
