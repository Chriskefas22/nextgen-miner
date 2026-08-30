# NextGen Miner — Canonical Repository Structure

This is the canonical file/folder map for the full rebuild. Do not place application files outside the intended area unless explicitly required by Next.js.

## Rules
- User-facing currency is shown only as 💎. Never display a currency name beside it.
- 12 miners × levels 1–10.
- Cloudflare Turnstile remains enabled for auth and protected actions.
- Supabase is the source of truth for balances, ownership, levels, rewards and transactions.
- Client components never directly mutate balances.
- Secrets stay server-side; no service-role key in browser code.
- Miner artwork is stored as individual optimized assets under `public/assets/miners/`.
- GitHub is source control; Vercel is deployment; Supabase is backend/database/auth/storage.

## Route groups
- `(auth)`: public authentication screens.
- `(app)`: authenticated user application.
- `(legal)`: public legal/policy pages.
- `admin`: protected administration surface.
