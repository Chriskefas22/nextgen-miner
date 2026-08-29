# NextGen Miner Production Status

Supabase project: NextGen Miner
Project ref: mmqprhuvhghyuvudsyma
Project URL: https://mmqprhuvhghyuvudsyma.supabase.co
Status observed: ACTIVE_HEALTHY

## Database provisioned
- 5 miner families: Coal, Copper, Iron, Silver, Gold
- 50 levels per family = 250 miner levels
- Resources 1-50
- Workers 1-50
- Transport 1-50
- Wallet / Credit economy
- Top-up ratio: $1 = 1,000 credit
- Payout ratio: 5,000 credit = $1
- Deposit: $0.01 to $100,000
- Withdrawal: $5 to $100,000
- Welcome bonus: 1,000 credit
- Approval workflow for deposits and withdrawals
- Crypto exchange balances and history
- Verified public activity feed
- Security and admin audit tables

## Security
- Application tables use RLS.
- Sensitive mutations are performed through guarded RPC functions.
- Do not add any service-role key or secret to GitHub.
- Cloudflare Turnstile secret belongs only in Vercel environment variables.

## Pending manual production configuration
1. Add the Owner user in Supabase Auth and then associate the UUID with `ng_admins` as role `owner`.
2. Add the owner's verified deposit addresses to `ng_deposit_destinations`.
3. Create Cloudflare Turnstile site and place the Site Key in the frontend config; keep Secret Key only in Vercel.
4. Enable Supabase leaked-password protection in Auth settings.
5. Import this repository into a new Vercel project.
