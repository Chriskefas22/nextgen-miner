# NextGen Miner — Vercel Domain Fix

This patch makes `https://nextgen-miner.vercel.app` the canonical production
site identity and prevents a stale `NEXT_PUBLIC_SITE_URL` value from restoring
the retired `.devs.surf` domain.

Files:
- `lib/site-config.ts` — production URL fixed to `.vercel.app`
- `middleware.ts` — temporary 308 redirect from the retired `.devs.surf`
  hostname to `.vercel.app`

IMPORTANT:
The Vercel project currently has both `nextgenminer.devs.surf` and
`nextgen-miner.vercel.app` attached. Removing the old custom domain is a
Vercel project-domain setting and must be done in the Vercel dashboard.
After removing it, the middleware becomes a harmless safety net because the
old hostname will no longer route to the project.

Do not delete or replace the rest of the repository with this patch. Merge
these files into the repository root.
