create extension if not exists pgcrypto;

create table public.ng_users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 32),
  status text not null default 'active' check (status in ('active','review','suspended','banned')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_ip inet,
  user_agent text,
  risk_score integer not null default 0 check (risk_score between 0 and 100)
);

create table public.ng_wallets (
  user_id uuid primary key references public.ng_users(id) on delete cascade,
  credit_balance numeric(30,6) not null default 0 check (credit_balance >= 0),
  reserved_credit numeric(30,6) not null default 0 check (reserved_credit >= 0),
  usd_balance numeric(30,8) not null default 0 check (usd_balance >= 0),
  reserved_usd numeric(30,8) not null default 0 check (reserved_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved_credit <= credit_balance),
  check (reserved_usd <= usd_balance)
);

create table public.ng_economy_settings (
  id boolean primary key default true,
  topup_credit_per_usd numeric(30,6) not null default 1000,
  payout_credit_per_usd numeric(30,6) not null default 5000,
  min_deposit_usd numeric(30,8) not null default 0.01,
  max_deposit_usd numeric(30,8) not null default 100000,
  min_withdraw_usd numeric(30,8) not null default 5,
  max_withdraw_usd numeric(30,8) not null default 100000,
  signup_bonus_credit numeric(30,6) not null default 1000,
  exchange_fee_bps integer not null default 100 check (exchange_fee_bps between 0 and 5000),
  updated_at timestamptz not null default now()
);
insert into public.ng_economy_settings default values on conflict (id) do nothing;

create table public.ng_miner_families (
  family text primary key,
  display_name text not null,
  sort_order integer not null,
  primary_resource text not null
);
insert into public.ng_miner_families values
('coal','Coal',1,'Coal'),('copper','Copper',2,'Copper'),('iron','Iron',3,'Iron'),('silver','Silver',4,'Silver'),('gold','Gold',5,'Gold')
on conflict (family) do nothing;

create table public.ng_miner_levels (
  id bigserial primary key,
  family text not null references public.ng_miner_families(family),
  level integer not null check (level between 1 and 50),
  tier text not null check (tier in ('Common','Uncommon','Rare','Epic','Legendary')),
  name text not null,
  price_credit numeric(30,6) not null check (price_credit >= 0),
  hashrate numeric(30,8) not null check (hashrate >= 0),
  income_hour_credit numeric(30,8) not null check (income_hour_credit >= 0),
  income_day_credit numeric(30,8) not null check (income_day_credit >= 0),
  income_month_credit numeric(30,8) not null check (income_month_credit >= 0),
  image_path text not null,
  unique(family,level)
);

insert into public.ng_miner_levels(family,level,tier,name,price_credit,hashrate,income_hour_credit,income_day_credit,income_month_credit,image_path)
select f.family, l.level,
  case when l.level <= 10 then 'Common' when l.level <=20 then 'Uncommon' when l.level <=30 then 'Rare' when l.level <=40 then 'Epic' else 'Legendary' end,
  initcap(f.family)||' Miner L'||l.level,
  round((50 + (l.level-1)*25) * power(1.045,l.level-1),6),
  round(5 * power(1.09,l.level-1),8),
  round((5 * power(1.09,l.level-1))*0.40,8),
  round((5 * power(1.09,l.level-1))*0.40*24,8),
  round((5 * power(1.09,l.level-1))*0.40*24*30,8),
  'assets/miners/'||f.family||'/level-'||lpad(l.level::text,2,'0')||'.svg'
from public.ng_miner_families f cross join generate_series(1,50) l(level)
on conflict (family,level) do nothing;

create table public.ng_operations (
  operation_type text primary key check (operation_type in ('resources','workers','transport')),
  display_name text not null
);
insert into public.ng_operations values ('resources','Resources'),('workers','Workers'),('transport','Transport') on conflict do nothing;

create table public.ng_operation_levels (
  id bigserial primary key,
  operation_type text not null references public.ng_operations(operation_type),
  level integer not null check (level between 1 and 50),
  tier text not null check (tier in ('Common','Uncommon','Rare','Epic','Legendary')),
  name text not null,
  price_credit numeric(30,6) not null check (price_credit >= 0),
  capacity numeric(30,8) not null check (capacity > 0),
  efficiency numeric(10,6) not null default 1 check (efficiency > 0 and efficiency <= 2),
  image_path text not null,
  unique(operation_type,level)
);

insert into public.ng_operation_levels(operation_type,level,tier,name,price_credit,capacity,efficiency,image_path)
select o.operation_type,l.level,
 case when l.level<=10 then 'Common' when l.level<=20 then 'Uncommon' when l.level<=30 then 'Rare' when l.level<=40 then 'Epic' else 'Legendary' end,
 o.display_name||' L'||l.level,
 round((100 + (l.level-1)*40)*power(1.05,l.level-1),6),
 case o.operation_type when 'resources' then round(1000*power(1.12,l.level-1),3) when 'workers' then round(1*power(1.09,l.level-1),3) else round(100*power(1.13,l.level-1),3) end,
 case when l.level<=10 then 0.80 + l.level*0.02 when l.level<=20 then 1.00 + (l.level-10)*0.015 when l.level<=30 then 1.15 + (l.level-20)*0.01 when l.level<=40 then 1.25 + (l.level-30)*0.0075 else 1.325 + (l.level-40)*0.004 end,
 'assets/operations/'||o.operation_type||'/'||lpad(l.level::text,2,'0')||'.svg'
from public.ng_operations o cross join generate_series(1,50) l(level)
on conflict(operation_type,level) do nothing;

create table public.ng_user_miners (
  id bigserial primary key,
  user_id uuid not null references public.ng_users(id) on delete cascade,
  family text not null references public.ng_miner_families(family),
  level integer not null check(level between 1 and 50),
  activated_at timestamptz not null default now(),
  status text not null default 'active' check(status in ('active','paused')),
  unique(user_id,family,level)
);

create table public.ng_user_operations (
  user_id uuid not null references public.ng_users(id) on delete cascade,
  operation_type text not null references public.ng_operations(operation_type),
  level integer not null default 0 check(level between 0 and 50),
  updated_at timestamptz not null default now(),
  primary key(user_id,operation_type)
);

create table public.ng_transactions (
  id bigserial primary key,
  user_id uuid references public.ng_users(id) on delete set null,
  tx_type text not null check (tx_type in ('welcome_bonus','deposit','withdrawal','miner_purchase','operation_upgrade','exchange_credit_to_crypto','exchange_crypto_to_credit','mining_reward','admin_adjustment','fee')),
  credit_delta numeric(30,6) not null default 0,
  usd_delta numeric(30,8) not null default 0,
  asset text,
  network text,
  crypto_amount numeric(40,18),
  reference_id bigint,
  note text,
  created_at timestamptz not null default now()
);

create table public.ng_deposit_destinations (
  id bigserial primary key,
  asset text not null,
  network text not null,
  provider text not null check(provider in ('Manual','FaucetPay')),
  destination text not null,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(asset,network)
);

create table public.ng_deposits (
  id bigserial primary key,
  user_id uuid not null references public.ng_users(id) on delete cascade,
  asset text not null,
  network text not null,
  amount numeric(40,18) not null check(amount>0),
  usd_amount numeric(30,8) not null check(usd_amount>0),
  credit_amount numeric(30,6) not null check(credit_amount>0),
  tx_hash text,
  destination_id bigint references public.ng_deposit_destinations(id),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.ng_users(id),
  created_at timestamptz not null default now()
);

create table public.ng_withdrawals (
  id bigserial primary key,
  user_id uuid not null references public.ng_users(id) on delete cascade,
  asset text not null,
  network text not null,
  credit_amount numeric(30,6) not null check(credit_amount>0),
  usd_amount numeric(30,8) not null check(usd_amount>0),
  crypto_amount numeric(40,18),
  destination text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.ng_users(id),
  created_at timestamptz not null default now()
);

create table public.ng_exchange_rates (
  asset text primary key,
  rate_usd numeric(30,12) not null check(rate_usd>0),
  source text not null default 'manual',
  updated_at timestamptz not null default now()
);
insert into public.ng_exchange_rates(asset,rate_usd) values
('BTC',60000),('LTC',80),('TRX',0.30),('DOGE',0.20),('ETH',3000),('USDT',1)
on conflict(asset) do nothing;


create table public.ng_crypto_balances (
  user_id uuid not null references public.ng_users(id) on delete cascade,
  asset text not null references public.ng_exchange_rates(asset),
  balance numeric(40,18) not null default 0 check(balance>=0),
  updated_at timestamptz not null default now(),
  primary key(user_id,asset)
);

create table public.ng_exchange_history (
  id bigserial primary key,
  user_id uuid not null references public.ng_users(id) on delete cascade,
  direction text not null check(direction in ('credit_to_crypto','crypto_to_credit')),
  asset text not null references public.ng_exchange_rates(asset),
  input_credit numeric(30,6),
  input_crypto numeric(40,18),
  rate_usd numeric(30,12) not null,
  fee_credit numeric(30,6) not null default 0,
  fee_usd numeric(30,8) not null default 0,
  output_credit numeric(30,6),
  output_crypto numeric(40,18),
  created_at timestamptz not null default now()
);

create table public.ng_public_activity (
  id bigserial primary key,
  activity_type text not null check(activity_type in ('deposit','payout')),
  public_name text not null,
  amount_usd numeric(30,8) not null check(amount_usd>0),
  asset text,
  created_at timestamptz not null default now()
);

create table public.ng_announcements (
  id bigserial primary key,
  user_id uuid references public.ng_users(id) on delete cascade,
  title text not null,
  message text not null,
  is_global boolean not null default false,
  created_by uuid references public.ng_users(id),
  created_at timestamptz not null default now()
);

create table public.ng_admins (
  user_id uuid primary key references public.ng_users(id) on delete cascade,
  role text not null check(role in ('owner','admin','support')),
  created_at timestamptz not null default now()
);

create table public.ng_security_events (
  id bigserial primary key,
  user_id uuid references public.ng_users(id) on delete cascade,
  event_type text not null,
  ip inet,
  user_agent text,
  device_signature text,
  risk_score integer check(risk_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ng_audit_logs (
  id bigserial primary key,
  actor_user_id uuid references public.ng_users(id) on delete set null,
  action text not null,
  target_user_id uuid references public.ng_users(id) on delete set null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.ng_is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.ng_admins a where a.user_id=auth.uid()); $$;

create or replace function public.ng_is_owner() returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.ng_admins a where a.user_id=auth.uid() and a.role='owner'); $$;

create or replace function public.ng_username_from_email(p_email text) returns text
language plpgsql immutable
as $$
begin
  return regexp_replace(split_part(coalesce(p_email,'miner'), '@', 1), '[^A-Za-z0-9_]', '', 'g') || floor(random()*900+100)::int::text;
end; $$;

create or replace function public.ng_handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_username text; v_bonus numeric; begin
  v_username := public.ng_username_from_email(new.email);
  while exists(select 1 from public.ng_users where username=v_username) loop
    v_username := public.ng_username_from_email(new.email);
  end loop;
  insert into public.ng_users(id,username) values(new.id,v_username);
  insert into public.ng_wallets(user_id) values(new.id);
  insert into public.ng_user_operations(user_id,operation_type,level) select new.id, operation_type, 0 from public.ng_operations;
  select signup_bonus_credit into v_bonus from public.ng_economy_settings where id=true;
  update public.ng_wallets set credit_balance=v_bonus,updated_at=now() where user_id=new.id;
  insert into public.ng_transactions(user_id,tx_type,credit_delta,note) values(new.id,'welcome_bonus',v_bonus,'New member welcome bonus');
  return new;
end; $$;

drop trigger if exists ng_on_auth_user_created on auth.users;
create trigger ng_on_auth_user_created after insert on auth.users for each row execute function public.ng_handle_new_user();

create or replace function public.ng_purchase_miner(p_family text,p_level integer) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); p public.ng_miner_levels%rowtype; w public.ng_wallets%rowtype; begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.ng_users where id=uid and status='active') then raise exception 'account_not_active'; end if;
  select * into p from public.ng_miner_levels where family=p_family and level=p_level;
  if not found then raise exception 'miner_not_found'; end if;
  if p_level>1 and not exists(select 1 from public.ng_user_miners where user_id=uid and family=p_family and level=p_level-1 and status='active') then raise exception 'previous_level_required'; end if;
  if exists(select 1 from public.ng_user_miners where user_id=uid and family=p_family and level=p_level and status='active') then raise exception 'already_owned'; end if;
  select * into w from public.ng_wallets where user_id=uid for update;
  if w.credit_balance-w.reserved_credit < p.price_credit then raise exception 'insufficient_credit'; end if;
  update public.ng_wallets set credit_balance=credit_balance-p.price_credit, updated_at=now() where user_id=uid;
  insert into public.ng_user_miners(user_id,family,level) values(uid,p_family,p_level);
  insert into public.ng_transactions(user_id,tx_type,credit_delta,reference_id,note) values(uid,'miner_purchase',-p.price_credit,currval('ng_user_miners_id_seq'),'Miner purchase');
  return jsonb_build_object('ok',true,'family',p_family,'level',p_level,'price_credit',p.price_credit);
end; $$;

create or replace function public.ng_upgrade_operation(p_operation_type text,p_level integer) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); p public.ng_operation_levels%rowtype; current_level integer; w public.ng_wallets%rowtype; cost numeric; begin
  select * into p from public.ng_operation_levels where operation_type=p_operation_type and level=p_level;
  if not found then raise exception 'upgrade_not_found'; end if;
  if not exists(select 1 from public.ng_operations where operation_type=p_operation_type) then raise exception 'invalid_operation'; end if;
  select level into current_level from public.ng_user_operations where user_id=uid and operation_type=p_operation_type;
  if p_level<>current_level+1 then raise exception 'sequential_upgrade_required'; end if;
  cost:=p.price_credit;
  select * into w from public.ng_wallets where user_id=uid for update;
  if w.credit_balance-w.reserved_credit < cost then raise exception 'insufficient_credit'; end if;
  update public.ng_wallets set credit_balance=credit_balance-cost, updated_at=now() where user_id=uid;
  update public.ng_user_operations set level=p_level, updated_at=now() where user_id=uid and operation_type=p_operation_type;
  insert into public.ng_transactions(user_id,tx_type,credit_delta,note) values(uid,'operation_upgrade',-cost,p_operation_type||' L'||p_level);
  return jsonb_build_object('ok',true,'operation',p_operation_type,'level',p_level,'price_credit',cost);
end; $$;

create or replace function public.ng_submit_deposit(p_asset text,p_network text,p_amount numeric,p_usd_amount numeric,p_tx_hash text,p_destination_id bigint) returns bigint
language plpgsql security definer set search_path = public
as $$
declare uid uuid:=auth.uid(); minv numeric; maxv numeric; rate numeric; credit numeric; id bigint; begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select min_deposit_usd,max_deposit_usd,topup_credit_per_usd into minv,maxv,rate from public.ng_economy_settings where id=true;
  if p_usd_amount<minv or p_usd_amount>maxv then raise exception 'deposit_amount_out_of_range'; end if;
  credit:=round(p_usd_amount*rate,6);
  insert into public.ng_deposits(user_id,asset,network,amount,usd_amount,credit_amount,tx_hash,destination_id) values(uid,p_asset,p_network,p_amount,p_usd_amount,credit,p_tx_hash,p_destination_id) returning id into id;
  return id;
end; $$;

create or replace function public.ng_request_withdrawal(p_asset text,p_network text,p_usd_amount numeric,p_destination text) returns bigint
language plpgsql security definer set search_path=public
as $$
declare uid uuid:=auth.uid(); minv numeric; maxv numeric; rate numeric; credit numeric; id bigint; begin
  select min_withdraw_usd,max_withdraw_usd,payout_credit_per_usd into minv,maxv,rate from public.ng_economy_settings where id=true;
  if p_usd_amount<minv or p_usd_amount>maxv then raise exception 'withdrawal_amount_out_of_range'; end if;
  credit:=round(p_usd_amount*rate,6);
  update public.ng_wallets set reserved_credit=reserved_credit+credit, updated_at=now() where user_id=uid and credit_balance-reserved_credit>=credit;
  if not found then raise exception 'insufficient_available_credit'; end if;
  insert into public.ng_withdrawals(user_id,asset,network,credit_amount,usd_amount,destination) values(uid,p_asset,p_network,credit,p_usd_amount,p_destination) returning id into id;
  return id;
end; $$;

create or replace function public.ng_admin_review_withdrawal(p_withdrawal_id bigint,p_approve boolean,p_note text default null) returns void
language plpgsql security definer set search_path=public
as $$
declare uid uuid:=auth.uid(); r public.ng_withdrawals%rowtype; begin
  if not public.ng_is_admin() then raise exception 'admin_required'; end if;
  select * into r from public.ng_withdrawals where id=p_withdrawal_id for update;
  if not found or r.status<>'pending' then raise exception 'invalid_withdrawal'; end if;
  if p_approve then
    update public.ng_wallets set credit_balance=credit_balance-r.credit_amount,reserved_credit=reserved_credit-r.credit_amount,updated_at=now() where user_id=r.user_id;
    update public.ng_withdrawals set status='approved',admin_note=p_note,reviewed_at=now(),reviewed_by=uid where id=p_withdrawal_id;
    insert into public.ng_public_activity(activity_type,public_name,amount_usd,asset) select 'payout',public.ng_public_alias(r.user_id),r.usd_amount,r.asset;
  else
    update public.ng_wallets set reserved_credit=reserved_credit-r.credit_amount,updated_at=now() where user_id=r.user_id;
    update public.ng_withdrawals set status='rejected',admin_note=p_note,reviewed_at=now(),reviewed_by=uid where id=p_withdrawal_id;
  end if;
end; $$;

create or replace function public.ng_public_alias(p_user_id uuid) returns text
language plpgsql stable security definer set search_path=public
as $$ declare u text; begin select username into u from public.ng_users where id=p_user_id; return regexp_replace(coalesce(u,'Miner'),'[^A-Za-z0-9]','','g'); end; $$;

create or replace function public.ng_admin_review_deposit(p_deposit_id bigint,p_approve boolean,p_note text default null) returns void
language plpgsql security definer set search_path=public
as $$
declare uid uuid:=auth.uid(); r public.ng_deposits%rowtype; begin
  if not public.ng_is_admin() then raise exception 'admin_required'; end if;
  select * into r from public.ng_deposits where id=p_deposit_id for update;
  if not found or r.status<>'pending' then raise exception 'invalid_deposit'; end if;
  if p_approve then
    update public.ng_wallets set credit_balance=credit_balance+r.credit_amount,updated_at=now() where user_id=r.user_id;
    update public.ng_deposits set status='approved',admin_note=p_note,reviewed_at=now(),reviewed_by=uid where id=p_deposit_id;
    insert into public.ng_transactions(user_id,tx_type,credit_delta,usd_delta,asset,crypto_amount,reference_id,note) values(r.user_id,'deposit',r.credit_amount,r.usd_amount,r.asset,r.amount,p_deposit_id,'Approved deposit');
    insert into public.ng_public_activity(activity_type,public_name,amount_usd,asset) values('deposit',public.ng_public_alias(r.user_id),r.usd_amount,r.asset);
  else
    update public.ng_deposits set status='rejected',admin_note=p_note,reviewed_at=now(),reviewed_by=uid where id=p_deposit_id;
  end if;
end; $$;

create or replace function public.ng_sync_earnings() returns numeric
language plpgsql security definer set search_path=public
as $$
declare uid uuid:=auth.uid(); now_ts timestamptz:=now(); last_ts timestamptz; hours numeric; base numeric; cap_r numeric; cap_w numeric; cap_t numeric; eff numeric; reward numeric:=0; begin
  select coalesce(last_seen_at,created_at) into last_ts from public.ng_users where id=uid;
  hours:=greatest(0,extract(epoch from(now_ts-last_ts))/3600); if hours>24 then hours:=24; end if;
  select coalesce(sum(l.income_hour_credit),0) into base from public.ng_user_miners um join public.ng_miner_levels l on l.family=um.family and l.level=um.level where um.user_id=uid and um.status='active';
  select coalesce(max(case when operation_type='resources' then ol.capacity end),0),coalesce(max(case when operation_type='workers' then ol.capacity end),0),coalesce(max(case when operation_type='transport' then ol.capacity end),0) into cap_r,cap_w,cap_t from public.ng_user_operations uo left join public.ng_operation_levels ol on ol.operation_type=uo.operation_type and ol.level=uo.level where uo.user_id=uid;
  eff:=case when base<=0 then 0 else least(1,cap_r/nullif(base*24,0),cap_w/10.0,cap_t/nullif(base*24,0)) end;
  reward:=round(base*hours*greatest(eff,0),6);
  if reward>0 then update public.ng_wallets set credit_balance=credit_balance+reward,updated_at=now() where user_id=uid; insert into public.ng_transactions(user_id,tx_type,credit_delta,note) values(uid,'mining_reward',reward,'Mining earnings'); end if;
  update public.ng_users set last_seen_at=now_ts where id=uid;
  return reward;
end; $$;


create or replace function public.ng_exchange_credit_to_crypto(p_asset text,p_credit_amount numeric) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare uid uuid:=auth.uid(); r numeric; fee_bps integer; fee numeric; crypto numeric; begin
  if uid is null or p_credit_amount<=0 then raise exception 'invalid_request'; end if;
  select rate_usd into r from public.ng_exchange_rates where asset=p_asset;
  if not found then raise exception 'asset_not_supported'; end if;
  select exchange_fee_bps into fee_bps from public.ng_economy_settings where id=true;
  fee:=round(p_credit_amount*fee_bps/10000.0,6);
  crypto:=round(((p_credit_amount-fee)/5000.0)/r,18);
  update public.ng_wallets set credit_balance=credit_balance-p_credit_amount,updated_at=now() where user_id=uid and credit_balance-reserved_credit>=p_credit_amount;
  if not found then raise exception 'insufficient_available_credit'; end if;
  insert into public.ng_crypto_balances(user_id,asset,balance) values(uid,p_asset,crypto) on conflict(user_id,asset) do update set balance=public.ng_crypto_balances.balance+excluded.balance,updated_at=now();
  insert into public.ng_exchange_history(user_id,direction,asset,input_credit,rate_usd,fee_credit,output_crypto) values(uid,'credit_to_crypto',p_asset,p_credit_amount,r,fee,crypto);
  insert into public.ng_transactions(user_id,tx_type,credit_delta,asset,crypto_amount,note) values(uid,'exchange_credit_to_crypto',-p_credit_amount,p_asset,crypto,'Credit to crypto exchange');
  return jsonb_build_object('ok',true,'asset',p_asset,'input_credit',p_credit_amount,'fee_credit',fee,'output_crypto',crypto,'rate_usd',r);
end; $$;

create or replace function public.ng_exchange_crypto_to_credit(p_asset text,p_crypto_amount numeric) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare uid uuid:=auth.uid(); r numeric; fee_bps integer; gross numeric; fee_usd numeric; net_credit numeric; begin
  if uid is null or p_crypto_amount<=0 then raise exception 'invalid_request'; end if;
  select rate_usd into r from public.ng_exchange_rates where asset=p_asset;
  if not found then raise exception 'asset_not_supported'; end if;
  select exchange_fee_bps into fee_bps from public.ng_economy_settings where id=true;
  gross:=p_crypto_amount*r;
  fee_usd:=gross*fee_bps/10000.0;
  net_credit:=round((gross-fee_usd)*1000.0,6);
  update public.ng_crypto_balances set balance=balance-p_crypto_amount,updated_at=now() where user_id=uid and asset=p_asset and balance>=p_crypto_amount;
  if not found then raise exception 'insufficient_crypto_balance'; end if;
  update public.ng_wallets set credit_balance=credit_balance+net_credit, updated_at=now() where user_id=uid;
  insert into public.ng_exchange_history(user_id,direction,asset,input_crypto,rate_usd,fee_usd,output_credit) values(uid,'crypto_to_credit',p_asset,p_crypto_amount,r,fee_usd,net_credit);
  insert into public.ng_transactions(user_id,tx_type,credit_delta,asset,crypto_amount,note) values(uid,'exchange_crypto_to_credit',net_credit,p_asset,-p_crypto_amount,'Crypto to credit exchange');
  return jsonb_build_object('ok',true,'asset',p_asset,'input_crypto',p_crypto_amount,'gross_usd',gross,'fee_usd',fee_usd,'output_credit',net_credit,'rate_usd',r);
end; $$;
revoke all on function public.ng_exchange_credit_to_crypto(text,numeric) from public;
grant execute on function public.ng_exchange_credit_to_crypto(text,numeric) to authenticated;
revoke all on function public.ng_exchange_crypto_to_credit(text,numeric) from public;
grant execute on function public.ng_exchange_crypto_to_credit(text,numeric) to authenticated;

-- RLS
alter table public.ng_users enable row level security;
alter table public.ng_wallets enable row level security;
alter table public.ng_crypto_balances enable row level security;
alter table public.ng_economy_settings enable row level security;
alter table public.ng_miner_families enable row level security;
alter table public.ng_miner_levels enable row level security;
alter table public.ng_operations enable row level security;
alter table public.ng_operation_levels enable row level security;
alter table public.ng_user_miners enable row level security;
alter table public.ng_user_operations enable row level security;
alter table public.ng_transactions enable row level security;
alter table public.ng_deposit_destinations enable row level security;
alter table public.ng_deposits enable row level security;
alter table public.ng_withdrawals enable row level security;
alter table public.ng_exchange_rates enable row level security;
alter table public.ng_exchange_history enable row level security;
alter table public.ng_public_activity enable row level security;
alter table public.ng_announcements enable row level security;
alter table public.ng_admins enable row level security;
alter table public.ng_security_events enable row level security;
alter table public.ng_audit_logs enable row level security;

create policy ng_users_self on public.ng_users for select using (id=auth.uid() or public.ng_is_admin());
create policy ng_wallet_self on public.ng_wallets for select using (user_id=auth.uid());
create policy ng_crypto_self on public.ng_crypto_balances for select using (user_id=auth.uid());
create policy ng_public_settings on public.ng_economy_settings for select using (auth.role() in ('authenticated','anon'));
create policy ng_public_family on public.ng_miner_families for select using (true);
create policy ng_public_miner_levels on public.ng_miner_levels for select using (true);
create policy ng_public_operations on public.ng_operations for select using (true);
create policy ng_public_operation_levels on public.ng_operation_levels for select using (true);
create policy ng_user_miners_self on public.ng_user_miners for select using (user_id=auth.uid() or public.ng_is_admin());
create policy ng_user_operations_self on public.ng_user_operations for select using (user_id=auth.uid() or public.ng_is_admin());
create policy ng_tx_self on public.ng_transactions for select using (user_id=auth.uid() or public.ng_is_admin());
create policy ng_dest_active_read on public.ng_deposit_destinations for select using (is_active=true or public.ng_is_admin());
create policy ng_deposits_self on public.ng_deposits for select using (user_id=auth.uid() or public.ng_is_admin());
create policy ng_withdrawals_self on public.ng_withdrawals for select using (user_id=auth.uid() or public.ng_is_admin());
create policy ng_rates_public on public.ng_exchange_rates for select using (true);
create policy ng_exchange_self on public.ng_exchange_history for select using (user_id=auth.uid() or public.ng_is_admin());
create policy ng_public_activity_read on public.ng_public_activity for select using (true);
create policy ng_announcements_read on public.ng_announcements for select using (is_global=true or user_id=auth.uid() or public.ng_is_admin());
create policy ng_admins_self on public.ng_admins for select using (user_id=auth.uid() or public.ng_is_owner());
create policy ng_security_self on public.ng_security_events for select using (user_id=auth.uid() or public.ng_is_admin());
create policy ng_audit_admin on public.ng_audit_logs for select using (public.ng_is_admin());

-- RPC execute permissions
revoke all on function public.ng_purchase_miner(text,integer) from public;
grant execute on function public.ng_purchase_miner(text,integer) to authenticated;
revoke all on function public.ng_upgrade_operation(text,integer) from public;
grant execute on function public.ng_upgrade_operation(text,integer) to authenticated;
revoke all on function public.ng_submit_deposit(text,text,numeric,numeric,text,bigint) from public;
grant execute on function public.ng_submit_deposit(text,text,numeric,numeric,text,bigint) to authenticated;
revoke all on function public.ng_request_withdrawal(text,text,numeric,text) from public;
grant execute on function public.ng_request_withdrawal(text,text,numeric,text) to authenticated;
revoke all on function public.ng_sync_earnings() from public;
grant execute on function public.ng_sync_earnings() to authenticated;
revoke all on function public.ng_admin_review_deposit(bigint,boolean,text) from public;
grant execute on function public.ng_admin_review_deposit(bigint,boolean,text) to authenticated;
revoke all on function public.ng_admin_review_withdrawal(bigint,boolean,text) from public;
grant execute on function public.ng_admin_review_withdrawal(bigint,boolean,text) to authenticated;

create index if not exists ng_deposits_user_status_idx on public.ng_deposits(user_id,status,created_at desc);
create index if not exists ng_withdrawals_user_status_idx on public.ng_withdrawals(user_id,status,created_at desc);
create index if not exists ng_security_user_created_idx on public.ng_security_events(user_id,created_at desc);
create index if not exists ng_activity_created_idx on public.ng_public_activity(created_at desc);

-- realtime public activity only
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ng_public_activity; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

