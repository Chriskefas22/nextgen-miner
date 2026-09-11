# NextGen Miner Landing Page — manual GitHub patch

Target files:
- `components/landing/LandingPage.tsx`
- `components/landing/NetworkCore.tsx`
- `css/landing-neon-frame.css`

The existing Vercel build error is a parser error in `LandingPage.tsx` around the malformed `bonusHashrate` template expression. `NetworkCore.tsx` is also structurally corrupted, so it is replaced with a valid canvas implementation.

Visual direction:
- Top fold follows the uploaded reference: dark sci-fi header, oversized split hero, cyan/blue/purple glow, four trust blocks, HUD-style Network Core panel, and purple registration campaign.
- The hologram globe is isolated inside the Network Core canvas only.
- Globe animation uses `requestAnimationFrame`, `ResizeObserver`, capped DPR, and `prefers-reduced-motion` so it does not reflow or interfere with surrounding UI.
- Bonus campaign data remains server-driven from `nextgen_get_registration_bonus_status`.
- The bonus card uses the returned miner image path when present, with Entry GPU as the safe fallback.

Supabase changes already applied:
- `nextgen_get_registration_bonus_status()` was changed from SECURITY DEFINER to SECURITY INVOKER.
- `anon` was granted SELECT on `nextgen_registration_bonus_campaigns` and `nextgen_miner_catalog`.
- A narrow public SELECT policy was added for the active launch campaign.
- RPC execution for `anon` was verified; it returned active campaign data with 997 remaining / 3 claimed / 1,000 total.

GitHub:
The connected GitHub write integration returned HTTP 403 when attempting to update the existing files. Therefore these full replacement files are provided for manual copy to the repository.

After copying:
1. `npm run lint`
2. `npm run build`
3. Push to `main`.
4. Vercel's Git integration should create a new deployment automatically.
