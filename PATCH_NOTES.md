# NEXTGEN MINER — CORRECTED FULL FILE PACKAGE

This ZIP has been rebuilt and independently verified.

Required files:
- components/landing/LandingPage.tsx
- components/landing/NetworkCore.tsx
- css/landing-neon-frame.css
- public/assets/landing/hologram-earth-360.png
- PATCH_NOTES.md

The previous package was defective: only the PNG and PATCH_NOTES.md made it into the ZIP. This package is specifically rebuilt with the three source files included at their repository-root paths.

## Manual GitHub placement

Copy each file exactly to:

components/landing/LandingPage.tsx
components/landing/NetworkCore.tsx
css/landing-neon-frame.css
public/assets/landing/hologram-earth-360.png

## Supabase

LandingPage keeps the existing server-side RPC:
nextgen_get_registration_bonus_status

No client-side Supabase secret or service-role key is introduced.

## Vercel

No Vercel configuration change is required. The code uses local public assets through next/image and remains compatible with a normal Next.js production deployment.

## Important CSS note

If your repository already has a large landing stylesheet, do not blindly delete it. The supplied CSS contains the required Network Core styles and mobile protection. You can merge/append it to the existing landing CSS if that stylesheet already contains the rest of your site's visual system.

## Network Core

The globe is isolated from the rest of the page. Its transparent Earth asset is surrounded by independent orbital planes, network nodes, scan and aura. The animation is continuous and respects prefers-reduced-motion.

The visual is a convincing 360° holographic presentation; it is not a heavy WebGL/Three.js renderer.
