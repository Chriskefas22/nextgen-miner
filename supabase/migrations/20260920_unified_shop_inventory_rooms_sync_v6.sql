-- NEXTGEN MINER — unified Shop -> Inventory -> Rooms sync
-- Idempotent migration; the database changes have been applied to the project.

create or replace function public.nextgen_shop_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  balance numeric := 0;
  miners jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select coalesce(w.diamond_balance,0)
    into balance
  from public.nextgen_wallets w
  where w.user_id=uid;

  select coalesce(jsonb_agg(item order by item->>'sort_order','0'), '[]'::jsonb)
    into miners
  from (
    select jsonb_build_object(
      'catalog_id',m.id,
      'slug',m.slug,
      'name',m.name,
      'tier',m.tier,
      'base_hashrate',m.base_hashrate,
      'purchase_price',m.base_price_diamond,
      'image_path',m.image_path,
      'sort_order',m.sort_order,
      'owned_count',coalesce((select count(*) from public.nextgen_user_miners um
        where um.user_id=uid and um.miner_id=m.id and um.is_merged=false),0),
      'owned',exists(select 1 from public.nextgen_user_miners um
        where um.user_id=uid and um.miner_id=m.id and um.is_merged=false),
      'active',exists(select 1 from public.nextgen_user_miners um
        where um.user_id=uid and um.miner_id=m.id and um.is_merged=false and um.status='active'),
      'deployment_state',case
        when exists(select 1 from public.nextgen_user_miners um
          where um.user_id=uid and um.miner_id=m.id and um.is_merged=false and um.deployment_state='deployed')
          then 'deployed' else 'inventory' end
    ) as item
    from public.nextgen_miner_catalog m
    where m.enabled=true
  ) q;

  return jsonb_build_object(
    'diamond_balance',balance,
    'miners',miners
  );
end;
$function$;

revoke all on function public.nextgen_shop_snapshot() from public;
grant execute on function public.nextgen_shop_snapshot() to authenticated;

create or replace function public.nextgen_inventory_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  balance numeric := 0;
  miners jsonb := '[]'::jsonb;
  rooms jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select coalesce(w.diamond_balance,0)
    into balance
  from public.nextgen_wallets w
  where w.user_id=uid;

  select coalesce(jsonb_agg(item order by item->>'activated_at','0', (item->>'id')::bigint), '[]'::jsonb)
    into miners
  from (
    select jsonb_build_object(
      'id',um.id,
      'miner_id',um.miner_id,
      'current_level',um.current_level,
      'status',um.status,
      'is_merged',um.is_merged,
      'deployment_state',um.deployment_state,
      'recharge_expires_at',um.recharge_expires_at,
      'bonus_hashrate_percent',coalesce(um.bonus_hashrate_percent,0),
      'name',mc.name,
      'slug',mc.slug,
      'tier',mc.tier,
      'image_path',mc.image_path,
      'base_hashrate',coalesce(l.hashrate,mc.base_hashrate),
      'hashrate',coalesce(l.hashrate,0)*(1+coalesce(um.bonus_hashrate_percent,0)/100.0),
      'room_id',rs.room_id,
      'room_number',r.room_number,
      'slot_index',rs.slot_index,
      'merge_ready',case when rs.room_id is null then false else (
        select count(*) >= 2
        from public.nextgen_miner_room_slots s2
        join public.nextgen_user_miners um2 on um2.id=s2.user_miner_id
        where s2.room_id=rs.room_id
          and um2.user_id=uid
          and um2.is_merged=false
          and um2.deployment_state='deployed'
          and um2.status<>'merged'
          and um2.miner_id=um.miner_id
          and um2.current_level=um.current_level
      ) end,
      'activated_at',um.activated_at
    ) as item
    from public.nextgen_user_miners um
    join public.nextgen_miner_catalog mc on mc.id=um.miner_id
    join public.nextgen_miner_levels l on l.miner_id=um.miner_id and l.level=um.current_level
    left join public.nextgen_miner_room_slots rs on rs.user_miner_id=um.id
    left join public.nextgen_mining_rooms r on r.id=rs.room_id
    where um.user_id=uid and um.is_merged=false
  ) q;

  select coalesce((public.nextgen_rooms_snapshot()->>'rooms')::jsonb,'[]'::jsonb)
    into rooms;

  return jsonb_build_object(
    'diamond_balance',balance,
    'miners',miners,
    'rooms',rooms
  );
end;
$function$;

revoke all on function public.nextgen_inventory_snapshot() from public;
grant execute on function public.nextgen_inventory_snapshot() to authenticated;

-- Each Room is a fixed 12-slot workspace.
update public.nextgen_room_level_config
set capacity_slots=12,updated_at=now();

update public.nextgen_mining_rooms
set capacity_slots=12,updated_at=now()
where capacity_slots<>12;

alter table public.nextgen_mining_rooms
  drop constraint if exists nextgen_mining_rooms_capacity_slots_max_check;

alter table public.nextgen_mining_rooms
  add constraint nextgen_mining_rooms_capacity_slots_max_check
  check (capacity_slots between 1 and 12);

-- Manual merge must be same Room and both deployed.
create or replace function public.nextgen_merge_miners(
  p_first_user_miner_id bigint,
  p_second_user_miner_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid:=auth.uid();
  a public.nextgen_user_miners%rowtype;
  b public.nextgen_user_miners%rowtype;
  a_room_id bigint;
  b_room_id bigint;
  a_slot_index integer;
  b_slot_index integer;
  lvl_next public.nextgen_miner_levels%rowtype;
  lvl_current public.nextgen_miner_levels%rowtype;
  fee public.nextgen_miner_merge_fees%rowtype;
  w public.nextgen_wallets%rowtype;
  survivor bigint;
  consumed bigint;
  new_status text;
  new_expiry timestamptz;
  new_energy numeric;
  merge_time timestamptz:=now();
  old_hashrate numeric;
  membership_factor numeric:=1.0;
  old_weight numeric:=0;
  new_weight numeric:=0;
  additional_weight numeric:=0;
  new_bonus_hashrate numeric:=0;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_first_user_miner_id is null
     or p_second_user_miner_id is null
     or p_first_user_miner_id=p_second_user_miner_id
  then raise exception 'INVALID_MERGE_TARGETS'; end if;

  perform pg_advisory_xact_lock(
    hashtext('nextgen_merge:'||
      least(p_first_user_miner_id,p_second_user_miner_id)::text||':'||
      greatest(p_first_user_miner_id,p_second_user_miner_id)::text)
  );

  select * into a from public.nextgen_user_miners
  where id=p_first_user_miner_id and user_id=uid for update;
  if not found then raise exception 'MINER_NOT_FOUND'; end if;

  select * into b from public.nextgen_user_miners
  where id=p_second_user_miner_id and user_id=uid for update;
  if not found then raise exception 'MINER_NOT_FOUND'; end if;

  if a.is_merged or b.is_merged or a.status='merged' or b.status='merged'
  then raise exception 'MINER_ALREADY_MERGED'; end if;

  if a.miner_id<>b.miner_id or a.current_level<>b.current_level
  then raise exception 'MERGE_REQUIRES_IDENTICAL_MINERS'; end if;

  if a.current_level>=10 then raise exception 'MAX_LEVEL'; end if;

  if a.deployment_state<>'deployed' or b.deployment_state<>'deployed'
  then raise exception 'MERGE_REQUIRES_DEPLOYED_MINERS'; end if;

  select s.room_id,s.slot_index into a_room_id,a_slot_index
  from public.nextgen_miner_room_slots s
  join public.nextgen_mining_rooms r on r.id=s.room_id
  where s.user_miner_id=a.id and r.user_id=uid limit 1;

  select s.room_id,s.slot_index into b_room_id,b_slot_index
  from public.nextgen_miner_room_slots s
  join public.nextgen_mining_rooms r on r.id=s.room_id
  where s.user_miner_id=b.id and r.user_id=uid limit 1;

  if a_room_id is null or b_room_id is null
  then raise exception 'MERGE_REQUIRES_ROOM_ASSIGNMENT'; end if;

  if a_room_id<>b_room_id
  then raise exception 'MERGE_REQUIRES_SAME_ROOM'; end if;

  select * into lvl_current from public.nextgen_miner_levels
  where miner_id=a.miner_id and level=a.current_level;

  select * into lvl_next from public.nextgen_miner_levels
  where miner_id=a.miner_id and level=a.current_level+1;

  if not found or lvl_current.hashrate<=0 or lvl_next.hashrate<=0
  then raise exception 'LEVEL_NOT_CONFIGURED'; end if;

  select * into fee from public.nextgen_miner_merge_fees
  where from_level=a.current_level
    and to_level=a.current_level+1
    and active=true;

  if not found then raise exception 'MERGE_FEE_NOT_CONFIGURED'; end if;

  select * into w from public.nextgen_wallets
  where user_id=uid for update;

  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if coalesce(w.diamond_balance,0)<fee.fee_diamond
  then raise exception 'INSUFFICIENT_DIAMOND'; end if;

  new_bonus_hashrate:=public.nextgen_roll_miner_bonus();

  select coalesce(p.mining_factor,1.0) into membership_factor
  from public.nextgen_memberships mm
  join public.nextgen_membership_plans p on p.id=mm.plan_id
  where mm.user_id=uid and mm.status='active'
    and mm.starts_at<=merge_time and mm.expires_at>merge_time
  order by mm.expires_at desc limit 1;

  membership_factor:=coalesce(membership_factor,1.0);

  old_weight:=
    lvl_current.hashrate*(1+coalesce(a.bonus_hashrate_percent,0)/100.0)*
    greatest(lvl_current.efficiency,0)*
    least(greatest(coalesce(a.energy_percent,0),0),100)/100.0*
    membership_factor
    +
    lvl_current.hashrate*(1+coalesce(b.bonus_hashrate_percent,0)/100.0)*
    greatest(lvl_current.efficiency,0)*
    least(greatest(coalesce(b.energy_percent,0),0),100)/100.0*
    membership_factor;

  new_energy:=round(
    (coalesce(a.energy_percent,0)+coalesce(b.energy_percent,0))/2.0,2
  );

  new_weight:=
    lvl_next.hashrate*(1+new_bonus_hashrate/100.0)*
    greatest(lvl_next.efficiency,0)*
    least(greatest(new_energy,0),100)/100.0*
    membership_factor;

  additional_weight:=greatest(new_weight-old_weight,0);

  if additional_weight>0
     and coalesce(a.reward_class,'standard')<>'free_bonus'
  then
    perform public.nextgen_assert_economic_capacity_for_expansion(
      'USDT',additional_weight
    );
  end if;

  survivor:=least(a.id,b.id);
  consumed:=greatest(a.id,b.id);
  old_hashrate:=lvl_current.hashrate;
  new_expiry:=greatest(a.recharge_expires_at,b.recharge_expires_at);
  new_status:=case when new_expiry>merge_time then 'active' else 'paused' end;

  update public.nextgen_user_miners
  set current_level=lvl_next.level,
      bonus_hashrate_percent=new_bonus_hashrate,
      total_spent_diamond=a.total_spent_diamond+b.total_spent_diamond+fee.fee_diamond,
      status=new_status,
      is_merged=false,
      merged_into_user_miner_id=null,
      merged_at=null,
      merge_fee_diamond=fee.fee_diamond,
      last_upgrade_at=merge_time,
      last_recharge_at=greatest(a.last_recharge_at,b.last_recharge_at),
      recharge_expires_at=new_expiry,
      energy_percent=new_energy,
      energy_updated_at=merge_time,
      last_accrual_at=least(a.last_accrual_at,b.last_accrual_at),
      reward_class=case
        when coalesce(a.reward_class,'standard')='free_bonus'
         and coalesce(b.reward_class,'standard')='free_bonus'
        then 'free_bonus'
        else coalesce(a.reward_class,'standard')
      end,
      free_bonus_recovered_usd=case
        when coalesce(a.reward_class,'standard')='free_bonus'
         and coalesce(b.reward_class,'standard')='free_bonus'
        then coalesce(a.free_bonus_recovered_usd,0)+coalesce(b.free_bonus_recovered_usd,0)
        else coalesce(a.free_bonus_recovered_usd,0)
      end
  where id=survivor;

  update public.nextgen_user_miners
  set status='merged',
      is_merged=true,
      merged_into_user_miner_id=survivor,
      merged_at=merge_time,
      merge_fee_diamond=fee.fee_diamond,
      deployment_state='deployed'
  where id=consumed;

  delete from public.nextgen_miner_room_slots
  where user_miner_id=consumed;

  update public.nextgen_wallets
  set diamond_balance=diamond_balance-fee.fee_diamond,
      updated_at=merge_time
  where user_id=uid;

  insert into public.nextgen_transactions(
    user_id,tx_type,diamond_delta,reference_id,note
  )
  values(
    uid,'miner_merge',-fee.fee_diamond,survivor::text,
    format(
      'Merged user miners %s + %s into level %s; fee %s Diamond',
      a.id,b.id,lvl_next.level,fee.fee_diamond
    )
  );

  return jsonb_build_object(
    'ok',true,
    'user_miner_id',survivor,
    'consumed_user_miner_id',consumed,
    'miner_id',a.miner_id,
    'from_level',a.current_level,
    'to_level',lvl_next.level,
    'hashrate',lvl_next.hashrate*(1+new_bonus_hashrate/100.0),
    'base_hashrate',lvl_next.hashrate,
    'bonus_hashrate_percent',new_bonus_hashrate,
    'efficiency',lvl_next.efficiency,
    'merge_fee_diamond',fee.fee_diamond,
    'merge_multiplier',round(lvl_next.hashrate/old_hashrate,4),
    'additional_weighted_hash',additional_weight,
    'reward_class',
      case when coalesce(a.reward_class,'standard')='free_bonus'
        and coalesce(b.reward_class,'standard')='free_bonus'
        then 'free_bonus' else coalesce(a.reward_class,'standard') end,
    'room_id',a_room_id,
    'slot_index',case when survivor=a.id then a_slot_index else b_slot_index end
  );
end;
$function$;

revoke all on function public.nextgen_merge_miners(bigint,bigint) from public;
grant execute on function public.nextgen_merge_miners(bigint,bigint) to authenticated;

-- Live mining estimates must use the same effective hashrate as Room/Inventory.
do $patch$
declare v_sql text;
begin
  select pg_get_functiondef(p.oid) into v_sql
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='nextgen_live_mining_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_asset text'
  order by p.oid desc limit 1;

  if v_sql is not null then
    v_sql:=replace(
      v_sql,
      'select um.reward_class,l.hashrate,l.efficiency,',
      'select um.reward_class,(l.hashrate*(1+coalesce(um.bonus_hashrate_percent,0)/100.0)) as hashrate,l.efficiency,'
    );
    execute v_sql;
  end if;
end
$patch$;
