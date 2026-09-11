# NextGen Miner Landing V6

Visual-only patch for the landing page.

## Replace these files

- `components/landing/NetworkCore.tsx`
- `app/landing-page.css`

## What changed

### Holographic Earth
- Keeps real Three.js WebGL rendering.
- Uses the existing Earth equirectangular texture as a land/ocean signal so continents/islands remain visible.
- Landmasses are re-colored into cyan/mint hologram tones instead of becoming a blank wireframe globe.
- 360° 3D rotation remains enabled.
- Network nodes and route arcs rotate with the Earth.
- A separate, slower master orbit system surrounds the Earth.
- Mobile DPR and globe scale are reduced for smoother Android performance.

### Entry GPU
- Removed the second competing CSS orbit entirely.
- The remaining HUD ring no longer rotates around the GPU independently.
- It uses one calm pulse animation, synchronized visually with the platform glow.
- GPU itself stays stationary and remains the focal point.

## No finance/auth/Supabase changes
This patch changes only landing visual code. It does not modify wallet, deposit, withdrawal, auth, bonus RPC, or database logic.

Suggested commit:
`V6 holographic Earth landmasses and elegant GPU HUD`
