# CP22 — Starter / Free Live Mining Engine

## Production state
Supabase CP22, CP22.1 and CP22.2 have already been applied to production. Do not paste these SQL files into the Supabase SQL editor again. They are source/history files for the GitHub repository and future migration tracking.

## Add/replace in GitHub
Replace:
- `components/home/HomeCommandCenter.tsx`
- `components/home/HomeCommandCenter.module.css`

Add:
- `app/admin/starter-mining/page.tsx`
- `supabase/migrations/20260915_cp22_starter_free_mining_engine.sql`
- `supabase/migrations/20260915_cp22_1_starter_live_projection_alignment.sql` (history placeholder)
- `supabase/migrations/20260915_cp22_2_starter_settlement_alias_fix.sql` (history placeholder)

## Required SQL filenames
The source files are supplied below as separate artifacts in the package. The first migration is the full CP22 engine; the two follow-ups are corrective production migrations applied after runtime verification.

## What CP22 implements
- Owner-controlled Starter Mining reserve for the first 1,000 Entry GPU users.
- Entry GPU = 60 H/s; fallback Basic CPU = 20 H/s.
- Target = $0.08 per 1,000 H/s/day.
- Entry GPU target = $0.0048/day, $0.0002/hour, $0.144/30 days at full capacity.
- 30-day full-rate reserve for 1,000 Entry GPUs = $144.
- 7-day minimum reserve for 1,000 Entry GPUs = $33.60.
- Capacity multiplier between 0 and 1, based on funded reserve versus target 30-day liability.
- 24h recharge enforcement with server pause after expiry.
- Live accrual snapshot is server-calculated; browser may interpolate the display but never credits wallet balance.
- Starter settlement writes crypto balance, crypto ledger, transaction ledger and starter reserve ledger atomically.
- Recharge first settles the expired/current starter accrual, then renews the 24h window; renewal is blocked when reserve coverage is below the 7-day floor.
- Daily check-in remains compatible with the recharge lifecycle.
- Minute cron enforces expiration/settlement for expired starter cycles.
- Owner dashboard metrics are available at `/admin/starter-mining`.
- Deterministic 1..1001 economic E2E checks are included.

## Do not modify
- `components/landing/LandingPage.tsx`
- `components/landing/NetworkCore.tsx`
- landing assets

## Important
Do not treat the live counter as a wallet balance. Settlement remains server-authoritative and idempotent.
