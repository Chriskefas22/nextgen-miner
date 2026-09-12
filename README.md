# NEXTGEN MINER — Control Plane App Sync

These are the application-side files required to align Next.js/Vercel with the authoritative Supabase mining control plane.

## Replace

- `app/dashboard/page.tsx`
- `app/api/mining/accrue/route.ts`

## Supabase contract added

- `public.nextgen_mining_dashboard_snapshot(text)`

The dashboard no longer reads `nextgen_reward_ledger` for mining rewards and no longer performs timestamp-based reward calculations. The compatibility `/api/mining/accrue` route now calls `nextgen_claim_mining`.

## Important

The GitHub repository is connected to Vercel, but this session is operating with GitHub write access disabled. Therefore the files are prepared here for manual paste/commit. Once committed to `main`, the existing Vercel Git integration can build the change.

Do not modify the frozen landing files.
