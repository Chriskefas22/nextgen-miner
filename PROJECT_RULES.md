# NextGen Miner Project Rules

Canonical UI currency is 💎 only; do not display a currency name.
Every Shop Miner has Level 1–10. No Level 11+.
Miner, wallet, reward, deposit, withdrawal and progress values must come from Supabase in production.
Never ship hardcoded user balances, owned miners, rewards or profile statistics.
Turnstile integration remains available and is reconnected through environment variables.
Production secret keys never enter client code.
Minimum deposit: $0.01. Minimum withdrawal: $1.00. Withdrawal additionally requires cumulative qualifying top-up >= $1.
