# NEXTGEN MINER — ECONOMIC AUDIT & IMPLEMENTATION REPORT v1.0

## Scope
Audit target: Supabase project `NextGen Miner`, Vercel project `nextgen-miner`, GitHub repository `Chriskefas22/nextgen-miner`.

Landing page is explicitly frozen and was not modified.

## Current production findings

### Critical economic mismatch
The live Supabase mining configuration was still using legacy values:
- mining allocation: 20% (`monetization_to_mining_bps=2000`)
- owner margin: 30% (`owner_margin_bps=3000`)
- absolute/max daily mining cap: $10
- no Reserve Safety Multiplier in the active calculation
- all mining pool assets were disabled except USDT, and USDT had a zero daily pool

The frozen blueprint requires 50% mining / 30% reserve / 10% donation / 10% owner-platform, with a revenue-backed dynamic pool.

### Vercel runtime finding
Production runtime logs showed `NO_FUNDED_MINING_POOL` on `/dashboard`, `/dashboard.rsc`, and `/api/mining/accrue`. This is consistent with the database containing no recognized eligible monetization revenue and a zero funded pool.

### Database findings
There are 3 auth users, 9 user miners, 12 miner catalog rows and 120 miner-level rows. No mining payout rows or reward-ledger rows currently exist.

The miner catalog contains extra families beyond the five frozen families. The five frozen families were not deleted; their Level 1-10 hashrate values were aligned explicitly to the frozen checkpoint.

### Security findings
Supabase security advisors reported 7 RLS-enabled tables with no policies and public/authenticated execution of SECURITY DEFINER functions. Anonymous execution was removed for the privileged economic RPCs audited in this pass. Existing authenticated SECURITY DEFINER functions still require a broader function-by-function authorization audit before production.

## Applied changes

1. Created `nextgen_economic_rule_versions` with the frozen economic contract.
2. Created `nextgen_reserve_ledger`.
3. Added reserve/RSM/coverage fields to `nextgen_mining_daily_pools`.
4. Added `efficiency` to `nextgen_miner_levels`.
5. Added `energy_percent` and `energy_updated_at` to `nextgen_user_miners`.
6. Updated the live primary mining configuration to 50% mining and 10% owner/platform margin.
7. Updated Diamond denomination to 10,000 per USD.
8. Aligned the five frozen miner families' Level 1-10 hashrate values.
9. Applied the frozen 100%-118% Level 1-10 efficiency curve.
10. Removed anonymous execution for privileged economic procedures.
11. Added owner-only RLS read access to the new reserve ledger.

## Important production gate result

The system should NOT fabricate mining revenue to make the dashboard look active.

With zero recognized revenue, the correct mining budget is $0. The `NO_FUNDED_MINING_POOL` state is economically correct until eligible revenue exists.

The next implementation stage must therefore:
- normalize recognized revenue into a proper revenue ledger/event model
- calculate 50/30/10/10 from confirmed Net Recognized Revenue
- calculate Reserve Safety Multiplier from reserve coverage
- snapshot the daily weighted network hash
- settle on the 24-hour timestamp model
- write immutable/idempotent crypto ledger entries
- only then expose settled crypto for withdrawal

## Exact frozen parameters

- Diamond: 10,000 / USD reference denomination
- Mining: 50%
- Reserve: 30%
- Donation: 10%
- Owner/platform: 10%
- Settlement: 24h
- Merge: 2 identical same-level -> 1 next level
- Merge multiplier: 1.80x
- Efficiency: Lv1=100%, then +2 percentage points per level, Lv10=118%
- Conversion fee starting parameter: 1%
- Reserve bands: >=150% green, 120-149% healthy, 100-119% warning, <100% critical
- RSM starting bands: 1.00 / 0.85 / 0.70 / <=0.70

## Important economic observation

A 30% reserve contribution does not mathematically create 150% reserve coverage against an indefinitely accumulating pool of all settled user balances. Therefore the production implementation must use the liability definition from the frozen policy consistently and transparently. It must not silently redefine the denominator to make the coverage ratio look healthy.

## Recommended implementation sequence

PRE-GATE
-> revenue normalization
-> exact reserve ledger
-> exact daily pool calculation
-> stress test
-> pass/fail

CP-02
-> immutable ledger foundation

CP-03
-> earning engine

CP-04
-> miner engine

CP-05
-> merge engine

CP-06
-> mining engine

CP-07
-> conversion

CP-08
-> progression

CP-09
-> withdrawal

CP-10
-> admin/observability

CP-11
-> dashboard

CP-12
-> 100/1k/10k/50k/100k production stress gate
