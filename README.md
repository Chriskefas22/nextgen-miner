# V18 — Wordmark Fix

Root cause:
V17 added a global selector `.ng-fp .brand span span` that also matched the
nested spans inside the CSS-module BrandLink wordmark. That selector could
override the intended `BrandLink.module.css` colors.

V18 removes the entire V17 global wordmark override.

The canonical styling is already correctly defined in:
`components/branding/BrandLink.module.css`

Expected result:
- NEXTGEN = premium ice white
- MINER = cyan → blue → violet
- Mobile sizing remains intact
- No generic global selector can override the CSS-module wordmark

Files:
- `app/brand-mobile-polish.css`
- `components/branding/BrandLink.module.css` (included as the known-good reference)

Commit suggestion:
`fix: definitive BrandLink wordmark styling`
