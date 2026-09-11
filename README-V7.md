# NextGen Miner Landing V7
## Holographic Earth 360° + Synchronized Surface Nodes + Clean Entry GPU

### Files
- `components/landing/NetworkCore.tsx`
- `app/landing-page.css`

### Visual changes
- Earth is a real Three.js 3D sphere with visible landmasses from the existing Earth texture.
- Earth, holographic grid, routes, and surface nodes now share the same parent rotation.
- All visible surface points use one master pulse clock, so they brighten and scale together.
- Independent floating/orbital Earth nodes were removed.
- Entry GPU has no orbit rings or animated circles. The GPU remains visually stable with a restrained static platform glow.
- No Supabase, wallet, auth, deposit, withdrawal, bonus RPC, or finance logic was changed.

### GitHub
Replace only the two files above.

Suggested commit:
`V7 sync holographic Earth nodes and remove GPU orbit rings`
