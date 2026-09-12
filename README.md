# NextGen Miner V15 — Holographic Brand Logo

This patch upgrades the existing `BrandLink` logo into a premium multi-color holographic N emblem with a CSS-animated energy runner around the frame.

## Changes
- `components/branding/BrandLink.tsx`: new layered SVG logo with cyan/blue/purple/magenta gradients, metallic depth, highlights and moving energy runner.
- `components/branding/BrandLink.module.css`: runner animation, hover polish and reduced-motion handling.
- `public/branding/nextgen-miner-logo.svg`: reusable standalone animated SVG brand asset.
- `app/layout.tsx`: registers the new SVG as site icon and loads the mobile polish stylesheet.
- `app/brand-mobile-polish.css`: prevents hero headline overflow on narrow Android viewports.

## Apply
Replace/add the files in the same repository paths, commit to `main`, then wait for Vercel to build.

The current production deployment had already reached READY before this visual patch; the remaining step is the normal GitHub push so Vercel can build this V15 change.
