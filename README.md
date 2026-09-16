# Living Holographic Earth v4

Replace:
- `components/home/HolographicEarth.tsx`
- `components/home/HolographicEarth.module.css`

Key fix:
- City lights are no longer hardcoded directly onto geographic coordinates.
- The loaded Earth texture is sampled once and used as a land mask.
- Candidate lights are accepted only when the exact displayed Earth texture identifies that UV area as land.
- Candidates near coastlines are checked in a local neighbourhood.
- Placement is deterministic and region-based, not random global.
- All lights remain inside the same master 3D system and therefore rotate with Earth.
- Mobile uses fewer light candidates.
- Existing region depth/labels, rings, orbit, inertia and responsive behavior remain intact.

No Supabase, API, route or Vercel configuration changes are required.
