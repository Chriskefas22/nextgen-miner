# Three.js setup

The new `NetworkCore.tsx` uses Three.js for a real 3D Earth rotation.

From the repository root:

```bash
npm install three@0.186.0
```

Then commit the updated `package.json` and `package-lock.json` (or your package manager's lockfile).

No Supabase environment variables or server credentials are added by this patch. `NetworkCore` is a client-only visual component; the existing Supabase RPC in `LandingPage.tsx` remains server-side.
