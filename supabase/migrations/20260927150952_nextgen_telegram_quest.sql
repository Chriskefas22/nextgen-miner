create table if not exists public.nextgen_telegram_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  telegram_user_id bigint not null unique,
  username text,
  display_name text,
  photo_url text,
  joined_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nextgen_telegram_reactions (
  telegram_user_id bigint not null,
  chat_username text not null,
  message_id bigint not null,
  liked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (telegram_user_id, chat_username, message_id)
);

alter table public.nextgen_telegram_links enable row level security;
alter table public.nextgen_telegram_reactions enable row level security;

revoke all on table public.nextgen_telegram_links from anon, authenticated;
revoke all on table public.nextgen_telegram_reactions from anon, authenticated;

insert into public.nextgen_quests (
  quest_key, title, description, target_count, reward_diamond, period, enabled
)
values (
  'telegram_join_like',
  'Telegram Community',
  'Join @nextgenminerapp, connect your Telegram, then react 👍 to the featured channel post.',
  1,
  250,
  'once',
  true
)
on conflict (quest_key) do update
set title = excluded.title,
    description = excluded.description,
    target_count = excluded.target_count,
    reward_diamond = excluded.reward_diamond,
    period = excluded.period,
    enabled = excluded.enabled;

create or replace function public.nextgen_quests_snapshot()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  period_start timestamptz := date_trunc('day', now());
  period_end timestamptz := period_start + interval '1 day';
  v_daily_period_key text := to_char(period_start, 'YYYY-MM-DD');
  result jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  with quest_progress as (
    select
      q.id,
      q.quest_key,
      q.title,
      q.description,
      q.target_count,
      q.reward_diamond,
      q.period,
      coalesce(uq.progress, 0) as stored_progress,
      uq.claimed_at,
      case q.quest_key
        when 'faucet_20' then (
          select count(*)::numeric
          from public.nextgen_faucet_claims fc
          where fc.user_id = uid
            and fc.claimed_at >= period_start
            and fc.claimed_at < period_end
        )
        when 'offer_5' then (
          select count(*)::numeric
          from public.nextgen_offer_completions oc
          where oc.user_id = uid
            and lower(oc.status) = 'posted'
            and oc.created_at >= period_start
            and oc.created_at < period_end
        )
        when 'ptc_100' then (
          select count(*)::numeric
          from public.nextgen_ptc_sessions ps
          where ps.user_id = uid
            and lower(ps.status) = 'completed'
            and coalesce(ps.completed_at, ps.started_at) >= period_start
            and coalesce(ps.completed_at, ps.started_at) < period_end
        )
        when 'shortlink_10' then (
          select count(*)::numeric
          from public.nextgen_shortlink_completions sc
          where sc.user_id = uid
            and lower(sc.status) = 'posted'
            and sc.created_at >= period_start
            and sc.created_at < period_end
        )
        when 'telegram_join_like' then (
          select case
            when exists (
              select 1
              from public.nextgen_telegram_links tl
              where tl.user_id = uid
                and tl.verified_at is not null
            ) then 1::numeric
            else 0::numeric
          end
        )
        else coalesce(uq.progress, 0)
      end as measured_progress,
      case
        when q.period = 'once' then 'lifetime'
        else v_daily_period_key
      end as snapshot_period_key
    from public.nextgen_quests q
    left join public.nextgen_user_quests uq
      on uq.user_id = uid
     and uq.quest_id = q.id
     and uq.period_key = case
       when q.period = 'once' then 'lifetime'
       else v_daily_period_key
     end
    where q.enabled = true
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'quest_key', quest_key,
        'title', title,
        'description', description,
        'target_count', target_count,
        'reward_diamond', reward_diamond,
        'period', period,
        'progress', least(measured_progress, target_count),
        'claimed_at', claimed_at,
        'period_key', snapshot_period_key
      )
      order by id
    ),
    '[]'::jsonb
  )
  into result
  from quest_progress;

  return jsonb_build_object(
    'period_key', v_daily_period_key,
    'quests', result
  );
end;
$function$;

create or replace function public.nextgen_claim_quest(p_quest_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  q public.nextgen_quests%rowtype;
  existing public.nextgen_user_quests%rowtype;
  period_start timestamptz;
  period_end timestamptz;
  v_period_key text;
  measured_progress numeric := 0;
  wallet_balance numeric;
  external_ref text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select *
    into q
  from public.nextgen_quests
  where id = p_quest_id
    and enabled = true
  for update;

  if not found then raise exception 'QUEST_NOT_FOUND'; end if;
  if q.period not in ('daily', 'once') then raise exception 'QUEST_PERIOD_NOT_SUPPORTED'; end if;

  if q.period = 'once' then
    v_period_key := 'lifetime';
  else
    period_start := date_trunc('day', now());
    period_end := period_start + interval '1 day';
    v_period_key := to_char(period_start, 'YYYY-MM-DD');
  end if;

  perform pg_advisory_xact_lock(
    hashtext('nextgen_quest:' || uid::text || ':' || p_quest_id::text || ':' || v_period_key)
  );

  select uq.*
    into existing
  from public.nextgen_user_quests uq
  where uq.user_id = uid
    and uq.quest_id = q.id
    and uq.period_key = v_period_key
  for update;

  case q.quest_key
    when 'faucet_20' then
      select count(*)::numeric into measured_progress
      from public.nextgen_faucet_claims fc
      where fc.user_id = uid
        and fc.claimed_at >= period_start
        and fc.claimed_at < period_end;

    when 'offer_5' then
      select count(*)::numeric into measured_progress
      from public.nextgen_offer_completions oc
      where oc.user_id = uid
        and lower(oc.status) = 'posted'
        and oc.created_at >= period_start
        and oc.created_at < period_end;

    when 'ptc_100' then
      select count(*)::numeric into measured_progress
      from public.nextgen_ptc_sessions ps
      where ps.user_id = uid
        and lower(ps.status) = 'completed'
        and coalesce(ps.completed_at, ps.started_at) >= period_start
        and coalesce(ps.completed_at, ps.started_at) < period_end;

    when 'shortlink_10' then
      select count(*)::numeric into measured_progress
      from public.nextgen_shortlink_completions sc
      where sc.user_id = uid
        and lower(sc.status) = 'posted'
        and sc.created_at >= period_start
        and sc.created_at < period_end;

    when 'telegram_join_like' then
      select case
        when exists (
          select 1
          from public.nextgen_telegram_links tl
          where tl.user_id = uid
            and tl.verified_at is not null
        ) then 1::numeric
        else 0::numeric
      end
      into measured_progress;

    else
      measured_progress := coalesce(existing.progress, 0);
  end case;

  measured_progress := least(measured_progress, q.target_count);

  insert into public.nextgen_user_quests(
    user_id, quest_id, period_key, progress, claimed_at
  )
  values(
    uid, q.id, v_period_key, measured_progress, null
  )
  on conflict (user_id, quest_id, period_key)
  do update set progress = excluded.progress;

  if existing.claimed_at is not null then
    raise exception 'QUEST_ALREADY_CLAIMED';
  end if;

  if measured_progress < q.target_count then
    raise exception 'QUEST_NOT_COMPLETE'
      using detail = measured_progress::text || '/' || q.target_count::text;
  end if;

  external_ref := 'quest:' || q.quest_key || ':' || v_period_key || ':' || uid::text;

  select diamond_balance
    into wallet_balance
  from public.nextgen_wallets
  where user_id = uid
  for update;

  if not found then raise exception 'WALLET_NOT_FOUND'; end if;

  update public.nextgen_wallets
  set diamond_balance = diamond_balance + q.reward_diamond,
      updated_at = now()
  where user_id = uid;

  update public.nextgen_user_quests uq
  set claimed_at = now(),
      progress = measured_progress
  where uq.user_id = uid
    and uq.quest_id = q.id
    and uq.period_key = v_period_key;

  insert into public.nextgen_reward_ledger(
    user_id, source_key, amount_diamond, external_reference, status, metadata
  )
  values(
    uid,
    'quest',
    q.reward_diamond,
    external_ref,
    'posted',
    jsonb_build_object(
      'quest_key', q.quest_key,
      'period_key', v_period_key,
      'progress', measured_progress
    )
  );

  insert into public.nextgen_transactions(
    user_id, tx_type, diamond_delta, usd_delta, reference_id, note
  )
  values(
    uid,
    'quest',
    q.reward_diamond,
    0,
    external_ref,
    'Quest reward: ' || q.title
  );

  return jsonb_build_object(
    'ok', true,
    'quest_id', q.id,
    'quest_key', q.quest_key,
    'reward_diamond', q.reward_diamond,
    'progress', measured_progress,
    'target_count', q.target_count,
    'balance', wallet_balance + q.reward_diamond,
    'period_key', v_period_key
  );
end;
$function$;

revoke all on function public.nextgen_quests_snapshot() from public;
grant execute on function public.nextgen_quests_snapshot() to authenticated;

revoke all on function public.nextgen_claim_quest(bigint) from public;
grant execute on function public.nextgen_claim_quest(bigint) to authenticated;
