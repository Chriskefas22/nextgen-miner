CP26 — NEXTGEN MINER ROOM TIER SYSTEM

Files to add/replace in GitHub manually:
1. supabase/migrations/20260928_cp26_room_tiers_bonus_hashrate_visuals.sql
2. app/rooms/[roomNumber]/page.tsx
3. app/rooms/RoomsPage.module.css
4. app/items/page.tsx
5. CP26_ROOM_SYSTEM_README.md

The Supabase migration has already been applied automatically to production project NextGen Miner.
Do not re-run it in production if the migration is already applied through Supabase MCP. The SQL is provided for GitHub source control.

Physical model:
- Room 01 = Standard / Basic — FREE — +0% H/s — 12 slots
- Room 02 = Advanced — 25,000 Diamond — +5% H/s — 12 slots
- Room 03 = Premium — 75,000 Diamond — +10% H/s — 12 slots
- Room 04 = Legendary — 250,000 Diamond — +20% H/s — 12 slots
- Room 05 = Mythical — 750,000 Diamond — +35% H/s — 12 slots

Hashrate model:
Miner effective H/s = level base H/s × (1 + miner_bonus_hashrate_percent / 100)
Room effective H/s = miner effective H/s × (1 + room_bonus_percent / 100)
Settlement weight then applies efficiency × energy × membership and the funded revenue pool.

Only deployed miners assigned to a room are counted for live/funded mining calculations.
Inventory miners are excluded from settlement weight.

GitHub is intentionally not modified by the assistant.
