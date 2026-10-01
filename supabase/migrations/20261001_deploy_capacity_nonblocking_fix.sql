-- NextGenMiner
-- 20261001: Physical miner deployment must not be blocked by
-- economic capacity. A miner may be placed into an unlocked Room
-- while funded mining capacity is unavailable; in that state the
-- miner is DEPLOYED + PAUSED and earns no funded mining reward.

create or replace function public.nextgen_deploy_miner(
  p_user_miner_id bigint,
  p_room_id bigint default null,
  p_slot_index integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  um public.nextgen_user_miners%rowtype;
  r public.nextgen_mining_rooms%rowtype;
  target_slot integer;
  existing_slot record;
  level_row public.nextgen_miner_levels%rowtype;
  membership_factor numeric := 1.0;
  additional_weight numeric := 0;
  room_bonus numeric := 0;
  energy numeric := 100;
  already_deployed boolean := false;
  capacity_allowed boolean := true;
  capacity_status text := 'ALLOWED';
  capacity_reason text := null;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into um
  from public.nextgen_user_miners
  where id = p_user_miner_id
    and user_id = uid
    and is_merged = false
  for update;

  if not found then
    raise exception 'MINER_NOT_FOUND';
  end if;

  already_deployed := (
    um.deployment_state = 'deployed'
    and um.status = 'active'
    and exists (
      select 1
      from public.nextgen_miner_room_slots rs
      where rs.user_miner_id = um.id
    )
  );

  if p_room_id is null then
    insert into public.nextgen_mining_rooms(
      user_id,
      room_number,
      name,
      capacity_slots,
      room_level,
      room_bonus_percent,
      visual_key
    )
    values(
      uid,
      1,
      'STANDARD ROOM',
      12,
      1,
      0,
      'standard'
    )
    on conflict(user_id, room_number) do nothing;

    select *
    into r
    from public.nextgen_mining_rooms
    where user_id = uid
      and room_number = 1;
  else
    select *
    into r
    from public.nextgen_mining_rooms
    where id = p_room_id
      and user_id = uid
    for update;

    if not found then
      raise exception 'ROOM_NOT_FOUND';
    end if;
  end if;

  if p_slot_index is null then
    select gs
    into target_slot
    from generate_series(1, r.capacity_slots) gs
    where not exists (
      select 1
      from public.nextgen_miner_room_slots s
      where s.room_id = r.id
        and s.slot_index = gs
    )
    order by gs
    limit 1;

    if target_slot is null then
      raise exception 'ROOM_FULL';
    end if;
  else
    target_slot := p_slot_index;

    if target_slot < 1 or target_slot > r.capacity_slots then
      raise exception 'INVALID_ROOM_SLOT';
    end if;

    select s.*
    into existing_slot
    from public.nextgen_miner_room_slots s
    where s.room_id = r.id
      and s.slot_index = target_slot
    for update;

    if found and existing_slot.user_miner_id <> p_user_miner_id then
      raise exception 'ROOM_SLOT_OCCUPIED';
    end if;
  end if;

  /*
   * Physical deployment is independent from funded mining capacity.
   * If the capacity guard blocks expansion, the miner is still placed
   * in the Room but remains paused. This prevents ownership/deployment
   * from being confused with economic mining activation.
   */
  if not already_deployed
     and coalesce(um.reward_class, 'standard') <> 'free_bonus'
  then
    select *
    into level_row
    from public.nextgen_miner_levels
    where miner_id = um.miner_id
      and level = um.current_level;

    if not found then
      raise exception 'LEVEL_NOT_CONFIGURED';
    end if;

    select coalesce(p.mining_factor, 1.0)
    into membership_factor
    from public.nextgen_memberships mm
    join public.nextgen_membership_plans p
      on p.id = mm.plan_id
    where mm.user_id = uid
      and mm.status = 'active'
      and mm.starts_at <= now()
      and mm.expires_at > now()
    order by mm.expires_at desc
    limit 1;

    membership_factor := coalesce(membership_factor, 1.0);

    energy := least(
      greatest(coalesce(nullif(um.energy_percent, 0), 100), 0),
      100
    );

    room_bonus := greatest(
      case
        when r.room_number = 1 then 0
        else coalesce(r.room_bonus_percent, 0)
      end,
      0
    );

    additional_weight :=
      greatest(coalesce(level_row.hashrate, 0), 0)
      * (1 + greatest(coalesce(um.bonus_hashrate_percent, 0), 0) / 100.0)
      * (1 + room_bonus / 100.0)
      * greatest(coalesce(level_row.efficiency, 0), 0)
      * (energy / 100.0)
      * greatest(membership_factor, 0);

    if additional_weight > 0 then
      begin
        perform public.nextgen_assert_economic_capacity_for_expansion(
          'USDT',
          additional_weight
        );
      exception
        when others then
          if SQLERRM = 'MINING_CAPACITY_GUARD' then
            capacity_allowed := false;
            capacity_status := 'CAPACITY_GUARDED';
            capacity_reason :=
              'Funded mining capacity is currently unavailable; miner is deployed but mining remains paused.';
          else
            raise;
          end if;
      end;
    end if;
  end if;

  delete from public.nextgen_miner_room_slots
  where user_miner_id = p_user_miner_id;

  insert into public.nextgen_miner_room_slots(
    room_id,
    slot_index,
    user_miner_id
  )
  values(
    r.id,
    target_slot,
    p_user_miner_id
  );

  update public.nextgen_user_miners
  set deployment_state = 'deployed',
      status = case when capacity_allowed then 'active' else 'paused' end,
      last_recharge_at = now(),
      recharge_expires_at =
        case
          when capacity_allowed then
            case
              when coalesce(recharge_expires_at, now()) > now()
                   and deployment_state = 'deployed'
                then recharge_expires_at
              else now() + interval '24 hours'
            end
          else now()
        end,
      last_accrual_at = now(),
      energy_percent = coalesce(nullif(energy_percent, 0), 100),
      energy_updated_at = now()
  where id = p_user_miner_id;

  return jsonb_build_object(
    'ok', true,
    'user_miner_id', p_user_miner_id,
    'room_id', r.id,
    'room_number', r.room_number,
    'slot_index', target_slot,
    'deployment_state', 'deployed',
    'status', case when capacity_allowed then 'active' else 'paused' end,
    'mining_active', capacity_allowed,
    'capacity_guard', capacity_status,
    'capacity_reason', capacity_reason,
    'recharge_expires_at', (
      select recharge_expires_at
      from public.nextgen_user_miners
      where id = p_user_miner_id
    )
  );
end;
$function$;

notify pgrst, 'reload schema';
