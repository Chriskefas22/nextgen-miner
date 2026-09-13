# NEXTGEN MINER CP05 — Economic Engine v1.1

Production status:
- CP05 Economic Engine v1.1 is already applied to Supabase production.
- CP05.1 snapshot alignment is also already applied to Supabase production.
- Landing page was not modified.
- GitHub and Vercel source still require the manual GitHub upload described below.

Manual GitHub upload paths:
1. `supabase/migrations/20260913_economic_engine_v1_1_dynamic_45_50_and_stress_test.sql`
2. `supabase/migrations/20260913_economic_capacity_snapshot_fix_pool_setting_lookup.sql`
3. `app/admin/page.tsx`

Do NOT upload the ZIP itself into the repository.

Economic policy:
- base mining allocation: 45%
- maximum mining allocation: 50%
- minimum mining allocation: 40%
- reserve allocation shifts inversely so allocations total 100%
- donation: 10%
- owner/platform: 10%
- mining lots: 10 days
- RSM: 1.00 / 0.85 / 0.70
- target: $0.08 per 1,000 weighted H/s/day
- floor: $0.05 per 1,000 weighted H/s/day
- healthy: $0.12 per 1,000 weighted H/s/day

Stress simulator:
`public.nextgen_economic_stress_test(...)` is owner-only and does not write production state.

After GitHub upload:
- Vercel should create a new production deployment automatically.
- Verify `/admin` after deployment.
- Verify the production economic snapshot shows rule `economic_v1_1` and the dynamic allocation fields.
