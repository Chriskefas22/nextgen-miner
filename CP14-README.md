# NextGen Miner — CP14 Economic Monitoring + Reconciliation

CP14 adds the deeper economic control plane on top of the locked CP12 economy and CP13 owner dashboard.

## Production scope
- Owner-only monitoring snapshot and operator dashboard
- Provider reconciliation: orphaned completions and unmatched settled revenue
- Revenue aging/recoverability: 0–24h, 24–72h, 72h+, stale >72h
- Reserve/liability drift versus prepared mining pool
- Lot maturity and stalled funded-lot detection
- Capacity guard transition history
- Persistent anomaly and alert records with fingerprint de-duplication
- Monitoring run history
- Automatic database monitoring every 15 minutes via Supabase Cron

## Alert model
Alerts are persisted to `nextgen_economic_alerts` with `channel=admin_dashboard`. No external email/Slack delivery is enabled by this checkpoint.

## Security
Monitoring history tables have RLS enabled and direct privileges revoked from `public`, `anon`, and `authenticated`. Owner read functions perform `nextgen_is_owner()` checks; scheduled writer has no Data API EXECUTE grant.

## Economic rule
CP12 remains authoritative: 50% reserve / 25% mining / 10% donation / 15% owner-operating, with 10-day mining revenue lots.

## Landing freeze
These files remain untouched:
- components/landing/LandingPage.tsx
- components/landing/NetworkCore.tsx
- app/landing-page.css
