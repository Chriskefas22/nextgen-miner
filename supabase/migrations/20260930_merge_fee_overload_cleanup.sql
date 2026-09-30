-- NextGenMiner
-- Remove the legacy no-argument merge-fee overload.
-- Keep the miner-specific function as the only signature.

drop function if exists public.nextgen_merge_fee_snapshot();

create or replace function public.nextgen_merge_fee_snapshot(
  p_miner_id bigint default null
)
returns jsonb
language sql
security definer
set search_path to ''
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'miner_id', miner_id,
        'from_level', from_level,
        'to_level', to_level,
        'fee_diamond', fee_diamond
      )
      order by miner_id, from_level
    ),
    '[]'::jsonb
  )
  from public.nextgen_miner_merge_fees
  where active = true
    and from_level between 1 and 9
    and to_level = from_level + 1
    and (p_miner_id is null or miner_id = p_miner_id);
$function$;
