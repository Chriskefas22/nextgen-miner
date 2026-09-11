# NextGen Miner — Public Flow V10

Changes:
1. Production canonical/OpenGraph base remains `https://nextgen-miner.vercel.app`.
2. Public pages now declare route-specific canonical + OpenGraph URL values so `/about`, `/faq`, `/miner-catalog`, legal pages, etc. no longer inherit the home URL.
3. `/miner-catalog` cards open dedicated public miner detail routes.
4. Added `/miner-catalog/[slug]` detail page backed by the live Supabase catalog and level records.
5. Detail CTA goes to `/auth/register?miner=<slug>`. No dashboard redirect is used in the public miner flow.
6. Contact/legal copy remains factual and intentionally does NOT invent the real operator identity, address, jurisdiction, support contacts, or legal entity. Those values must be supplied before commercial launch.
7. The future Cloudflare / Turnstile adjustment is intentionally not mixed into this patch.

Expected flow:
Home → /miner-catalog → /miner-catalog/<slug> → /auth/register → authentication → /dashboard
