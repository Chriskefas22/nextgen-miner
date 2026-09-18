# CP25 — NEXTGEN UNIFIED MINING UX

## Production database status

The following database work has already been applied automatically to Supabase production project `NextGen Miner`:

- CP25 baseline: Inventory/Room deployment state, Room tables, deploy/return RPCs, merge-all RPC, purchase-to-inventory flow, registration-bonus-to-inventory flow, same-room merge hardening.
- CP25.1: Room Levels 1–5, Room unlocks up to 5 Rooms, Room capacity up to 120 slots, configurable Diamond pricing, miner power telemetry.
- CP25.2: exact mining claim preview and Farm room summary integration.

## Room design locked for this checkpoint

### Room Levels

| Level | Slots | Upgrade price to this level |
|---|---:|---:|
| 1 | 12 | Included / base |
| 2 | 24 | 20,000 💎 |
| 3 | 48 | 60,000 💎 |
| 4 | 72 | 180,000 💎 |
| 5 | 120 | 500,000 💎 |

### Room unlocks

| Room | Initial capacity | Unlock price |
|---|---:|---:|
| Room 01 | 12 | Included |
| Room 02 | 12 | 100,000 💎 |
| Room 03 | 12 | 300,000 💎 |
| Room 04 | 12 | 750,000 💎 |
| Room 05 | 12 | 1,500,000 💎 |

All Room prices are server-authoritative in `nextgen_room_unlock_config` and `nextgen_room_level_config`, so they can be adjusted later without rewriting the UI.

## Frontend files in this bundle

1. `app/items/page.tsx` — replaces Boost Lab with real Miner Inventory.
2. `app/items/inventory.css` — Inventory UI.
3. `app/rooms/page.tsx` — real Room/Rack UI, upgrades, room unlocks, auto-merge.
4. `app/rooms/RoomsPage.module.css` — Room UI.
5. `app/miners/page.tsx` — Shop focused on purchasing into Inventory.
6. `components/miner/MinerCard.tsx` — purchase -> Inventory and Inventory management CTA.
7. `components/home/MiningEarningsLifecycle.tsx` — Live / Pending / Claimable / Claim lifecycle.
8. `components/home/MiningEarningsLifecycle.module.css` — lifecycle UI.
9. `components/home/HomeCommandCenter.integration.patch.txt` — 2 small edits for Farm integration.
10. `components/layout/BottomNav.tsx` — Farm / Rooms / Shop / Inventory / More.
11. `supabase/migrations/20260918_cp25_1_room_expansion_power.sql` — source migration for CP25.1.
12. `supabase/migrations/20260918_cp25_2_farm_room_summary_claim_preview.sql` — source migration for CP25.2.

## Manual GitHub order

1. Replace `app/items/page.tsx`.
2. Add/replace `app/items/inventory.css`.
3. Replace `app/rooms/page.tsx`.
4. Replace `app/rooms/RoomsPage.module.css`.
5. Replace `app/miners/page.tsx`.
6. Replace `components/miner/MinerCard.tsx`.
7. Add `components/home/MiningEarningsLifecycle.tsx`.
8. Add `components/home/MiningEarningsLifecycle.module.css`.
9. Replace `components/layout/BottomNav.tsx`.
10. Apply the tiny `HomeCommandCenter.tsx` change from `HomeCommandCenter.integration.patch.txt`.
11. Commit/push to `main`.

## Vercel

The Vercel project is already linked to GitHub `Chriskefas22/nextgen-miner` and the latest production deployment currently reports READY from commit `4b74c3aae8bdb8fd11b3ceae0d5e17cdb1be554a` (CP24). After the frontend files are pushed to `main`, the normal GitHub -> Vercel integration should create the new production deployment.

## End-to-end contract

Buy miner -> Inventory -> Deploy -> Room -> Mining -> Live -> Pending -> Claimable -> Claim -> Wallet

Buy x2 identical -> Inventory -> Deploy both -> Same Room -> Merge -> next level -> Room remains correct -> Hashrate recalculates

## Important implementation rule

Do not revive the old model where buying a miner immediately makes it an active miner. `nextgen_purchase_miner` now writes the miner to `deployment_state='inventory'` in production.

Do not show frontend-only reward balances as settled wallet balances. Live accrual remains separate from server settlement and claimable amounts.
