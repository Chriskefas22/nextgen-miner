CP06 Economic Integration & Liability Audit

Production migration already applied to Supabase project mmqprhuvhghyuvudsyma.

Commit this migration plus app/admin/page.tsx to GitHub. Landing page files are intentionally untouched.

Migration changes: settlement accepts active economic rule v1.1+, capacity expansion uses a transaction advisory lock, reserve coverage <1.00x is fail-closed for expansion, free miner purchases and owner miner gifts use the same capacity guard, and owner-only liability/revenue/payout/withdrawal audit endpoint is added.

Current production verification: active rule economic_v1_1; latest USDT pool 2026-09-13 has zero recognized revenue/mining budget and expansion is correctly BLOCKED; liability ledger outstanding is zero; one free miner catalog item exists and is now guard-protected.

GitHub write access was denied by the connected integration (HTTP 403), so the two files are provided here for manual push.
