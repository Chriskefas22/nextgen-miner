# CP21 HOME CORE V1

Purpose: make the authenticated product a mining-first Home/Rooms/Miners/Quests/Boosts experience while keeping financial/provider rails deferred.

Files:
- app/dashboard/page.tsx
- app/rooms/page.tsx
- app/items/page.tsx
- app/more/page.tsx
- components/home/HomeCommandCenter.tsx
- components/home/HomeCommandCenter.module.css
- components/layout/BottomNav.tsx
- components/layout/Sidebar.tsx
- supabase/migrations/20260915_cp21_core_mining_snapshot.sql

Landing is intentionally unchanged.
Deposit/withdraw/Shortlinks/PTC/provider/settlement UI is intentionally unchanged.
No fake earnings or fake power wattage are introduced.

## GitHub paste order
1. components/home/HomeCommandCenter.module.css
2. components/home/HomeCommandCenter.tsx
3. app/dashboard/page.tsx
4. app/rooms/page.tsx
5. app/items/page.tsx
6. app/more/page.tsx
7. components/layout/BottomNav.tsx
8. components/layout/Sidebar.tsx

The Supabase migrations in this package are source notes only; the corresponding production database changes have already been applied. Do not run incomplete source-note SQL as a deployment migration.

## Asset rule
Do not add duplicate miner/branding assets. Reuse the repository assets already referenced by the existing miner catalog.
