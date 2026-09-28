# CP26 — NextGenMiner Room Tier System

## Locked Room progression

| Room | Tier | Price | Room Bonus | Capacity | Visual concept |
|---|---|---:|---:|---:|---|
| Room 01 | Standard / Basic | FREE | +0% H/s | 12 | Simple industrial mining room |
| Room 02 | Advanced | 25,000 💎 | +5% H/s | 12 | Blue high-tech lab |
| Room 03 | Premium | 75,000 💎 | +10% H/s | 12 | Purple neon reactor / holograms |
| Room 04 | Legendary | 250,000 💎 | +20% H/s | 12 | Golden reactor / energy beams |
| Room 05 | Mythical | 750,000 💎 | +35% H/s | 12 | Living cosmic room / glowing nature / energy flow |

## Architecture

A room does **not** create a standalone miner hashrate. The miner remains the source of hashrate.

`Miner base H/s`
→ `Miner bonus %`
→ `Room bonus %`
→ `Efficiency`
→ `Energy`
→ `Membership factor`
→ `Revenue-funded settlement weight`

This prevents Room bonus from being double-counted as a separate mining asset.

## Deployment contract

- Buying a miner puts it into Inventory.
- A miner begins mining only after deployment into an unlocked Room.
- Every Room has exactly 12 slots.
- Inventory miners do not count toward settlement.
- Deployed miners are visible in the Room rack.
- Manual merge is performed from the Room rack by tapping two matching miners.
- Merge remains server-authoritative and requires the same Room.
- Auto Merge All still uses the same same-room server validation.

## Visual contract

### Level 1 — Standard
Industrial room, neutral light, simple rack, minimal ambient motion.

### Level 2 — Advanced
Blue LEDs, cooling system, monitoring screens, fan/vent animation.

### Level 3 — Premium
Purple neon, holographic panels, reactor energy, floating particles.

### Level 4 — Legendary
Gold reactor core, energy beams, moving rings, dynamic lighting.

### Level 5 — Mythical
Cosmic sky, luminous plants/crystals, energy streams, floating particles, nebula motion.

The visual treatment must never reduce the clickable area of the 12 miner slots.

## GitHub manual installation order

1. Add `supabase/migrations/20260928_cp26_room_tiers_bonus_hashrate_visuals.sql`.
2. Replace `app/rooms/[roomNumber]/page.tsx`.
3. Replace `app/rooms/RoomsPage.module.css`.
4. Replace `app/items/page.tsx`.
5. Add this README.
6. Commit and push to `main`.

`app/rooms/page.tsx` can remain as the existing redirect to `/rooms/1`.
