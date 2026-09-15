# CP22 MANIFEST

Status: Supabase production applied and verified.

Core:
- Starter/Free Mining Reserve
- Server-side Live Accrual
- 24h Recharge Enforcement
- Pause/Resume
- Hourly / Daily / 30D projections
- Owner Starter Mining metrics
- First 1,000 Entry GPU / slot 1001 Basic CPU contract
- Minute enforcement via pg_cron
- Starter settlement ledger

Verified production checks:
- pg_cron job `nextgen-starter-mining-enforcement` active every minute.
- Supported pool architecture remains multi-asset; only actually enabled mining rails may display LIVE.
- One real-user rollback test: expired -> PAUSED, recharge -> ACTIVE; temporary settlement created and wallet credit matched the server settlement, then the transaction was rolled back.
- Deterministic 1..1001 contract test passed: slots 1..1000 Entry GPU, slot 1001 Basic CPU; 1000 Entry GPU full-rate liability = $4.80/day, $144/30d, $33.60/7d minimum reserve.
- Production reserve balance was intentionally left at $0 because no exact owner funding amount was supplied. No money was invented.

Landing remains frozen.
