-- CP20.2-C.1 non-financial integrity hardening.
create unique index if not exists uq_nextgen_memberships_one_active_user
on public.nextgen_memberships(user_id)
where status='active';

create or replace function public.nextgen_purchase_membership(p_plan_slug text, p_asset text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid(); plan public.nextgen_membership_plans%rowtype; bal public.nextgen_crypto_balances%rowtype;
  rate numeric; rate_updated timestamptz; amount numeric; mid bigint; ref text; existing public.nextgen_memberships%rowtype; expires timestamptz;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 20401));
  select * into plan from public.nextgen_membership_plans where slug=lower(trim(p_plan_slug)) and enabled=true for update;
  if not found then raise exception 'MEMBERSHIP_PLAN_NOT_FOUND'; end if;
  update public.nextgen_memberships set status='expired', updated_at=now() where user_id=uid and status='active' and expires_at<=now();
  select * into existing from public.nextgen_memberships where user_id=uid and status='active' and expires_at>now() order by expires_at desc limit 1;
  if found then raise exception 'MEMBERSHIP_ALREADY_ACTIVE'; end if;
  select rate_usd,updated_at into rate,rate_updated from public.nextgen_exchange_rates where upper(asset)=upper(trim(p_asset)) order by updated_at desc limit 1;
  if rate is null or rate<=0 then raise exception 'ASSET_RATE_MISSING'; end if;
  if rate_updated < now()-interval '15 minutes' then raise exception 'ASSET_RATE_STALE'; end if;
  amount:=round(plan.price_usd/rate,18);
  if amount<=0 then raise exception 'INVALID_MEMBERSHIP_AMOUNT'; end if;
  select * into bal from public.nextgen_crypto_balances where user_id=uid and asset=upper(trim(p_asset)) for update;
  if not found or (bal.balance-bal.reserved_balance)<amount then raise exception 'INSUFFICIENT_CRYPTO'; end if;
  update public.nextgen_crypto_balances set balance=balance-amount,updated_at=now() where user_id=uid and asset=upper(trim(p_asset));
  select * into existing from public.nextgen_memberships where user_id=uid and status='active' and expires_at>now() order by expires_at desc limit 1;
  if found then raise exception 'MEMBERSHIP_ALREADY_ACTIVE'; end if;
  expires:=now()+make_interval(days=>plan.duration_days);
  ref:='membership:'||gen_random_uuid()::text;
  insert into public.nextgen_memberships(user_id,plan_id,status,starts_at,expires_at,price_usd,asset,crypto_amount,reference_id) values(uid,plan.id,'active',now(),expires,plan.price_usd,upper(trim(p_asset)),amount,ref) returning id into mid;
  insert into public.nextgen_crypto_ledger(user_id,asset,direction,amount,usd_value,reference_type,reference_id,note) values(uid,upper(trim(p_asset)),'exchange_out',amount,plan.price_usd,'membership_purchase',ref,'Premium membership purchase');
  insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,usd_delta,asset,crypto_amount,reference_id,note) values(uid,'membership_purchase',0,-plan.price_usd,upper(trim(p_asset)),amount,ref,plan.name||' membership');
  return jsonb_build_object('success',true,'membership_id',mid,'plan',plan.slug,'name',plan.name,'price_usd',plan.price_usd,'asset',upper(trim(p_asset)),'crypto_amount',amount,'expires_at',expires);
end;
$function$;

create or replace function public.nextgen_claim_daily_checkin()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
 uid uuid:=auth.uid(); d date:=timezone('utc',now())::date; p public.nextgen_membership_plans%rowtype; m public.nextgen_memberships%rowtype;
 is_premium boolean:=false; base_bonus numeric:=100; premium_bonus numeric:=0; total_bonus numeric; recharged boolean:=false; next_expiry timestamptz;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text, 20402));
 update public.nextgen_memberships set status='expired',updated_at=now() where user_id=uid and status='active' and expires_at<=now();
 select m.* into m from public.nextgen_memberships m where m.user_id=uid and m.status='active' and m.expires_at>now() order by m.expires_at desc limit 1;
 is_premium:=found;
 if is_premium then select * into p from public.nextgen_membership_plans where id=m.plan_id; premium_bonus:=coalesce(p.daily_bonus_diamond,0); end if;
 total_bonus:=base_bonus+premium_bonus;
 begin insert into public.nextgen_daily_checkins(user_id,checkin_date,diamond_awarded,hashrate_recharged) values(uid,d,total_bonus,false);
 exception when unique_violation then raise exception 'DAILY_CHECKIN_ALREADY_CLAIMED'; end;
 insert into public.nextgen_wallets(user_id,diamond_balance) values(uid,total_bonus) on conflict(user_id) do update set diamond_balance=public.nextgen_wallets.diamond_balance+excluded.diamond_balance,updated_at=now();
 insert into public.nextgen_transactions(user_id,tx_type,diamond_delta,reference_id,note) values(uid,'daily_checkin',total_bonus,d::text,case when is_premium then 'Daily check-in premium bonus' else 'Daily check-in' end);
 if is_premium then update public.nextgen_user_miners set status='active',last_recharge_at=now(),recharge_expires_at=m.expires_at where user_id=uid and status in ('active','paused'); recharged:=true;
 else update public.nextgen_user_miners set status='active',last_recharge_at=now(),recharge_expires_at=now()+interval '24 hours' where user_id=uid and status in ('active','paused'); recharged:=true; end if;
 select max(recharge_expires_at) into next_expiry from public.nextgen_user_miners where user_id=uid and status='active';
 update public.nextgen_daily_checkins set hashrate_recharged=recharged where user_id=uid and checkin_date=d;
 return jsonb_build_object('success',true,'date',d,'diamond_awarded',total_bonus,'premium',is_premium,'hashrate_recharged',recharged,'recharge_expires_at',next_expiry);
end;
$function$;

create or replace function public.nextgen_create_support_ticket(p_subject text,p_message text,p_priority text default 'normal')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare uid uuid:=auth.uid(); tid bigint; pr text:=lower(trim(coalesce(p_priority,'normal'))); subject_trim text:=trim(coalesce(p_subject,'')); message_trim text:=trim(coalesce(p_message,''));
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if pr not in ('low','normal','high') then raise exception 'INVALID_PRIORITY'; end if;
 if length(subject_trim)<5 or length(subject_trim)>120 then raise exception 'SUBJECT_INVALID'; end if;
 if length(message_trim)<10 or length(message_trim)>4000 then raise exception 'MESSAGE_INVALID'; end if;
 insert into public.nextgen_support_tickets(user_id,subject,message,priority) values(uid,subject_trim,message_trim,pr) returning id into tid;
 return jsonb_build_object('success',true,'ticket_id',tid,'status','open');
end;
$function$;

revoke all on function public.nextgen_purchase_membership(text,text) from public;
revoke all on function public.nextgen_purchase_membership(text,text) from anon;
grant execute on function public.nextgen_purchase_membership(text,text) to authenticated;
grant execute on function public.nextgen_purchase_membership(text,text) to postgres;
revoke all on function public.nextgen_claim_daily_checkin() from public;
revoke all on function public.nextgen_claim_daily_checkin() from anon;
grant execute on function public.nextgen_claim_daily_checkin() to authenticated;
grant execute on function public.nextgen_claim_daily_checkin() to postgres;
revoke all on function public.nextgen_create_support_ticket(text,text,text) from public;
revoke all on function public.nextgen_create_support_ticket(text,text,text) from anon;
grant execute on function public.nextgen_create_support_ticket(text,text,text) to authenticated;
grant execute on function public.nextgen_create_support_ticket(text,text,text) to postgres;
