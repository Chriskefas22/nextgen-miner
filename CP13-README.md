# CP13 — Owner Economic Dashboard Metrics

This patch upgrades `app/admin/page.tsx` to a live owner economic dashboard and adds a 60-second server refresh component.

## Metrics
- recognized revenue today / rolling 10D / rolling 30D
- reserve balance, reserve flows, coverage and status
- outstanding mining liability and open liability rows
- rolling 10D mining release, current daily release and mining budget
- raw and weighted hashrate
- reward per 1,000 weighted H/s
- capacity utilization and safe-capacity headroom
- capacity guard status, expansion gate and reason
- CP12 allocation and active rule version
- reconciliation/audit indicators

## Security
The database RPC is `SECURITY DEFINER`, uses a pinned empty search path, explicitly checks `nextgen_is_owner()`, revokes `PUBLIC`, and grants execute only to `authenticated`.

## User action
1. Copy the two app/component files into the repository.
2. Keep the three frozen landing files unchanged.
3. Do not re-apply the SQL in production if CP13 is already applied; it is included only as repository migration history.
4. Push the files to GitHub and let Vercel deploy.

## Important accounting detail
Reserve balance is read from the latest reserve-ledger balance row, not by summing historical balance snapshots. Summing historical `balance_usd` values would double-count the same reserve.
