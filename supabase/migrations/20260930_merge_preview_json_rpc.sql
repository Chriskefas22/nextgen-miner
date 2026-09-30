-- NextGenMiner
-- Authoritative scalar JSON merge preview.

create or replace function public.nextgen_merge_preview_json(
  p_user_miner_id bigint
)
returns jsonb
language sql
security definer
set search_path to ''
stable
as $function$
  select coalesce(
    (
      select jsonb_build_object(
        'ok', true,
        'miner_id', um.miner_id,
        'current_level', um.current_level,
        'next_level', um.current_level + 1,
        'fee_diamond', f.fee_diamond,
        'next_hashrate', nl.hashrate,
        'room_bonus_percent',
          coalesce(
            case
              when r.room_number = 1 then 0
              else r.room_bonus_percent
            end,
            0
          )
      )
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
        and um.current_level between 1 and 9
      limit 1
    ),
    jsonb_build_object(
      'ok', false,
      'error_code', 'MERGE_PREVIEW_NOT_FOUND'
    )
  );
$function$;

grant execute on function public.nextgen_merge_preview_json(bigint)
  to anon, authenticated;

notify pgrst, 'reload schema';
