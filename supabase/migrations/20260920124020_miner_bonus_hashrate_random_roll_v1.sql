-- NEXTGEN MINER
-- Per-miner random hashrate bonus for Shop purchases and level merges.
-- Distribution of the rolled bonus:
--   0.1–1.0%  = 25%
--   1.1–2.0%  = 20%
--   2.1–3.0%  = 20%
--   3.1–4.0%  = 20%
--   4.1–4.9%  = 10%
--   5.0%      =  5%

alter table public.nextgen_user_miners
  add column if not exists bonus_hashrate_percent numeric(4,1) not null default 0;

alter table public.nextgen_user_miners
  drop constraint if exists nextgen_user_miners_bonus_hashrate_percent_check;

alter table public.nextgen_user_miners
  add constraint nextgen_user_miners_bonus_hashrate_percent_check
  check (bonus_hashrate_percent >= 0 and bonus_hashrate_percent <= 5);

create or replace function public.nextgen_roll_miner_bonus()
returns numeric
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  r numeric := random();
  value numeric;
begin
  if r < 0.25 then
    value := 0.1 + floor(random() * 10) * 0.1;
  elsif r < 0.45 then
    value := 1.1 + floor(random() * 10) * 0.1;
  elsif r < 0.65 then
    value := 2.1 + floor(random() * 10) * 0.1;
  elsif r < 0.85 then
    value := 3.1 + floor(random() * 10) * 0.1;
  elsif r < 0.95 then
    value := 4.1 + floor(random() * 9) * 0.1;
  else
    value := 5.0;
  end if;
  return round(least(greatest(value, 0.1), 5.0), 1);
end;
$function$;

revoke all on function public.nextgen_roll_miner_bonus() from public;
grant execute on function public.nextgen_roll_miner_bonus() to authenticated;

-- Patch existing server-side purchase/merge/snapshot functions in place so
-- the bonus is generated server-side and used consistently by mining math.
do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
  fname text;
begin
  -- Purchase: roll once and persist the exact roll.
  select pg_get_functiondef(p.oid) into v_sql
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='nextgen_purchase_miner'
    and pg_get_function_identity_arguments(p.oid)='p_miner_id bigint'
  limit 1;

  if v_sql is null then raise exception 'NEXTGEN_PURCHASE_FUNCTION_NOT_FOUND'; end if;

  v_old := $s$projected_weight numeric := 0;
  membership_factor numeric := 1.0;$s$;
  v_new := $s$projected_weight numeric := 0;
  membership_factor numeric := 1.0;
  bonus_hashrate_percent numeric := 0;$s$;
  if position(v_old in v_sql)=0 then raise exception 'PURCHASE_PATCH_1_NOT_FOUND'; end if;
  v_sql := replace(v_sql,v_old,v_new);

  v_old := $s$membership_factor := coalesce(membership_factor,1.0);

  projected_weight:=greatest(coalesce(m.base_hashrate,0),0)*greatest(membership_factor,0);$s$;
  v_new := $s$membership_factor := coalesce(membership_factor,1.0);
  bonus_hashrate_percent := public.nextgen_roll_miner_bonus();

  projected_weight:=greatest(coalesce(m.base_hashrate,0),0)
    * (1 + bonus_hashrate_percent/100.0)
    * greatest(membership_factor,0);$s$;
  if position(v_old in v_sql)=0 then raise exception 'PURCHASE_PATCH_2_NOT_FOUND'; end if;
  v_sql := replace(v_sql,v_old,v_new);

  v_old := $s$user_id,miner_id,current_level,total_spent_diamond,status,is_merged,
    deployment_state,last_recharge_at,recharge_expires_at,last_accrual_at$s$;
  v_new := $s$user_id,miner_id,current_level,total_spent_diamond,status,is_merged,
    bonus_hashrate_percent,deployment_state,last_recharge_at,recharge_expires_at,last_accrual_at$s$;
  if position(v_old in v_sql)=0 then raise exception 'PURCHASE_PATCH_3_NOT_FOUND'; end if;
  v_sql := replace(v_sql,v_old,v_new);

  v_old := $s$uid,p_miner_id,1,m.base_price_diamond,'paused',false,
    'inventory',now(),now(),now()$s$;
  v_new := $s$uid,p_miner_id,1,m.base_price_diamond,'paused',false,
    bonus_hashrate_percent,'inventory',now(),now(),now()$s$;
  if position(v_old in v_sql)=0 then raise exception 'PURCHASE_PATCH_4_NOT_FOUND'; end if;
  v_sql := replace(v_sql,v_old,v_new);

  v_old := $s$'hashrate',m.base_hashrate,'price_diamond',m.base_price_diamond$s$;
  v_new := $s$'hashrate',m.base_hashrate * (1 + bonus_hashrate_percent/100.0),
    'base_hashrate',m.base_hashrate,
    'bonus_hashrate_percent',bonus_hashrate_percent,
    'price_diamond',m.base_price_diamond$s$;
  if position(v_old in v_sql)=0 then raise exception 'PURCHASE_PATCH_5_NOT_FOUND'; end if;
  v_sql := replace(v_sql,v_old,v_new);

  execute v_sql;

  -- Merge: every merge gets a new independent bonus roll.
  select pg_get_functiondef(p.oid) into v_sql
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='nextgen_merge_miners'
    and pg_get_function_identity_arguments(p.oid)='p_first_user_miner_id bigint, p_second_user_miner_id bigint'
  limit 1;

  if v_sql is null then raise exception 'NEXTGEN_MERGE_FUNCTION_NOT_FOUND'; end if;

  v_old := $s$new_weight numeric:=0; additional_weight numeric:=0;$s$;
  v_new := $s$new_weight numeric:=0; additional_weight numeric:=0; new_bonus_hashrate numeric:=0;$s$;
  if position(v_old in v_sql)=0 then raise exception 'MERGE_PATCH_1_NOT_FOUND'; end if;
  v_sql := replace(v_sql,v_old,v_new);

  v_old := $s$if coalesce(w.diamond_balance,0)<fee.fee_diamond then raise exception 'INSUFFICIENT_DIAMOND'; end if;
 select coalesce(p.mining_factor,1.0)$s$;
  v_new := $s$if coalesce(w.diamond_balance,0)<fee.fee_diamond then raise exception 'INSUFFICIENT_DIAMOND'; end if;
 new_bonus_hashrate:=public.nextgen_roll_miner_bonus();
 select coalesce(p.mining_factor,1.0)$s$;
  if position(v_old in v_sql)=0 then raise exception 'MERGE_PATCH_2_NOT_FOUND'; end if;
  v_sql := replace(v_sql,v_old,v_new);

  v_old := $s$old_weight:=lvl_current.hashrate*greatest(lvl_current.efficiency,0)*least(greatest(coalesce(a.energy_percent,0),0),100)/100.0*membership_factor + lvl_current.hashrate*greatest(lvl_current.efficiency,0)*least(greatest(coalesce(b.energy_percent,0),0),100)/100.0*membership_factor;$s$;
  v_new := $s$old_weight:=lvl_current.hashrate*(1+coalesce(a.bonus_hashrate_percent,0)/100.0)*greatest(lvl_current.efficiency,0)*least(greatest(coalesce(a.energy_percent,0),0),100)/100.0*membership_factor + lvl_current.hashrate*(1+coalesce(b.bonus_hashrate_percent,0)/100.0)*greatest(lvl_current.efficiency,0)*least(greatest(coalesce(b.energy_percent,0),0),100)/100.0*membership_factor;$s$;
  if position(v_old in v_sql)=0 then raise exception 'MERGE_PATCH_3_NOT_FOUND'; end if;
  v_sql := replace(v_sql,v_old,v_new);

  v_old := $s$new_weight:=lvl_next.hashrate*greatest(lvl_next.efficiency,0)*least(greatest(new_energy,0),100)/100.0*membership_factor;$s$;
  v_new := $s$new_weight:=lvl_next.hashrate*(1+new_bonus_hashrate/100.0)*greatest(lvl_next.efficiency,0)*least(greatest(new_energy,0),100)/100.0*membership_factor;$s$;
  if position(v_old in v_sql)=0 then raise exception 'MERGE_PATCH_4_NOT_FOUND'; end if;
  v_sql := replace(v_sql,v_old,v_new);

  v_old := $s$update public.nextgen_user_miners set current_level=lvl_next.level,total_spent_diamond=$s$;
  v_new := $s$update public.nextgen_user_miners set current_level=lvl_next.level,bonus_hashrate_percent=new_bonus_hashrate,total_spent_diamond=$s$;
  if position(v_old in v_sql)=0 then raise exception 'MERGE_PATCH_5_NOT_FOUND'; end if;
  v_sql := replace(v_sql,v_old,v_new);

  v_old := $s$'hashrate',lvl_next.hashrate,'efficiency',lvl_next.efficiency,'merge_fee_diamond',fee.fee_diamond,$s$;
  v_new := $s$'hashrate',lvl_next.hashrate*(1+new_bonus_hashrate/100.0),'base_hashrate',lvl_next.hashrate,'bonus_hashrate_percent',new_bonus_hashrate,'efficiency',lvl_next.efficiency,'merge_fee_diamond',fee.fee_diamond,$s$;
  if position(v_old in v_sql)=0 then raise exception 'MERGE_PATCH_6_NOT_FOUND'; end if;
  v_sql := replace(v_sql,v_old,v_new);

  execute v_sql;

  -- Mining day / live snapshots use effective hashrate.
  for fname in select unnest(array['nextgen_prepare_mining_day','nextgen_live_mining_snapshot'])
  loop
    select pg_get_functiondef(p.oid) into v_sql
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=fname
    order by p.oid desc limit 1;
    if v_sql is null then continue; end if;

    if fname='nextgen_prepare_mining_day' then
      v_old := $s$m.base_price_diamond,l.hashrate,l.efficiency,least(greatest(coalesce(um.energy_percent,0),0),100) energy_percent$s$;
      v_new := $s$m.base_price_diamond,(l.hashrate*(1+coalesce(um.bonus_hashrate_percent,0)/100.0)) as hashrate,l.efficiency,least(greatest(coalesce(um.energy_percent,0),0),100) energy_percent$s$;
    else
      v_old := $s$l.hashrate,l.efficiency,
           least(greatest(coalesce(um.energy_percent,0),0),100) energy_percent$s$;
      v_new := $s$(l.hashrate*(1+coalesce(um.bonus_hashrate_percent,0)/100.0)) as hashrate,l.efficiency,
           least(greatest(coalesce(um.energy_percent,0),0),100) energy_percent$s$;
    end if;

    if position(v_old in v_sql)=0 then raise exception '%_PATCH_1_NOT_FOUND',upper(fname); end if;
    v_sql := replace(v_sql,v_old,v_new);

    if fname='nextgen_live_mining_snapshot' then
      v_old := $s$l.hashrate*greatest(l.efficiency,0)$s$;
      v_new := $s$l.hashrate*(1+coalesce(um.bonus_hashrate_percent,0)/100.0)*greatest(l.efficiency,0)$s$;
      v_sql := replace(v_sql,v_old,v_new);
    end if;

    execute v_sql;
  end loop;

  -- Rooms snapshot uses effective hashrate.
  select pg_get_functiondef(p.oid) into v_sql
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='nextgen_rooms_snapshot'
  order by p.oid desc limit 1;

  if v_sql is not null then
    v_old := $s$coalesce((select sum(l.hashrate)$s$;
    v_new := $s$coalesce((select sum(l.hashrate*(1+coalesce(um.bonus_hashrate_percent,0)/100.0))$s$;
    if position(v_old in v_sql)=0 then raise exception 'ROOMS_PATCH_1_NOT_FOUND'; end if;
    v_sql := replace(v_sql,v_old,v_new);

    v_old := $s$'hashrate',coalesce(l.hashrate,0),$s$;
    v_new := $s$'hashrate',coalesce(l.hashrate,0)*(1+coalesce(um.bonus_hashrate_percent,0)/100.0),$s$;
    if position(v_old in v_sql)=0 then raise exception 'ROOMS_PATCH_2_NOT_FOUND'; end if;
    v_sql := replace(v_sql,v_old,v_new);

    execute v_sql;
  end if;
end
$patch$;
