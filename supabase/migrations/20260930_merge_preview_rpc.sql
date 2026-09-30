-- NextGenMiner
-- Authoritative merge preview for the logged-in user's miner.
-- Used by app/rooms/[roomNumber]/page.tsx to load the exact merge fee and next-level H/s.

create or replace function public.nextgen_merge_preview(
  p_user_miner_id bigint
)
returns table(
  miner_id bigint,
  current_level integer,
  next_level integer,
  fee_diamond bigint,
  next_hashrate numeric,
  room_bonus_percent numeric
)
language sql
security definer
set search_path to ''
stable
as $function$
  select
    um.miner_id,
    um.current_level,
    um.current_level + 1 as next_level,
    f.fee_diamond,
    nl.hashrate as next_hashrate,
    coalesce(
      case
        when r.room_number = 1 then 0
        else r.room_bonus_percent
      end,
      0
    ) as room_bonus_percent
  from public.nextgen_user_miners um
  left join public.nextgen_miner_merge_fees f
    on f.miner_id = um.miner_id
   and f.from_level = um.current_level
   and f.to_level = um.current_level + 1
   and f.active = true
  left join public.nextgen_miner_levels nl
    on nl.miner_id = um.miner_id
   and nl.level = um.current_level + 1
  left join public.nextgen_miner_room_slots rs
    on rs.user_miner_id = um.id
  left join public.nextgen_mining_rooms r
    on r.id = rs.room_id
   and r.user_id = auth.uid()
  where um.id = p_user_miner_id
    and um.user_id = auth.uid()
    and um.is_merged = false
    and um.current_level between 1 and 9;
$function$;

grant execute on function public.nextgen_merge_preview(bigint)
  to authenticated;
