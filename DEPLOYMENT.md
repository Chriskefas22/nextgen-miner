# NextGen Miner — Manual GitHub / Vercel Deployment

## Supabase
The project is preconfigured for the current NextGen Miner Supabase project in `config.js` using the public publishable key. Do not place service-role keys in the repository.

The database is already prepared with:
- 250 miner plan-level records (5 families × 50 levels)
- welcome bonus of 1,000 💎 on first registration
- Credit economy: $1 deposit = 1,000 💎; 5,000 💎 = $1 payout
- deposit limits: $0.01–$100,000
- withdrawal limits: $5–$100,000
- manual deposit/withdrawal approval functions
- crypto balances and exchange ledger
- Resources / Workers / Transport capacity and 50 upgrade levels each
- admin/security tables and RPCs

## Cloudflare Turnstile
Set `TURNSTILE_SITE_KEY` in `config.js` only with the public site key.
Set the secret key in Vercel as:
`TURNSTILE_SECRET_KEY`
Never commit the secret key to GitHub.

## GitHub
Upload the contents of this folder to the root of your new `nextgen-miner` repository. Keep `.env.example` but never add real secrets.

## Vercel
Import the GitHub repository as a new Vercel project. The repository already contains `vercel.json` and the `/api` functions.
Add the Environment Variable `TURNSTILE_SECRET_KEY` in Project Settings → Environment Variables, then redeploy.

## Notes
- The public Supabase URL and publishable key are intended for browser use.
- User passwords are managed by Supabase Auth and are never stored in plaintext by this project.
- Withdrawal requests remain pending until an authorized admin approves them.
- Deposit balances are credited only after an authorized admin approves the deposit.
