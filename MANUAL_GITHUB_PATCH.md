# Manual GitHub Patch — CP21 HOME CORE V1

Copy the files from this package into the repository using the exact paths below. Replace existing files when the path already exists.

## Replace
- `app/dashboard/page.tsx`
- `app/items/page.tsx`
- `app/more/page.tsx`
- `app/rooms/page.tsx`
- `components/layout/BottomNav.tsx`
- `components/layout/Sidebar.tsx`

## Add
- `components/home/HomeCommandCenter.tsx`
- `components/home/HomeCommandCenter.module.css`

## SQL source/history
- `supabase/migrations/20260915_cp20_2_c_1_integrity_hardening.sql`

The database RPCs used by Home are already present in Supabase production. Do not run ad-hoc SQL from the frontend.

## Do not change
- `components/landing/LandingPage.tsx`
- `components/landing/NetworkCore.tsx`
- landing assets

## UX naming
The authenticated entry point is **Home**, not Farm. The design uses NEXTGEN MINER-specific terminology: Home Console, Compute Bays, Miner Arsenal, Merge Lab, Daily Pulse, Boost Lab, Earnings Signal and Crypto Matrix.
