# CP24 — Living Earth / Organic Gold Network Lights

This package applies the requested visual behavior:

- Live/Operational Earth receives warm golden lights from the Earth's night side.
- City lights remain bright enough to see, but the flicker amplitude is intentionally subtle.
- Each registered user with a stored country_code contributes one anonymous country-level network light.
- Multiple users in the same country are spread by a small deterministic offset.
- User nodes do not expose exact addresses or coordinates.
- The Home screen shows the shared USDT pool and explains how pool budget and hashrate share relate.
- Registration and dashboard capture country metadata through a server route, preferring platform country headers and falling back to browser timezone/language.
- The network-light RPC has a migration file so the database source of truth is kept in Git.

Run from the repository root:

    python apply_cp24_live_earth.py

The script is marker-checked and stops instead of partially applying if the source has drifted.

Important:
The Supabase migration was already applied directly to the connected project. Keep the SQL migration file in the repository anyway so the codebase remains reproducible.

After running the script:
    git diff -- components/home/HolographicEarth.tsx
    git diff -- components/home/HolographicEarth.module.css
    git diff -- components/home/HomeCommandCenter.tsx
    git diff -- components/home/HomeCommandCenter.module.css
    git diff -- app/auth/register/page.tsx
    git status

Then commit and push to main.
