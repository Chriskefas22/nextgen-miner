# CP22 PRODUCTION NOTE

Supabase production was changed directly with:
- CP22 starter mining engine
- CP22.1 live projection alignment
- CP22.2 settlement alias correction

The canonical final SQL in this package is `supabase/migrations/20260915_cp22_starter_free_mining_engine.sql`. The CP22.1 and CP22.2 files are migration-history placeholders because the final consolidated source supersedes their intermediate versions.

Do not execute the migration files again in production; the database is already ahead. Keep them in GitHub as source/history.
