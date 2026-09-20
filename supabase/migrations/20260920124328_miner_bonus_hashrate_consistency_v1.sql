-- Keep economic capacity and dashboard snapshots aligned with per-miner bonus hashrate.
do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid)
    into v_sql
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='nextgen_economic_capacity_snapshot_internal'
    and pg_get_function_identity_arguments(p.oid)='p_asset text'
  order by p.oid desc
  limit 1;

  if v_sql is not null then
    v_old := 'select um.user_id,um.reward_class,l.hashrate,l.efficiency,';
    v_new := 'select um.user_id,um.reward_class,(l.hashrate*(1+coalesce(um.bonus_hashrate_percent,0)/100.0)) as hashrate,l.efficiency,';
    if position(v_old in v_sql)>0 then
      v_sql := replace(v_sql,v_old,v_new);
      execute v_sql;
    end if;
  end if;

  select pg_get_functiondef(p.oid)
    into v_sql
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='nextgen_mining_dashboard_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_asset text'
  order by p.oid desc
  limit 1;

  if v_sql is not null then
    v_old := 'select count(*)::integer,coalesce(sum(l.hashrate),0) into active_miners,active_hash';
    v_new := 'select count(*)::integer,coalesce(sum(l.hashrate*(1+coalesce(um.bonus_hashrate_percent,0)/100.0)),0) into active_miners,active_hash';
    if position(v_old in v_sql)>0 then
      v_sql := replace(v_sql,v_old,v_new);
      execute v_sql;
    end if;
  end if;
end
$patch$;
