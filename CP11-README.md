# NEXTGEN MINER — CP11 Public Website & Compliance

This patch completes the code-side portion of Stage 1 while keeping the frozen landing page untouched.

## Files changed

- `.env.example`
- `lib/site-config.ts`
- `components/public/PublicPage.tsx`
- `app/contact/page.tsx`
- `app/about/page.tsx`
- `app/legal/privacy/page.tsx`
- `app/legal/terms/page.tsx`
- `app/legal/disclaimer/page.tsx`
- `app/layout.tsx`
- `app/robots.ts`
- `app/sitemap.ts`
- `app/not-found.tsx`
- `app/error.tsx`
- `app/global-error.tsx`
- `tsconfig.json`

## What is fixed

- Contact no longer renders an unconfigured/placeholder contact state.
- Contact always exposes the Support Center as a stable support path.
- Optional social links are omitted when not configured or invalid.
- Support email is accepted only when it passes basic email validation.
- Legal pages no longer use product-oriented `draft/template` language.
- Legal pages have explicit effective dates.
- Age/eligibility language is centralized.
- Legal identity and jurisdiction are surfaced only when the complete operator identity is configured.
- No code claims that commercial launch is technically blocked by this UI; readiness remains incomplete until required deployment/legal values exist.
- Privacy disclosure names the actual current hosting/database/authentication stack and avoids presenting staged monetization providers as active processors.
- Sitemap includes the core public pages and all legal pages.
- 404 and error states return users to safe public routes instead of forcing anonymous visitors into Dashboard.
- A root `global-error.tsx` is included for failures that occur outside the normal error boundary.
- `tsconfig.json` excludes Supabase Edge Functions from the Next.js application type-check; those functions require their own Deno/Edge validation path.

## Required Vercel Environment Variables before commercial launch

These are public metadata/contact values, not secrets:

- `NEXT_PUBLIC_LEGAL_ENTITY_NAME`
- `NEXT_PUBLIC_LEGAL_JURISDICTION`
- `NEXT_PUBLIC_LEGAL_ADDRESS`
- `NEXT_PUBLIC_SUPPORT_EMAIL`

Optional, only when actually used:

- `NEXT_PUBLIC_DISCORD_URL`
- `NEXT_PUBLIC_TELEGRAM_URL`
- `NEXT_PUBLIC_X_URL`

Do not fabricate any value. Do not use a personal email address unless it is intentionally designated as the official monitored support address.

## Frozen landing page

This patch does NOT modify:

- `components/landing/LandingPage.tsx`
- `components/landing/NetworkCore.tsx`
- `app/landing-page.css`

## Important

CP11 is code-complete for its repository changes, but final legal-identity completion still depends on the actual operator/legal entity, jurisdiction, legal address and official monitored support email being supplied in Vercel Environment Variables.

AdGem and all provider enablement remain outside this checkpoint.
