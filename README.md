# NEXTGEN MINER — Real 360° Three.js Earth

This patch upgrades the Global Mining Network visual to a true 3D sphere.

## Install

```bash
npm install three@0.186.0
```

## Copy

```text
components/landing/NetworkCore.tsx
css/landing-neon-frame.css
public/assets/landing/earth-equirectangular.webp
```

`LandingPage.tsx` does not need to change when it already imports `NetworkCore` in the Global Mining Network section.

The Earth texture is local, so the Vercel deployment does not depend on third-party runtime image hosting.
