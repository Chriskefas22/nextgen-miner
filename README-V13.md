# NextGen Miner — V13 Patch

This ZIP is designed to be extracted directly into the repository root.

Included:
- components/landing/LandingPage.tsx
  - integrates the V11 BrandLink logo on Home
  - preserves live bonus/telemetry/miner rendering
  - keeps the existing landing visual system
- app/referrals/page.tsx
  - fixes canonical + Open Graph URL to /referrals
- components/branding/BrandLink.tsx
- components/branding/BrandLink.module.css
- lib/supabase/proxy.ts
  - canonical redirect from retired .devs.surf host
  - Supabase auth session refresh
  - security headers
- PATCH-DELETE-root-middleware.ts.txt
  - instruction to delete the conflicting root middleware.ts

IMPORTANT:
1. Extract this ZIP at the root of the GitHub repository.
2. The root file `middleware.ts` MUST be deleted from GitHub.
3. Do not rename the TXT deletion instruction to middleware.ts.
4. Keep the existing `lib/supabase/proxy.ts` path exactly as included here.
5. Commit/push the resulting repository to `main`.
6. Vercel should then build using proxy.ts without the middleware/proxy collision.

Expected relevant tree after applying V13:

components/
  branding/
    BrandLink.tsx
    BrandLink.module.css
  landing/
    LandingPage.tsx

app/
  referrals/
    page.tsx

lib/
  supabase/
    proxy.ts

middleware.ts   <-- MUST NOT EXIST

The ZIP does not replace the entire application; it is a root-ready patch containing every source file that needs to be added or replaced for the V13 changes.
