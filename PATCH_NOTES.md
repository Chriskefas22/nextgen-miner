# NEXTGEN MINER — TRUE 360° 3D EARTH PATCH

## What changed
- Replaced the previous hand-built WebGL globe with a Three.js scene.
- Earth rotates continuously around the Y axis: ~1 full rotation / 20 seconds.
- Added a separate animated cloud shell, atmosphere rim, network node layer, curved network routes, and independent orbital rings.
- Earth texture is bundled locally as `public/assets/landing/earth-equirectangular.webp`; the runtime does not fetch a remote texture.
- The generated texture is equirectangular (2:1), so it wraps across the full sphere rather than rotating as a flat image.
- Added `prefers-reduced-motion` support.
- Renderer DPR is capped at 1.75 to reduce mobile GPU load.

## Files to copy
- `components/landing/NetworkCore.tsx` — replace the existing file.
- `css/landing-neon-frame.css` — replace/merge the file with the supplied full version.
- `public/assets/landing/earth-equirectangular.webp` — add this asset.
- `THREE_INSTALL.md` — installation note.

## Dependency
Run:

```bash
npm install three@0.186.0
```

Commit the resulting package manifest and lockfile.

## Supabase
No Supabase schema, RPC, keys, or server client behavior is changed. The existing `nextgen_get_registration_bonus_status` flow in `LandingPage.tsx` remains untouched.

## Vercel
This component is marked `'use client'` and only accesses browser APIs inside `useEffect`, so SSR is not required for WebGL. The texture is local under `public/`, which avoids a runtime dependency on GitHub/raw URLs. Vercel will serve the asset as a normal static file.

## Accessibility / performance
- `aria-label` describes the visualization.
- Animation pauses to a static pose when the user requests reduced motion.
- Three.js renderer uses antialiasing and a capped pixel ratio.
- Geometries and materials are disposed on unmount.
