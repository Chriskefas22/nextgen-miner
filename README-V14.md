# NextGen Miner V14 — definitive build fix

Current audit found the root cause of the Vercel failure:

- `middleware.ts` STILL EXISTS in the GitHub repository.
- `proxy.ts` also exists at repository root.
- Next.js/Vercel refuses to build when both are present.

Required final structure:

proxy.ts
lib/supabase/proxy.ts
NO middleware.ts

V14 also fixes the secondary integration issue introduced by V13:
root `proxy.ts` calls `updateSession()` from `lib/supabase/proxy.ts`, so `lib/supabase/proxy.ts` must export `updateSession`.

Apply:
1. Delete `middleware.ts` from the repository root.
2. Replace `lib/supabase/proxy.ts` with the version in this ZIP.
3. Leave root `proxy.ts` unchanged.
4. Commit and push to `main`.

The V13 changes for BrandLink/Home and /referrals are already present in GitHub and do not need to be reverted.
