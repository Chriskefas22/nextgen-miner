# NextGenMiner Telegram Quest Patch

Repository target: `Chriskefas22/nextgen-miner`

## Files

- `lib/telegram.ts`
- `app/api/telegram/auth/route.ts`
- `app/api/telegram/verify/route.ts`
- `app/api/telegram/webhook/route.ts`
- `components/quests/TelegramQuest.tsx`
- `components/quests/types.ts`
- `app/quests/page.tsx`
- `components/layout/Sidebar.tsx`
- `supabase/migrations/20260927150952_nextgen_telegram_quest.sql`
- `supabase/migrations/20260927152000_nextgen_telegram_rls_policy_hardening.sql`
- `docs/telegram-quest-setup.md`

The Supabase migrations are already applied to the NextGen Miner Supabase project as `20260927150952_nextgen_telegram_quest` and `20260927152000_nextgen_telegram_rls_policy_hardening`. The SQL files are included so the Git repository remains in sync with the database change.
