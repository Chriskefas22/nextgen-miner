# NextGen Miner — V16 Premium Holographic Brand

Files to copy into GitHub (`main`):

- `components/branding/BrandLink.tsx`
- `components/branding/BrandLink.module.css`
- `public/assets/branding/nextgen-miner-logo.svg`

What changed:
- NEXTGEN uses premium ice-white.
- MINER uses cyan → electric blue → violet gradient.
- Added a restrained animated neon energy runner around the N frame.
- Added a small energy spark that follows the motion.
- Added 3D/glass depth to the N and frame.
- Mobile typography scales down so the brand does not overflow.
- Reduced-motion support disables the animation for accessibility.

Important:
- Keep the existing `LandingPage.tsx` and other application routing unchanged.
- The existing `BrandLink` imports the CSS module from the same directory, so replace both files together.
- The standalone SVG is for favicon/static brand surfaces; the animated website mark remains inline in `BrandLink.tsx`.
