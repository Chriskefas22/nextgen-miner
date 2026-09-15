-- CP20.2-C — Security hardening.
-- Remove anonymous/authenticated EXECUTE from internal owner/test SECURITY DEFINER RPCs.
-- Landing telemetry remains intentionally public.

begin;
revoke execute on function public.nextgen_cp18_free_bonus_policy_snapshot() from anon, authenticated, public;
revoke execute on function public.nextgen_cp19_activation_gate(text) from anon, authenticated, public;
revoke execute on function public.nextgen_cp19_live_event_trace(bigint) from anon, authenticated, public;
revoke execute on function public.nextgen_cp19_monitor_activation(text) from anon, authenticated, public;
revoke execute on function public.nextgen_cp18_adversarial_simulation() from anon, authenticated, public;
revoke execute on function public.nextgen_cp18_capacity_thresholds() from anon, authenticated, public;
revoke execute on function public.nextgen_economic_abuse_test_snapshot() from anon, authenticated, public;
revoke execute on function public.nextgen_economic_stress_test(numeric[],numeric[],numeric,numeric) from anon, authenticated, public;
grant execute on function public.nextgen_get_landing_telemetry() to anon, authenticated;
commit;
