# NextGen Miner — Public Website Final Patch

Manual-upload package. This patch is intentionally limited to public website/referral presentation.

## Fixed
- Missing `css/public-pages.css` that currently blocks the Vercel build.
- Landing hero now actually renders `/assets/landing/nextgen-miner-hero.png` via `next/image`.
- Landing footer now includes About, FAQ, Referral Program, Contact, Privacy, Terms and Disclaimer.
- Landing campaign copy no longer presents an unconditional reward promise; it reflects eligibility + remaining allocation.
- `/referrals` is now a PUBLIC referral-program information page.
- `/dashboard/referrals` is the PRIVATE authenticated referral dashboard.
- Referral dashboard continues to use the existing server-side RPC and dynamic referral totals.
- Clipboard fallback added for browsers where `navigator.clipboard` is unavailable.

## Upload these exact paths
1. `css/public-pages.css`
2. `components/landing/LandingPage.tsx`
3. `components/public/PublicPage.tsx`
4. `components/referrals/ReferralPanel.tsx`
5. `app/referrals/page.tsx`
6. `app/dashboard/referrals/page.tsx`

## Not changed
Wallet, deposit submit/review, withdrawal flows, finance/transactions, Supabase referral schema/RPCs,
auth security, miner purchases and miner upgrades.

## Legal
Operator identity, registered address, jurisdiction and applicable-law details remain intentionally
uninvented in the existing legal pages and must be filled with the real entity data before commercial launch.

## Verification after upload
Build first, then test `/`, `/about`, `/faq`, `/referrals`, `/contact`, `/legal/privacy`,
`/legal/terms`, `/legal/disclaimer` and signed-in `/dashboard/referrals`.
