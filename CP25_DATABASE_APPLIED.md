# CP25 production database checkpoint

Applied automatically to Supabase production on 2026-09-18.

## Objects verified

- `nextgen_user_miners.deployment_state`
- `nextgen_mining_rooms`
- `nextgen_miner_room_slots`
- `nextgen_room_level_config`
- `nextgen_room_unlock_config`
- `nextgen_deploy_miner(bigint,bigint,integer)`
- `nextgen_return_miner_to_inventory(bigint)`
- `nextgen_merge_all_ready(bigint)`
- `nextgen_create_room()`
- `nextgen_upgrade_room(bigint)`
- `nextgen_rooms_snapshot()`
- `nextgen_mining_claim_preview(text)`
- Farm snapshot room summary integration
- Miner `base_power_watts`

## Pricing currently seeded

Room levels: 12 / 24 / 48 / 72 / 120 slots; upgrades to Levels 2–5 cost 20k / 60k / 180k / 500k Diamond.

Room unlocks: Room 02 = 100k, Room 03 = 300k, Room 04 = 750k, Room 05 = 1.5m Diamond.

## Vercel status

Latest production deployment inspected: READY, CP24 commit `4b74c3aae8bdb8fd11b3ceae0d5e17cdb1be554a`.

GitHub write operations were blocked by the connected integration with HTTP 403, so the frontend changes are intentionally delivered as manual files rather than claiming they were pushed/deployed.
