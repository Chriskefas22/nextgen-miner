NEXTGEN MINER — LANDING V4 VISUAL CLEANUP

Replace these files on GitHub:
1. components/landing/LandingPage.tsx
2. app/landing-page.css

Changes:
- Removes the duplicate foreground copy of nextgen-miner-hero.png; the hero scene now renders once as the full-bleed background, preventing the desktop rectangular/cropped image artifact.
- Repositions and slightly strengthens the hero background so the miner remains visible.
- Shrinks the Three.js Earth visual footprint on desktop/tablet/mobile while preserving the 3D engine and rotation.
- Synchronizes Entry GPU orbit animations to one 9s timing and same direction.
- No Supabase, wallet, auth, bonus RPC, finance, or package changes.

Suggested commit message:
Fix landing hero, globe scale, and GPU orbit sync
