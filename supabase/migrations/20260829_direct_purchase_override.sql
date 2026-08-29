-- NextGen Miner — FINAL direct-purchase override
-- Final rule: users may buy ANY active miner level directly when
-- available Credit is sufficient. No previous-level requirement.
-- Canonical hashrate unit: GH/s.

begin;

create or replace function public.ng_purchase_miner(p_family text, p_level integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.ng_miner_levels%rowtype;
  w public.ng_wallets%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.ng_users
    where id = uid
      and status = 'active'
  ) then
    raise exception 'account_not_active';
  end if;

  if p_family is null or p_level is null or p_level < 1 or p_level > 50 then
    raise exception 'invalid_miner_level';
  end if;

  select *
  into p
  from public.ng_miner_levels
  where family = p_family
    and level = p_level;

  if not found then
    raise exception 'miner_not_found';
  end if;

  if exists (
    select 1
    from public.ng_user_miners
    where user_id = uid
      and family = p_family
      and level = p_level
      and status = 'active'
  ) then
    raise exception 'already_owned';
  end if;

  -- Direct purchase: NO previous-level requirement.
  -- The user's available Credit is checked atomically under a wallet row lock.
  select *
  into w
  from public.ng_wallets
  where user_id = uid
  for update;

  if not found then
    raise exception 'wallet_not_found';
  end if;

  if coalesce(w.credit_balance, 0) - coalesce(w.reserved_credit, 0)
     < p.price_credit then
    raise exception 'insufficient_credit';
  end if;

  update public.ng_wallets
  set credit_balance = credit_balance - p.price_credit,
      updated_at = now()
  where user_id = uid;

  insert into public.ng_user_miners(user_id, family, level, status)
  values (uid, p_family, p_level, 'active');

  insert into public.ng_transactions(
    user_id,
    tx_type,
    credit_delta,
    note
  )
  values (
    uid,
    'miner_purchase',
    -p.price_credit,
    initcap(p_family) || ' Miner L' || p_level || ' direct purchase'
  );

  return jsonb_build_object(
    'ok', true,
    'family', p_family,
    'level', p_level,
    'price_credit', p.price_credit,
    'hash_power_gh', p.hashrate,
    'hashrate_unit', 'GH/s',
    'direct_purchase', true
  );
end;
$$;

revoke all on function public.ng_purchase_miner(text, integer) from public;
grant execute on function public.ng_purchase_miner(text, integer) to authenticated;

commit;

-- End of direct-purchase override.
