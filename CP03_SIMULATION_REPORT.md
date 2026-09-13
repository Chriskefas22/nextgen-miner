# NEXTGEN MINER — CP03 Corrected Economic Capacity Simulation

Date: 2026-09-13

Model: 50% mining allocation → 10-day lot → steady-state daily release ≈ 5% of recognized net revenue → reserve safety multiplier (RSM).

## PASS criteria

- Zero recognized net revenue produces zero mining budget and blocks new capacity.
- Positive revenue funds only the actual rolling release budget.
- New weighted H/s is allowed only when projected reward remains ≥ TARGET ($0.08 / 1,000 weighted H/s/day).
- FLOOR ($0.05) blocks new expansion.
- Existing funded mining liabilities are unaffected by the guard.
- RSM 1.00 / 0.85 / 0.70 scales the funded daily release directly.

## Correct capacity envelope

At steady state, daily mining release = revenue × 0.50 / 10 × RSM.

Therefore at RSM 1.00:

- HEALTHY $0.12 → 416.67 weighted H/s per $1 revenue/day
- TARGET $0.08 → 625.00 weighted H/s per $1 revenue/day
- FLOOR $0.05 → 1,000.00 weighted H/s per $1 revenue/day

At RSM 0.85: 354.17 / 531.25 / 850.00.
At RSM 0.70: 291.67 / 437.50 / 700.00.

## Representative scale scenarios

| Recognized net revenue/day | RSM | Daily release | TARGET-safe weighted H/s | HEALTHY-safe weighted H/s | FLOOR-safe weighted H/s |
|---:|---:|---:|---:|---:|---:|
| $10 | 1.00 | $0.50 | 6,250 | 4,166.67 | 10,000 |
| $10 | 0.85 | $0.425 | 5,312.50 | 3,541.67 | 8,500 |
| $10 | 0.70 | $0.35 | 4,375 | 2,916.67 | 7,000 |
| $100 | 1.00 | $5 | 62,500 | 41,666.67 | 100,000 |
| $1,000 | 1.00 | $50 | 625,000 | 416,666.67 | 1,000,000 |
| $10,000 | 1.00 | $500 | 6,250,000 | 4,166,666.67 | 10,000,000 |

User count changes how many people share the funded capacity; it does not create additional funded capacity.

## Miner / membership / merge checks

The frozen membership mix 65% standard / 25% Premium / 8% Pro / 2% Elite gives a weighted membership factor of 1.0235×. The capacity guard uses hashrate × efficiency × energy × active membership factor.

The locked merge rule is 2 identical miners at the same level → next level at 1.80× hashrate. Two source miners therefore represent 2.00× source weight while the survivor is 1.80× next-level weight, so merge does not bypass the new-capacity envelope.

## Production verification

Current production after CP03: raw H/s 815, weighted H/s 815, rolling 10-day recognized revenue $0, mining budget $0, reward $0 / 1,000 weighted H/s/day, status CRITICAL, expansion BLOCKED. This is the intended fail-safe state while revenue is zero.

## Result

PASS — corrected 10-day release mechanics are now the source of truth for capacity decisions. No synthetic revenue was inserted into production.
