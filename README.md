# NextGen Miner — Full Rebuild 4.0

This package is a clean UI/application rebuild of NextGen Miner.

## Canonical user-facing currency
The only reward currency displayed to users is **💎**. The currency name is intentionally omitted from public UI copy.

## Miner progression
There are 12 shop miners. Every miner has **Level 1 through Level 10**. Upgrade cost rises between levels and hashrate increases by 15% per level. Starter Keyboard is free at activation; its first paid upgrade begins the progression.

## Visual direction
Dark glassmorphism, neon cyan/blue/purple/magenta, holographic interfaces, futuristic city hardware, responsive mobile-first layouts. The generated master visual is kept in `public/assets/nextgen-master-ui.png`, with optimized miner image assets in `public/assets/miners/`.

## Security
Cloudflare Turnstile remains in the auth/protected-action architecture. Supabase operations must remain server/database controlled for balances, purchases, upgrades, rewards and withdrawal eligibility.
