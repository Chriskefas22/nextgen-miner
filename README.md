# NextGen Miner — Premium + Hashrate Recharge Patch

## Supabase already applied
The production Supabase project now contains:
- `nextgen_membership_plans`
- `nextgen_memberships`
- `nextgen_daily_checkins`
- `nextgen_current_membership()`
- `nextgen_membership_benefits()`
- `nextgen_purchase_membership(text,text)`
- `nextgen_claim_daily_checkin()`
- updated `nextgen_recharge_hashrate()` with Premium auto-recharge
- updated `nextgen_claim_mining()` with membership revenue and membership mining multiplier
- updated `nextgen_upgrade_miner(bigint)` with membership upgrade discount
- mining pool rule: 20% monetization allocation; USDT pool share 100%

## GitHub manual placement
Copy these files to the repository root, replacing existing files only where the path exists:

- `app/premium/page.tsx`
- `app/premium/premium.module.css`
- `app/api/membership/benefits/route.ts`
- `app/api/membership/quote/route.ts`
- `app/api/membership/purchase/route.ts`
- `app/api/daily-checkin/route.ts`
- `app/api/mining/recharge/route.ts`
- `app/miners/page.tsx`
- `components/layout/Sidebar.tsx`

The combined wallet files are included for the earlier Crypto-first Wallet change:
- `app/wallet/page.tsx`
- `wallet_crypto_first.append.css` (append to `app/deposit-wallet.css`)

After GitHub detects the commit, Vercel should build from `main` automatically.

## Premium rules
Free users: daily recharge keeps hashrate active for 24 hours.
Premium/Pro/Elite: no daily recharge required while membership is active.
Premium mining multipliers affect allocation weight only; total crypto payout is still bounded by the funded mining pool.
Membership purchases are recorded as monetization revenue.

## Important before production payout
Fresh exchange rates are still required for real crypto payout. Do not fabricate rates for testing.

## Wallet CSS
The Wallet page uses the existing global `app/deposit-wallet.css`. Append `wallet_crypto_first.append.css` to that file; do not import the append file directly from a client page.

## Additional files in final patch
- `app/api/wallet/withdraw/route.ts` -> native crypto withdrawal RPC only; no Diamond withdrawal.
- `app/api/wallet/exchange/route.ts` -> one-way Crypto -> Diamond RPC only.
- `app/api/support/route.ts` and `app/support/page.tsx` -> user-owned support tickets.
- `supabase/migrations/20260907120000_economy_security_support_hardening.sql` -> migration parity for the production hardening already applied.

## Economy decision
The previous $1/day mining cap is removed. The hard limit is now the funded pool itself: eligible net monetization revenue × 20%. Therefore miner purchases, deposits, Diamond balances and membership bonuses cannot directly create withdrawable crypto. Membership sales are monetization revenue, while the membership Diamond bonus is an internal Diamond liability and is not treated as crypto funding.

The membership daily Diamond bonuses were reduced to 250 / 750 / 2,000 for Premium / Pro / Elite. This keeps the membership valuable while making the internal Diamond emission materially smaller relative to the miner price ladder ($0.05 / $0.075 / $0.20 respectively at 10,000 Diamond per USD). These are configuration values and can be adjusted later by Owner after observing real revenue and task economics.

## GitHub insertion order
1. Copy the `app/` files first.
2. Copy `components/layout/Sidebar.tsx`.
3. Append `wallet_crypto_first.append.css` to `app/deposit-wallet.css`.
4. Copy `supabase/migrations/20260907120000_economy_security_support_hardening.sql` into the repository migration folder for parity. Do NOT re-run it in production Supabase because it is already applied; if your migration workflow requires applying it, verify migration history first.
5. Commit to `main`.
6. Let Vercel's Git integration build the commit. Do not deploy the pre-patch source manually.
