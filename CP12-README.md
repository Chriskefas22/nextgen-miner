# CP12 — Authenticated Route Guard

This patch closes the Stage 2 route-protection gap found in production:
`/wallet` and `/miners` previously rendered their authenticated app shell to anonymous visitors.

Implementation:
- `lib/supabase/proxy.ts` now uses the already-validated Supabase `getClaims()` result.
- Authenticated route families redirect to `/auth/login` when no authenticated user claim exists.
- Original session cookie refresh and security headers are preserved.
- A safe `next` query value retains the requested private path for a future login redirect implementation.
- Public routes such as `/referrals`, `/miner-catalog`, `/about`, `/faq`, `/contact` and `/legal/*` remain public.
- Server-side RPC/API authorization remains mandatory; this edge guard is only the first access-control layer.

Protected route families:
`/dashboard`, `/earn`, `/miners`, `/premium`, `/quests`, `/faucet`, `/ptc`, `/shortlinks`, `/offers`, `/wallet`, `/leaderboard`, `/contests`, `/support`, `/profile`, `/settings`, `/notifications`, `/owner`.

Frozen and untouched:
- `components/landing/LandingPage.tsx`
- `components/landing/NetworkCore.tsx`
- `app/landing-page.css`

Production verification after push:
1. Anonymous `/wallet` → `/auth/login`
2. Anonymous `/miners` → `/auth/login`
3. Anonymous `/dashboard` → `/auth/login`
4. Authenticated user can open private routes.
5. Public `/referrals` and `/miner-catalog` remain public.
6. Verify no new 4xx/5xx runtime errors.
