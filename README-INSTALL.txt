NEXTGEN MINER — COMPLETE BLUEPRINT DASHBOARD PACKAGE

GOAL
This package matches the approved blueprint composition:
header -> welcome/status -> realistic holographic diamond scene -> mining
metrics -> mining overview -> quick actions -> premium membership -> bottom nav.

FILES TO REPLACE / ADD
1. app/dashboard/page.tsx
2. components/hologram/HologramCore.tsx
3. components/layout/AppShell.tsx
4. components/layout/Sidebar.tsx
5. app/layout.tsx
6. styles/blueprint-dashboard.css
7. styles/nav-drawer.css
8. public/assets/hologram/core.svg
9. public/assets/hologram/scene.webp
10. public/assets/hologram/scene.avif (when present)
11. public/assets/hologram/scene.png

IMPORTANT
- Keep app/globals.css. Do NOT delete it.
- Database/RPC logic is not changed.
- Dashboard reads nextgen_user_miners, nextgen_miner_levels, nextgen_wallets.
- The old nextgen-master-ui.png is not used by the new hologram.
- The scene uses WebP/AVIF/PNG fallback while SVG remains the independently
  animated diamond overlay.
- The mobile menu drawer is fixed by the AppShell + Sidebar + nav-drawer CSS.

UPLOAD ORDER
Create asset folder first, then components, then styles, then dashboard page,
then layout. After all files are present, deploy once.

DO NOT DELETE legacy ng_* database tables/RPCs in this visual phase.
