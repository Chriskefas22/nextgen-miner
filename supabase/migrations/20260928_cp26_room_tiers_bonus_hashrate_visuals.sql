-- NEXTGEN MINER CP26
-- 2026-09-28
-- Room tiers + Room H/s bonus + fixed 12-slot rooms + room-aware settlement.
--
-- Locked values:
-- L1 Standard  : FREE       +0%  12 slots
-- L2 Advanced  : 25,000     +5%  12 slots
-- L3 Premium   : 75,000    +10%  12 slots
-- L4 Legendary : 250,000   +20%  12 slots
-- L5 Mythical  : 750,000   +35%  12 slots

alter table public.nextgen_room_level_config
  add column if not exists bonus_hashrate_percent numeric(6,2) not null default 0,
  add column if not exists visual_key text not null default 'standard',
  add column if not exists subtitle text not null default 'Basic Room',
  add column if not exists description text not null default '';

alter table public.nextgen_mining_rooms
  add column if not exists room_bonus_percent numeric(6,2) not null default 0,
  add column if not exists visual_key text not null default 'standard';

alter table public.nextgen_mining_rooms
  drop constraint if exists nextgen_mining_rooms_capacity_slots_check,
  drop constraint if exists nextgen_mining_rooms_capacity_slots_max_check;

alter table public.nextgen_mining_rooms
  add constraint nextgen_mining_rooms_capacity_slots_exact_check
  check (capacity_slots = 12);

update public.nextgen_room_level_config
set capacity_slots=12,
    upgrade_price_diamond=case room_level
      when 1 then 0
      when 2 then 25000
      when 3 then 75000
      when 4 then 250000
      when 5 then 750000
      else upgrade_price_diamond
    end,
    bonus_hashrate_percent=case room_level
      when 1 then 0
      when 2 then 5
      when 3 then 10
      when 4 then 20
      when 5 then 35
      else 0
    end,
    visual_key=case room_level
      when 1 then 'standard'
      when 2 then 'advanced'
      when 3 then 'premium'
      when 4 then 'legendary'
      when 5 then 'mythical'
      else 'standard'
    end,
    label=case room_level
      when 1 then 'STANDARD ROOM'
      when 2 then 'ADVANCED ROOM'
      when 3 then 'PREMIUM ROOM'
      when 4 then 'LEGENDARY ROOM'
      when 5 then 'MYTHICAL ROOM'
      else label
    end,
    subtitle=case room_level
      when 1 then 'Basic Room'
      when 2 then 'Enhanced Room'
      when 3 then 'Elite Room'
      when 4 then 'Legendary Room'
      when 5 then 'Mythical Room'
      else subtitle
    end,
    description=case room_level
      when 1 then 'Clean industrial starter room with stable lighting and simple mining racks.'
      when 2 then 'High-tech mining facility with blue lighting, cooling, monitors, and moving vents.'
      when 3 then 'Premium neon reactor room with holograms, energy tubes, and floating particles.'
      when 4 then 'Legendary reactor chamber with golden energy, dynamic lighting, and a powerful core.'
      when 5 then 'Living cosmic mining environment with glowing nature, energy flow, crystals, and nebula effects.'
      else description
    end,
    updated_at=now();

insert into public.nextgen_room_level_config(
  room_level,capacity_slots,upgrade_price_diamond,label,updated_at,
  bonus_hashrate_percent,visual_key,subtitle,description
)
values
  (1,12,0,'STANDARD ROOM',now(),0,'standard','Basic Room','Clean industrial starter room with stable lighting and simple mining racks.'),
  (2,12,25000,'ADVANCED ROOM',now(),5,'advanced','Enhanced Room','High-tech mining facility with blue lighting, cooling, monitors, and moving vents.'),
  (3,12,75000,'PREMIUM ROOM',now(),10,'premium','Elite Room','Premium neon reactor room with holograms, energy tubes, and floating particles.'),
  (4,12,250000,'LEGENDARY ROOM',now(),20,'legendary','Legendary Room','Legendary reactor chamber with golden energy, dynamic lighting, and a powerful core.'),
  (5,12,750000,'MYTHICAL ROOM',now(),35,'mythical','Mythical Room','Living cosmic mining environment with glowing nature, energy flow, crystals, and nebula effects.')
on conflict (room_level) do update set
  capacity_slots=excluded.capacity_slots,
  upgrade_price_diamond=excluded.upgrade_price_diamond,
  label=excluded.label,
  updated_at=excluded.updated_at,
  bonus_hashrate_percent=excluded.bonus_hashrate_percent,
  visual_key=excluded.visual_key,
  subtitle=excluded.subtitle,
  description=excluded.description;

update public.nextgen_room_unlock_config
set unlock_price_diamond=case room_number
    when 1 then 0
    when 2 then 25000
    when 3 then 75000
    when 4 then 250000
    when 5 then 750000
    else unlock_price_diamond
  end,
  label=case room_number
    when 1 then 'STANDARD ROOM'
    when 2 then 'ADVANCED ROOM'
    when 3 then 'PREMIUM ROOM'
    when 4 then 'LEGENDARY ROOM'
    when 5 then 'MYTHICAL ROOM'
    else label
  end,
  updated_at=now();

update public.nextgen_mining_rooms r
set capacity_slots=12,
    room_bonus_percent=coalesce(cfg.bonus_hashrate_percent,0),
    visual_key=coalesce(cfg.visual_key,'standard'),
    name=coalesce(cfg.label,r.name),
    updated_at=now()
from public.nextgen_room_level_config cfg
where cfg.room_level=r.room_level;

-- Legacy users receive Room 01 free. No wallet deduction.
insert into public.nextgen_mining_rooms(
  user_id,room_number,name,capacity_slots,room_level,total_spent_diamond,
  room_bonus_percent,visual_key
)
select u.id,1,'STANDARD ROOM',12,1,0,0,'standard'
from auth.users u
where not exists (
  select 1 from public.nextgen_mining_rooms r
  where r.user_id=u.id and r.room_number=1
);

create or replace function public.nextgen_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.nextgen_wallets(user_id)
  values(new.id)
  on conflict(user_id) do nothing;

  insert into public.nextgen_mining_rooms(
    user_id,room_number,name,capacity_slots,room_level,total_spent_diamond,
    room_bonus_percent,visual_key
  )
  values(new.id,1,'STANDARD ROOM',12,1,0,0,'standard')
  on conflict(user_id,room_number) do nothing;

  return new;
end;
$function$;

revoke all on function public.nextgen_handle_new_user() from public;
revoke execute on function public.nextgen_handle_new_user() from authenticated;

-- Canonical room snapshot: 5 tiered rooms, 12 slots each, Room bonus applied once.
create or replace function public.nextgen_rooms_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid:=auth.uid();
  room_count integer:=0;
  next_room integer:=1;
  next_cfg public.nextgen_room_unlock_config%rowtype;
  result jsonb:='[]'::jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select count(*)::integer, coalesce(max(room_number)+1,1)
  into room_count,next_room
  from public.nextgen_mining_rooms
  where user_id=uid;

  next_room:=least(greatest(next_room,1),5);

  select * into next_cfg
  from public.nextgen_room_unlock_config
  where room_number=next_room;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',r.id,
      'room_number',r.room_number,
      'name',coalesce(cfg.label,r.name),
      'room_level',r.room_level,
      'room_label',coalesce(cfg.subtitle,'Room'),
      'room_description',coalesce(cfg.description,''),
      'room_bonus_percent',coalesce(r.room_bonus_percent,cfg.bonus_hashrate_percent,0),
      'visual_key',coalesce(r.visual_key,cfg.visual_key,'standard'),
      'capacity_slots',12,
      'used_slots',(select count(*) from public.nextgen_miner_room_slots s where s.room_id=r.id),
      'empty_slots',greatest(12-(select count(*) from public.nextgen_miner_room_slots s where s.room_id=r.id),0),
      'active_miners',(
        select count(*)
        from public.nextgen_miner_room_slots s
        join public.nextgen_user_miners um on um.id=s.user_miner_id
        where s.room_id=r.id
          and um.status='active'
          and um.deployment_state='deployed'
          and um.is_merged=false
      ),
      'hashrate',coalesce((
        select sum(
          l.hashrate
          * (1+coalesce(um.bonus_hashrate_percent,0)/100.0)
          * (1+coalesce(r.room_bonus_percent,cfg.bonus_hashrate_percent,0)/100.0)
        )
        from public.nextgen_miner_room_slots s
        join public.nextgen_user_miners um on um.id=s.user_miner_id
        join public.nextgen_miner_levels l on l.miner_id=um.miner_id and l.level=um.current_level
        where s.room_id=r.id
          and um.is_merged=false
          and um.status='active'
          and um.deployment_state='deployed'
      ),0),
      'power_watts',coalesce((
        select sum(coalesce(mc.base_power_watts,0)*coalesce(l.hashrate,0)/nullif(mc.base_hashrate,0))
        from public.nextgen_miner_room_slots s
        join public.nextgen_user_miners um on um.id=s.user_miner_id
        join public.nextgen_miner_catalog mc on mc.id=um.miner_id
        join public.nextgen_miner_levels l on l.miner_id=um.miner_id and l.level=um.current_level
        where s.room_id=r.id
          and um.is_merged=false
          and um.status='active'
          and um.deployment_state='deployed'
      ),0),
      'total_spent_diamond',coalesce(r.total_spent_diamond,0),
      'upgrade',jsonb_build_object('available',false,'next_level',null,'next_capacity_slots',12,'price_diamond',0,'label','ROOM TIER IS FIXED'),
      'slots',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'slot_index',s.slot_index,
            'user_miner_id',um.id,
            'miner_id',um.miner_id,
            'name',mc.name,
            'slug',mc.slug,
            'tier',mc.tier,
            'level',um.current_level,
            'hashrate',coalesce(l.hashrate,0)*(1+coalesce(um.bonus_hashrate_percent,0)/100.0),
            'room_effective_hashrate',coalesce(l.hashrate,0)*(1+coalesce(um.bonus_hashrate_percent,0)/100.0)*(1+coalesce(r.room_bonus_percent,cfg.bonus_hashrate_percent,0)/100.0),
            'bonus_hashrate_percent',coalesce(um.bonus_hashrate_percent,0),
            'room_bonus_percent',coalesce(r.room_bonus_percent,cfg.bonus_hashrate_percent,0),
            'power_watts',round(coalesce(mc.base_power_watts,0)*coalesce(l.hashrate,0)/nullif(mc.base_hashrate,0),0),
            'status',um.status,
            'deployment_state',coalesce(um.deployment_state,'deployed'),
            'recharge_expires_at',um.recharge_expires_at,
            'image_path',mc.image_path
          ) order by s.slot_index
        )
        from public.nextgen_miner_room_slots s
        join public.nextgen_user_miners um on um.id=s.user_miner_id
        join public.nextgen_miner_catalog mc on mc.id=um.miner_id
        join public.nextgen_miner_levels l on l.miner_id=um.miner_id and l.level=um.current_level
        where s.room_id=r.id and um.is_merged=false
      ),'[]'::jsonb)
    ) order by r.room_number
  ),'[]'::jsonb) into result
  from public.nextgen_mining_rooms r
  left join public.nextgen_room_level_config cfg on cfg.room_level=r.room_level
  where r.user_id=uid;

  return jsonb_build_object(
    'room_count',room_count,
    'max_rooms',5,
    'next_room_number',case when room_count>=5 then null else next_room end,
    'next_room_unlock_price_diamond',case when room_count>=5 then 0 else coalesce(next_cfg.unlock_price_diamond,0) end,
    'next_room_level',case when room_count>=5 then null else next_room end,
    'next_room_label',case when room_count>=5 then null else coalesce((select subtitle from public.nextgen_room_level_config where room_level=next_room),'') end,
    'next_room_bonus_percent',case when room_count>=5 then null else coalesce((select bonus_hashrate_percent from public.nextgen_room_level_config where room_level=next_room),0) end,
    'rooms',result
  );
end;
$function$;

revoke all on function public.nextgen_rooms_snapshot() from public;
grant execute on function public.nextgen_rooms_snapshot() to authenticated;

-- Room 02-05 are separate tiered rooms, each fixed at 12 slots.
create or replace function public.nextgen_create_room()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid:=auth.uid();
  w public.nextgen_wallets%rowtype;
  room_no integer;
  fee numeric:=0;
  cfg public.nextgen_room_unlock_config%rowtype;
  tier_cfg public.nextgen_room_level_config%rowtype;
  rid bigint;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('nextgen_room_unlock:'||uid::text,20260928));

  insert into public.nextgen_mining_rooms(
    user_id,room_number,name,capacity_slots,room_level,total_spent_diamond,room_bonus_percent,visual_key
  ) values(uid,1,'STANDARD ROOM',12,1,0,0,'standard')
  on conflict(user_id,room_number) do nothing;

  select coalesce(max(room_number),0)+1 into room_no
  from public.nextgen_mining_rooms where user_id=uid;
  if room_no>5 then raise exception 'MAX_ROOMS_REACHED'; end if;

  select * into cfg from public.nextgen_room_unlock_config where room_number=room_no;
  if not found then raise exception 'ROOM_PRICE_NOT_CONFIGURED'; end if;
  select * into tier_cfg from public.nextgen_room_level_config where room_level=room_no;
  if not found then raise exception 'ROOM_LEVEL_NOT_CONFIGURED'; end if;
  fee:=coalesce(cfg.unlock_price_diamond,0);

  select * into w from public.nextgen_wallets where user_id=uid for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if coalesce(w.diamond_balance,0)<fee then raise exception 'INSUFFICIENT_DIAMOND'; end if;

  insert into public.nextgen_mining_rooms(
    user_id,room_number,name,capacity_slots,room_level,total_spent_diamond,room_bonus_percent,visual_key
  ) values(
    uid,room_no,cfg.label,12,room_no,fee,coalesce(tier_cfg.bonus_hashrate_percent,0),coalesce(tier_cfg.visual_key,'standard')
  ) returning id into rid;

  update public.nextgen_wallets set diamond_balance=diamond_balance-fee,updated_at=now() where user_id=uid;

  insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,usd_delta,asset,network,reference_id,note)
  values(uid,'room_unlock',-fee,0,'diamond','internal',rid::text,format('Unlocked %s for %s Diamond',cfg.label,fee));

  return jsonb_build_object(
    'ok',true,'room_id',rid,'room_number',room_no,'room_level',room_no,'capacity_slots',12,
    'unlock_price_diamond',fee,'room_bonus_percent',coalesce(tier_cfg.bonus_hashrate_percent,0),
    'visual_key',coalesce(tier_cfg.visual_key,'standard'),'label',tier_cfg.label
  );
end;
$function$;

revoke all on function public.nextgen_create_room() from public;
grant execute on function public.nextgen_create_room() to authenticated;

-- The old capacity-upgrade path is retired. Room tiers are purchased by unlocking the next Room.
create or replace function public.nextgen_upgrade_room(p_room_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  raise exception 'ROOM_UPGRADE_DISABLED: rooms are tiered assets; unlock the next Room instead';
end;
$function$;

revoke all on function public.nextgen_upgrade_room(bigint) from public;
grant execute on function public.nextgen_upgrade_room(bigint) to authenticated;

-- IMPORTANT: the production CP26 deployment also patches these existing authoritative functions
-- so Room bonus and deployed-room membership are included exactly once:
--   nextgen_deploy_miner
--   nextgen_merge_miners
--   nextgen_prepare_mining_day
--   nextgen_live_mining_snapshot
--   nextgen_economic_capacity_snapshot_internal
--   nextgen_mining_dashboard_snapshot
--
-- The production functions were patched automatically by the deployment assistant. The GitHub
-- source migration remains the source-control record for this checkpoint; do not execute a second
-- overlapping patch on production without comparing the current function definitions first.
