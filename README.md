# NEXTGEN MINER — GitHub Manual UI Patch

Replace these two files in the repository:

- `app/miners/page.tsx`
- `components/miner/MinerCard.tsx`

This patch keeps the frozen landing files untouched:

- `components/landing/LandingPage.tsx`
- `components/landing/NetworkCore.tsx`

Included:

- full 12-miner catalog
- 10 levels per miner
- multiple copies for paid miners
- owned-copy counts
- Merge Center for 2 identical miners at the same level
- existing 25 → 6400 Diamond merge-fee curve
- one-time Starter Keyboard flow enforced by `nextgen_purchase_miner` for the zero-price Starter Keyboard row
- regular miner purchase through `nextgen_purchase_miner`
- upgrade through `nextgen_upgrade_miner`
- membership-aware recharge UI
- existing 24-hour recharge endpoint
- no direct client-side reward formula

Backend prerequisites already expected by this UI:

- `nextgen_purchase_miner`
- `nextgen_upgrade_miner`
- `nextgen_merge_miners`
- `nextgen_membership_benefits`
- `/api/mining/recharge`

Do not modify the economic rules from the database.
