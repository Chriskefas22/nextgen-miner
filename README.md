# NextGen Miner

A mobile-first futuristic mining management interface built as a static Vercel site with a Supabase backend.

## Included

- Futuristic responsive landing page and dashboard
- Supabase email/password auth
- User profile + wallet creation trigger
- 5 mining rig families × 50 levels (250 configurations)
- Server-side mining accrual function
- Secure miner activation RPC
- Deposit proof submission workflow
- Server-side withdrawal request RPC with $5 minimum and $100,000 maximum
- Transaction ledger
- Referral code generation
- Terms, risk notice, FAQ, support sections
- Cloudflare Turnstile placeholder in UI plus `/api/turnstile.js`
- No private Supabase service-role key in the browser

## Supabase

The current build points at the dedicated NextGen Miner Supabase project and uses isolated `ng_*` tables. The database schema, miner/infrastructure levels, payment destinations, confirmation policy metadata, and core RPCs are already applied to that project.

For a completely separate Supabase project, update `config.js` with the new public URL/key and apply the schema migration again.

## Turnstile

Add `TURNSTILE_SECRET_KEY` in Vercel Project Settings → Environment Variables, and set `TURNSTILE_SITE_KEY` in `config.js` for the real widget integration.

The UI renders the real Turnstile widget once TURNSTILE_SITE_KEY is configured; otherwise the protected actions stay blocked in production.

## Important production hardening

1. Replace the example support email.
2. Configure the owner/admin account and deposit destinations.
3. Configure live exchange-rate sources or owner-managed rates.
4. Configure the Cloudflare Turnstile site/secret keys before production.
5. Add rate limiting, session/device controls, fraud monitoring, and backup/recovery procedures.
6. Review local financial, consumer-protection, tax, and digital-asset requirements before accepting real customer funds.

## Run locally

Because the site uses browser ES modules, serve the directory through a local web server rather than opening `index.html` directly, e.g. `python3 -m http.server 4173`.


## Exchange

The authenticated dashboard includes Credit ↔ Crypto conversion for BTC, LTC, TRX, DOGE, ETH and USDT. Rates and fees are owner-configurable in Admin Console; approved crypto deposits also create an internal crypto balance from the approved USD value at the current configured rate.

## Miner Visual System

The Miners Shop now uses five distinct mineral families: Coal, Copper, Iron, Silver, and Gold. Each family has five visual rarity/tier artworks — Common (Levels 1–10), Uncommon (11–20), Rare (21–30), Epic (31–40), and Legendary (41–50) — with locked states shown until the previous level is activated.

Assets live in `assets/miners/` as level-specific SVG artwork for the five mining families across Levels 1–50, plus tier/fallback artwork. Each level card can therefore use its own miner visual while stats and prices remain driven by Supabase.


## Current Supabase
NextGen Miner is configured for `mmqprhuvhghyuvudsyma`. Do not point the frontend back to the deleted/legacy Supabase project.

Payment destinations now include 21 active owner-controlled manual destinations, including USDT TRC20/ERC20/BEP20, USDC (Solana/SPL), TRX, TON, XLM, SOL, XRP, POL, PEPE and XMR.
