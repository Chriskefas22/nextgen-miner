begin;
revoke all on table public.nextgen_reserve_ledger from anon,authenticated;
revoke all on table public.nextgen_mining_liability_ledger from anon,authenticated;
revoke all on table public.nextgen_mining_payouts from anon,authenticated;
revoke all on table public.nextgen_mining_revenue_lots from anon,authenticated;
revoke all on table public.nextgen_mining_daily_pools from anon,authenticated;
revoke all on table public.nextgen_mining_daily_user_weights from anon,authenticated;
commit;
