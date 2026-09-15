-- CP20.2 next verification
select quest_key,target_count,enabled from public.nextgen_quests where quest_key in ('faucet_20','offer_5','ptc_100','shortlink_10') order by quest_key;
select routine_name,security_type,has_function_privilege('anon',specific_schema||'.'||routine_name||'('||coalesce(string_agg(parameter_udt_name,',' order by ordinal_position),'')||')','execute') as anon_exec
from information_schema.routines r left join information_schema.parameters p on p.specific_schema=r.routine_schema and p.specific_name=r.specific_name and p.parameter_mode='IN'
where r.routine_schema='public' and r.routine_name in ('nextgen_cp18_free_bonus_policy_snapshot','nextgen_cp19_activation_gate','nextgen_cp19_live_event_trace','nextgen_cp19_monitor_activation','nextgen_cp18_adversarial_simulation','nextgen_cp18_capacity_thresholds','nextgen_economic_abuse_test_snapshot','nextgen_economic_stress_test')
group by routine_name,security_type,specific_schema,specific_name order by routine_name;
select has_function_privilege('anon','public.nextgen_get_landing_telemetry()','execute') as landing_telemetry_anon_exec;
select has_function_privilege('anon','public.nextgen_purchase_miner(bigint)','execute') as anon_purchase_exec,
       has_function_privilege('authenticated','public.nextgen_purchase_miner(bigint)','execute') as auth_purchase_exec,
       has_function_privilege('anon','public.nextgen_upgrade_miner(bigint)','execute') as anon_upgrade_exec,
       has_function_privilege('authenticated','public.nextgen_upgrade_miner(bigint)','execute') as auth_upgrade_exec,
       has_function_privilege('anon','public.nextgen_merge_miners(bigint,bigint)','execute') as anon_merge_exec,
       has_function_privilege('authenticated','public.nextgen_merge_miners(bigint,bigint)','execute') as auth_merge_exec;
