# NextGen Miner V9 — Public Experience & Catalog Completeness

## Purpose
This patch completes the public-information layer around the landing page and fixes the miner CTA that previously sent visitors into the authenticated miner shop.

## Included
- `components/landing/LandingPage.tsx`
  - Public nav now links to real About / FAQ / How It Works / Miner Catalog / Referral pages.
  - “View All Miners” now opens the public Miner Catalog.
  - “Find Your Answers” links to the searchable FAQ.
- `app/miner-catalog/page.tsx`
  - Public, server-rendered catalog of currently enabled miners from Supabase.
  - No login required to browse.
  - Shows tier, level range, base hashrate and starting Diamond price.
  - Purchase/ownership actions remain behind authentication.
- `app/miner-catalog/catalog.module.css`
  - Premium product-card visuals for the public catalog.
- `app/how-it-works/page.tsx`
  - Dedicated public explanation of the full user journey, wallet/deposit/withdrawal concepts and system behavior.
- `app/faq/page.tsx`
  - Expanded question set across Account, Miners, Rewards, Wallet, Bonus, Referral, Security, Platform and Legal.
  - Searchable “Find your answer” experience with category filters.
- `components/public/FAQExplorer.tsx`
- `components/public/FAQExplorer.module.css`
- `components/public/PublicPage.tsx`
  - Shared public navigation/footer now connects all public information pages.
- `app/about/page.tsx`
  - Expanded platform overview and how systems connect.
- `app/legal/privacy/page.tsx`
  - Expanded operational privacy coverage with explicit production-finalization notes.
- `app/legal/terms/page.tsx`
  - Expanded operational terms covering accounts, miners, Diamond, rewards, campaigns, deposits, withdrawals, referrals, security and changes.
- `app/landing-page.css`
  - Small public-link polish.

## Deliberately NOT changed
- Wallet logic
- Deposit / withdrawal APIs
- Supabase finance logic
- Authentication logic
- Bonus claim RPC/API
- Owner controls
- Mining accrual / reward logic

## Important production note
The Privacy Policy and Terms are still operational drafts until the actual operating entity, jurisdiction, required legal notices, contact address and retention requirements are finalized. Do not invent legal identity details.

## Suggested commit
`Complete public experience and add unauthenticated miner catalog`
