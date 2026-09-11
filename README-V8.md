# NextGen Miner Landing V8 — Final Polish

Focused on first impression, visual hierarchy, live network activity, and mobile polish.

## Files
- components/landing/LandingPage.tsx
- app/landing-page.css

## What changed
- Added a compact live-network chip to the hero using existing server telemetry.
- Added a LIVE NETWORK ACTIVITY strip between trust and Network Core, using real Supabase telemetry and generated timestamp.
- Strengthened CTA hierarchy with a restrained light sweep.
- Refined GPU presentation with a slow static glow only; no orbit/ring animation is used.
- Improved mobile typography, spacing, live strip layout, and CTA sizing.
- Preserved the V7 holographic Earth and synchronized surface-node architecture.
- No Supabase schema/RPC, wallet, auth, deposit, withdrawal, or finance logic changed.

## GitHub
Replace only the two files above.

Suggested commit:
`V8 final landing polish and mobile visual hierarchy`
