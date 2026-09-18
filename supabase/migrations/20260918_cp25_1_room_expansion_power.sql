/* CP25.1 — ROOM EXPANSION, PRICING, CAPACITY + POWER TELEMETRY */

alter table public.nextgen_miner_catalog add column if not exists base_power_watts numeric;
update public.nextgen_miner_catalog set base_power_watts=case slug when 'starter-keyboard' then 15 when 'basic-cpu' then 50 when 'entry-gpu' then 80 when 'mini-rig' then 180 when 'gaming-pc' then 450 when 'performance-rig' then 700 when 'hydro-rig' then 1200 when 'quantum-rig' then 2500 when 'titan-rig' then 5000 when 'nebula-station' then 9000 when 'orion-core' then 16000 when 'nuclear-reactor' then 30000 else 50 end where base_power_watts is null or base_power_watts<=0;

create table if not exists public.nextgen_room_level_config(
  room_level integer primary key check(room_level between 1 and 5),
  capacity_slots integer not null check(capacity_slots between 12 and 120),
  upgrade_price_diamond numeric not null default 0 check(upgrade_price_diamond>=0),
  label text not null,
  updated_at timestamptz not null default now()
);
insert into public.nextgen_room_level_config(room_level,capacity_slots,upgrade_price_diamond,label) values
(1,12,0,'Starter Bay'),(2,24,20000,'Expanded Bay'),(3,48,60000,'Industrial Bay'),(4,72,180000,'Command Bay'),(5,120,500000,'Mega Bay')
on conflict(room_level) do update set capacity_slots=excluded.capacity_slots,upgrade_price_diamond=excluded.upgrade_price_diamond,label=excluded.label,updated_at=now();

create table if not exists public.nextgen_room_unlock_config(
  room_number integer primary key check(room_number between 1 and 5),
  unlock_price_diamond numeric not null default 0 check(unlock_price_diamond>=0),
  label text not null,
  updated_at timestamptz not null default now()
);
insert into public.nextgen_room_unlock_config(room_number,unlock_price_diamond,label) values
(1,0,'Starter Rack'),(2,100000,'Mining Rack 02'),(3,300000,'Mining Rack 03'),(4,750000,'Mining Rack 04'),(5,1500000,'Mining Rack 05')
on conflict(room_number) do update set unlock_price_diamond=excluded.unlock_price_diamond,label=excluded.label,updated_at=now();

alter table public.nextgen_mining_rooms add column if not exists room_level integer;
alter table public.nextgen_mining_rooms add column if not exists total_spent_diamond numeric not null default 0;
update public.nextgen_mining_rooms set room_level=1,capacity_slots=12 where room_level is null;
alter table public.nextgen_mining_rooms alter column room_level set default 1,alter column room_level set not null;

do $block$ begin
  if not exists(select 1 from pg_constraint where conname='nextgen_mining_rooms_room_level_check' and conrelid='public.nextgen_mining_rooms'::regclass) then
    alter table public.nextgen_mining_rooms add constraint nextgen_mining_rooms_room_level_check check(room_level between 1 and 5);
  end if;
  if not exists(select 1 from pg_constraint where conname='nextgen_mining_rooms_room_number_max5_check' and conrelid='public.nextgen_mining_rooms'::regclass) then
    alter table public.nextgen_mining_rooms add constraint nextgen_mining_rooms_room_number_max5_check check(room_number between 1 and 5);
  end if;
end $block$;

alter table public.nextgen_mining_rooms drop constraint if exists nextgen_mining_rooms_capacity_slots_check;
alter table public.nextgen_mining_rooms add constraint nextgen_mining_rooms_capacity_slots_check check(capacity_slots between 12 and 120);
alter table public.nextgen_miner_room_slots drop constraint if exists nextgen_miner_room_slots_slot_index_check;
alter table public.nextgen_miner_room_slots add constraint nextgen_miner_room_slots_slot_index_check check(slot_index between 1 and 120);
update public.nextgen_mining_rooms r set capacity_slots=coalesce((select c.capacity_slots from public.nextgen_room_level_config c where c.room_level=r.room_level),12),updated_at=now();

alter table public.nextgen_room_level_config enable row level security;
alter table public.nextgen_room_unlock_config enable row level security;
drop policy if exists nextgen_room_level_config_select on public.nextgen_room_level_config;
create policy nextgen_room_level_config_select on public.nextgen_room_level_config for select using(auth.role()='authenticated');
drop policy if exists nextgen_room_unlock_config_select on public.nextgen_room_unlock_config;
create policy nextgen_room_unlock_config_select on public.nextgen_room_unlock_config for select using(auth.role()='authenticated');

create or replace function public.nextgen_rooms_snapshot() returns jsonb language plpgsql security definer stable set search_path to '' as $fn$
declare uid uuid:=auth.uid(); room_count integer:=0; result jsonb:='[]'::jsonb; next_room integer:=1; next_unlock numeric:=0;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select count(*),coalesce(max(room_number)+1,1) into room_count,next_room from public.nextgen_mining_rooms where user_id=uid;
 next_room:=least(greatest(next_room,1),5);
 select coalesce(unlock_price_diamond,0) into next_unlock from public.nextgen_room_unlock_config where room_number=next_room;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'room_number',r.room_number,'name',r.name,'room_level',r.room_level,'room_label',coalesce(lc.label,''),'capacity_slots',r.capacity_slots,
  'used_slots',(select count(*) from public.nextgen_miner_room_slots s where s.room_id=r.id),
  'empty_slots',greatest(r.capacity_slots-(select count(*) from public.nextgen_miner_room_slots s where s.room_id=r.id),0),
  'active_miners',(select count(*) from public.nextgen_miner_room_slots s join public.nextgen_user_miners um on um.id=s.user_miner_id where s.room_id=r.id and um.status='active' and um.is_merged=false),
  'hashrate',coalesce((select sum(l.hashrate) from public.nextgen_miner_room_slots s join public.nextgen_user_miners um on um.id=s.user_miner_id join public.nextgen_miner_levels l on l.miner_id=um.miner_id and l.level=um.current_level where s.room_id=r.id and um.is_merged=false and um.status='active'),0),
  'power_watts',coalesce((select sum(coalesce(mc.base_power_watts,0)*coalesce(l.hashrate,0)/nullif(mc.base_hashrate,0)) from public.nextgen_miner_room_slots s join public.nextgen_user_miners um on um.id=s.user_miner_id join public.nextgen_miner_catalog mc on mc.id=um.miner_id join public.nextgen_miner_levels l on l.miner_id=um.miner_id and l.level=um.current_level where s.room_id=r.id and um.is_merged=false and um.status='active'),0),
  'total_spent_diamond',r.total_spent_diamond,
  'upgrade',case when r.room_level<5 then jsonb_build_object('available',true,'next_level',r.room_level+1,'next_capacity_slots',(select capacity_slots from public.nextgen_room_level_config where room_level=r.room_level+1),'price_diamond',(select upgrade_price_diamond from public.nextgen_room_level_config where room_level=r.room_level+1),'label',(select label from public.nextgen_room_level_config where room_level=r.room_level+1)) else jsonb_build_object('available',false,'next_level',null,'next_capacity_slots',null,'price_diamond',0,'label','MAX') end,
  'slots',coalesce((select jsonb_agg(jsonb_build_object('slot_index',s.slot_index,'user_miner_id',um.id,'miner_id',um.miner_id,'name',mc.name,'slug',mc.slug,'tier',mc.tier,'level',um.current_level,'hashrate',coalesce(l.hashrate,0),'power_watts',round(coalesce(mc.base_power_watts,0)*coalesce(l.hashrate,0)/nullif(mc.base_hashrate,0),0),'status',um.status,'deployment_state',coalesce(um.deployment_state,'deployed'),'recharge_expires_at',um.recharge_expires_at,'image_path',mc.image_path) order by s.slot_index) from public.nextgen_miner_room_slots s join public.nextgen_user_miners um on um.id=s.user_miner_id join public.nextgen_miner_catalog mc on mc.id=um.miner_id join public.nextgen_miner_levels l on l.miner_id=um.miner_id and l.level=um.current_level where s.room_id=r.id),'[]'::jsonb)
 ) order by r.room_number),'[]'::jsonb) into result from public.nextgen_mining_rooms r left join public.nextgen_room_level_config lc on lc.room_level=r.room_level where r.user_id=uid;
 return jsonb_build_object('room_count',room_count,'max_rooms',5,'next_room_number',case when room_count>=5 then null else next_room end,'next_room_unlock_price_diamond',case when room_count>=5 then 0 else next_unlock end,'rooms',result);
end;
$fn$;
revoke all on function public.nextgen_rooms_snapshot() from public,anon; grant execute on function public.nextgen_rooms_snapshot() to authenticated;

create or replace function public.nextgen_create_room() returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare uid uuid:=auth.uid(); w public.nextgen_wallets%rowtype; room_no integer; fee numeric:=0; cfg public.nextgen_room_unlock_config%rowtype; rid bigint;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if; perform pg_advisory_xact_lock(hashtextextended('nextgen_room_unlock:'||uid::text,20250918));
 select coalesce(max(room_number),0)+1 into room_no from public.nextgen_mining_rooms where user_id=uid; if room_no<2 then room_no:=2; end if; if room_no>5 then raise exception 'MAX_ROOMS_REACHED'; end if;
 select * into cfg from public.nextgen_room_unlock_config where room_number=room_no; if not found then raise exception 'ROOM_PRICE_NOT_CONFIGURED'; end if; fee:=coalesce(cfg.unlock_price_diamond,0);
 select * into w from public.nextgen_wallets where user_id=uid for update; if not found then raise exception 'WALLET_NOT_FOUND'; end if; if coalesce(w.diamond_balance,0)<fee then raise exception 'INSUFFICIENT_DIAMOND'; end if;
 insert into public.nextgen_mining_rooms(user_id,room_number,name,capacity_slots,room_level,total_spent_diamond) values(uid,room_no,cfg.label,12,1,fee) returning id into rid;
 update public.nextgen_wallets set diamond_balance=diamond_balance-fee,updated_at=now() where user_id=uid;
 insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,usd_delta,asset,network,reference_id,note) values(uid,'room_unlock',-fee,0,'diamond','internal',rid::text,format('Unlocked Room %s for %s Diamond',room_no,fee));
 return jsonb_build_object('ok',true,'room_id',rid,'room_number',room_no,'room_level',1,'capacity_slots',12,'unlock_price_diamond',fee);
end;
$fn$;
revoke all on function public.nextgen_create_room() from public,anon; grant execute on function public.nextgen_create_room() to authenticated;

create or replace function public.nextgen_upgrade_room(p_room_id bigint) returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare uid uuid:=auth.uid(); r public.nextgen_mining_rooms%rowtype; next_cfg public.nextgen_room_level_config%rowtype; w public.nextgen_wallets%rowtype; used_slots integer:=0; fee numeric:=0;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if; perform pg_advisory_xact_lock(hashtextextended('nextgen_room_upgrade:'||uid::text,20250919));
 select * into r from public.nextgen_mining_rooms where id=p_room_id and user_id=uid for update; if not found then raise exception 'ROOM_NOT_FOUND'; end if; if r.room_level>=5 then raise exception 'ROOM_MAX_LEVEL'; end if;
 select * into next_cfg from public.nextgen_room_level_config where room_level=r.room_level+1; if not found then raise exception 'ROOM_LEVEL_NOT_CONFIGURED'; end if;
 select count(*) into used_slots from public.nextgen_miner_room_slots where room_id=r.id; if used_slots>next_cfg.capacity_slots then raise exception 'ROOM_CAPACITY_CONFLICT'; end if;
 fee:=coalesce(next_cfg.upgrade_price_diamond,0); select * into w from public.nextgen_wallets where user_id=uid for update; if not found then raise exception 'WALLET_NOT_FOUND'; end if; if coalesce(w.diamond_balance,0)<fee then raise exception 'INSUFFICIENT_DIAMOND'; end if;
 update public.nextgen_wallets set diamond_balance=diamond_balance-fee,updated_at=now() where user_id=uid;
 update public.nextgen_mining_rooms set room_level=next_cfg.room_level,capacity_slots=next_cfg.capacity_slots,total_spent_diamond=coalesce(total_spent_diamond,0)+fee,updated_at=now() where id=r.id;
 insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,usd_delta,asset,network,reference_id,note) values(uid,'room_upgrade',-fee,0,'diamond','internal',r.id::text,format('Upgraded Room %s to Level %s for %s Diamond',r.room_number,next_cfg.room_level,fee));
 return jsonb_build_object('ok',true,'room_id',r.id,'room_number',r.room_number,'from_level',r.room_level,'to_level',next_cfg.room_level,'capacity_slots',next_cfg.capacity_slots,'upgrade_price_diamond',fee);
end;
$fn$;
revoke all on function public.nextgen_upgrade_room(bigint) from public,anon; grant execute on function public.nextgen_upgrade_room(bigint) to authenticated;
