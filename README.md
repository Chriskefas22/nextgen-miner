# NEXTGEN MINER — 10-Day Website Patch (GitHub-ready)

This package uses the actual Next.js repository paths.

## Files

- `app/dashboard/page.tsx` → replace the existing dashboard page
- `app/earn/page.tsx` → replace the existing earn page
- `app/how-it-works/page.tsx` → replace the existing How It Works page

## Frozen landing files

Do NOT modify:

- `components/landing/LandingPage.tsx`
- `components/landing/NetworkCore.tsx`

## Economic UI alignment

The pages explain the already-configured economic control plane:

- 50% mining allocation
- 30% reserve
- 10% donation
- 10% owner/platform
- 10-day rolling revenue lots
- 24-hour user settlement
- dynamic weighted H/s pool allocation
- reserve safety multiplier
- no guaranteed yield
- zero recognized revenue means zero newly funded mining rewards

This ZIP contains website source replacements only. It does not contain a Supabase migration.
