# NextGen Miner — Landing V5

## Holographic Earth 360° + Synced Entry GPU

This V5 is a visual-only patch. It does not modify Supabase, wallet, finance, auth, bonus RPCs, or deployment configuration.

### Replace these files

```text
components/landing/NetworkCore.tsx
app/landing-page.css
```

### What changed

- Replaced the Earth presentation with a true Three.js holographic 3D globe.
- Earth rotates continuously on the Y axis in real 3D.
- Existing Earth imagery is used as data input for a cyan hologram shader instead of being shown as a normal photographic globe.
- Added holographic scan lines, atmospheric rim glow, planetary wire grid, live network nodes, route arcs, and one synchronized orbital system.
- Reduced globe scale on desktop/mobile so the Earth has breathing room and is not clipped.
- Reworked Entry GPU orbit effects so all rings share one timing system and consistent direction.
- Added a restrained holographic platform pulse around the GPU instead of independent orbit motion crossing the card.
- Added mobile-specific sizing for Android.
- Kept the existing Three.js dependency model and no new npm package is required.

### GitHub commit

Recommended message:

```text
V5 holographic Earth and synchronized GPU animation
```

After pushing, verify the Vercel deployment before doing the final visual audit.
