# CP12 Economic Implementation Patch

This patch is for the NextGen Miner economic-model integration.

## Locked Supabase rule
- active rule: `economic_v1_2_cp12`
- mining: 25%
- reserve: 50%
- donation: 10%
- owner/operating: 15%
- diamonds: 10,000 / recognized USD
- mining lot horizon: 10 days

## Important
Supabase production has already been updated directly and verified. This patch is only for GitHub/Vercel application-side follow-up.

## Frozen files
Do not modify:
- components/landing/LandingPage.tsx
- components/landing/NetworkCore.tsx
- app/landing-page.css

## Verification note
The login page uses `useSearchParams()` inside a client component and is wrapped by a `Suspense` boundary for production-safe prerendering. The `next` value is restricted to same-origin relative paths.
