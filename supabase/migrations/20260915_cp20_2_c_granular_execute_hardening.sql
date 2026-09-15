begin;

-- CP20.2-C — granular SECURITY DEFINER execute hardening.
-- User-facing RPCs remain executable by authenticated users.
-- Internal economic primitives and owner operational/audit functions are
-- restricted to postgres. Owner dashboard RPCs stay authenticated because
-- the Owner/Admin SSR pages use the standard authenticated Supabase client;
-- those functions enforce nextgen_is_owner() themselves.

revoke execute on function public.nextgen_accrue_mining(text) from public, anon, authenticated;
grant execute on function public.nextgen_accrue_mining(text) to postgres;
revoke execute on function public.nextgen_assert_economic_capacity_for_expansion(text,numeric) from public, anon, authenticated;
grant execute on function public.nextgen_assert_economic_capacity_for_expansion(text,numeric) to postgres;
revoke execute on function public.nextgen_economic_capacity_snapshot(text) from public, anon, authenticated;
grant execute on function public.nextgen_economic_capacity_snapshot(text) to postgres;
revoke execute on function public.nextgen_economic_monitoring_snapshot(text) from public, anon, authenticated;
grant execute on function public.nextgen_economic_monitoring_snapshot(text) to postgres;
revoke execute on function public.nextgen_economic_monitoring_v2_snapshot(text) from public, anon, authenticated;
grant execute on function public.nextgen_economic_monitoring_v2_snapshot(text) to postgres;
revoke execute on function public.nextgen_offerwall_reconciliation_snapshot() from public, anon, authenticated;
grant execute on function public.nextgen_offerwall_reconciliation_snapshot() to postgres;
revoke execute on function public.nextgen_resolve_mining_allocation_bps(numeric) from public, anon, authenticated;
grant execute on function public.nextgen_resolve_mining_allocation_bps(numeric) to postgres;

revoke execute on function public.nextgen_ack_economic_alert(bigint) from public, anon, authenticated;
grant execute on function public.nextgen_ack_economic_alert(bigint) to postgres;
revoke execute on function public.nextgen_ack_economic_anomaly(bigint,text) from public, anon, authenticated;
grant execute on function public.nextgen_ack_economic_anomaly(bigint,text) to postgres;
revoke execute on function public.nextgen_resolve_economic_alert(bigint,text) from public, anon, authenticated;
grant execute on function public.nextgen_resolve_economic_alert(bigint,text) to postgres;
revoke execute on function public.nextgen_resolve_economic_anomaly(bigint,text) from public, anon, authenticated;
grant execute on function public.nextgen_resolve_economic_anomaly(bigint,text) to postgres;

grant execute on function public.nextgen_owner_economic_dashboard_snapshot(text) to authenticated;
grant execute on function public.nextgen_owner_economic_monitoring_dashboard(text) to authenticated;
grant execute on function public.nextgen_economic_liability_audit() to authenticated;

commit;
