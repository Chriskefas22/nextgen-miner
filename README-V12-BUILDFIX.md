# NextGen Miner V12 — Build Fix + Brand Integration

Audit found the latest production deployments failing because both
`middleware.ts` and `proxy.ts` exist. The build log is explicit:
"Both middleware file './middleware.ts' and proxy file './proxy.ts' are detected.
Please use './proxy.ts' only."

Apply:
- Replace `lib/supabase/proxy.ts` with the supplied version.
- DELETE the root `middleware.ts`.
- Apply the small LandingPage header import/replacement described in
  `components/landing/LandingPage.tsx.REPLACE-HEADER.txt`.
- Keep all other application content unchanged.

Current official public hostname:
https://nextgen-miner.vercel.app

Current public production routes previously verified:
/
/about
/how-it-works
/miner-catalog
/faq
and the catalog exposes dedicated miner detail routes.

Important:
- The latest failed production deployments are not a live replacement for the
  previously healthy production deployment; Vercel currently serves the last
  successful deployment at the .vercel.app hostname.
- The shared BrandLink has already been pushed to `components/public/PublicPage.tsx`
  and `components/layout/Topbar.tsx`.
- LandingPage also needs the tiny header integration above so the Home page uses
  the same branded auth-aware logo behavior.
