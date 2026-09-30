create or replace function public.nextgen_merge_fee_rows(
  p_miner_id bigint default null
)
returns table(
  miner_id bigint,
  from_level integer,
  to_level integer,
  fee_diamond bigint
)
language sql
security definer
set search_path to ''
stable
as $function$
  select
    f.miner_id,
    f.from_level,
    f.to_level,
    f.fee_diamond
  from public.nextgen_miner_merge_fees f
  where f.active = true
    and f.from_level between 1 and 9
    and f.to_level = f.from_level + 1
    and (p_miner_id is null or f.miner_id = p_miner_id)
  order by f.miner_id, f.from_level;
$function$;

grant execute on function public.nextgen_merge_fee_rows(bigint)
  to anon, authenticated;
