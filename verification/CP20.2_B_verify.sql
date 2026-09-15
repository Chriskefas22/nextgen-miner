-- CP20.2-B post-migration verification
-- Read-only checks. Run after the migration is applied.

select quest_key, enabled, target_count, reward_diamond
from public.nextgen_quests
where quest_key in ('faucet_20','offer_5','ptc_100','shortlink_10')
order by quest_key;

select
  (select enabled from public.nextgen_quests where quest_key='faucet_20') as faucet_quest_enabled,
  (select target_count from public.nextgen_quests where quest_key='faucet_20') as faucet_target,
  (select reward_diamond from public.nextgen_faucet_settings where id=true) as faucet_reward,
  (select daily_cap_diamond from public.nextgen_faucet_settings where id=true) as faucet_daily_cap,
  floor(
    (select daily_cap_diamond from public.nextgen_faucet_settings where id=true)
    /
    nullif((select reward_diamond from public.nextgen_faucet_settings where id=true),0)
  ) as max_claims_per_day;

select
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname='nextgen_upgrade_miner';
