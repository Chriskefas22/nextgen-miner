-- NEXTGEN MINER: fixed 12-slot-per-room model
-- Each Room is a separate workspace; up to 5 Rooms = up to 60 total slots.

update public.nextgen_room_level_config
set capacity_slots = 12,
    updated_at = now();

update public.nextgen_mining_rooms
set capacity_slots = 12,
    updated_at = now()
where capacity_slots <> 12;

alter table public.nextgen_mining_rooms
  drop constraint if exists nextgen_mining_rooms_capacity_slots_max_check;

alter table public.nextgen_mining_rooms
  add constraint nextgen_mining_rooms_capacity_slots_max_check
  check (capacity_slots between 1 and 12);

-- Keep Room level upgrades in the /rooms selector, but never let an upgrade
-- expand physical slot capacity beyond 12. The config table above already
-- carries 12 for all levels.

do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_sql
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='nextgen_upgrade_room'
    and pg_get_function_identity_arguments(p.oid)='p_room_id bigint'
  order by p.oid desc limit 1;

  if v_sql is not null then
    v_old := 'capacity_slots=next_cfg.capacity_slots,';
    v_new := 'capacity_slots=least(greatest(coalesce(capacity_slots,12),1),12),';
    if position(v_old in v_sql) > 0 then
      execute replace(v_sql,v_old,v_new);
    end if;
  end if;
end
$patch$;

-- Include each persisted purchase/merge bonus in Room rack payloads.
do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_sql
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='nextgen_rooms_snapshot'
    and pg_get_function_identity_arguments(p.oid)=''
  order by p.oid desc limit 1;

  if v_sql is not null then
    v_old := $$'hashrate',coalesce(l.hashrate,0)*(1+coalesce(um.bonus_hashrate_percent,0)/100.0),
            'power_watts'$$;
    v_new := $$'hashrate',coalesce(l.hashrate,0)*(1+coalesce(um.bonus_hashrate_percent,0)/100.0),
            'bonus_hashrate_percent',coalesce(um.bonus_hashrate_percent,0),
            'power_watts'$$;
    if position(v_old in v_sql) > 0 then
      execute replace(v_sql,v_old,v_new);
    end if;
  end if;
end
$patch$;
