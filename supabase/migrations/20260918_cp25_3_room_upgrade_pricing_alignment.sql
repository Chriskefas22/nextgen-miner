/* CP25.3 — ROOM UPGRADE PRICING ALIGNMENT */
update public.nextgen_room_level_config
set upgrade_price_diamond=case room_level
  when 1 then 0
  when 2 then 20000
  when 3 then 60000
  when 4 then 180000
  when 5 then 500000
  else upgrade_price_diamond
end,
updated_at=now();

update public.nextgen_mining_rooms r
set capacity_slots=coalesce((select c.capacity_slots from public.nextgen_room_level_config c where c.room_level=r.room_level),12),
    updated_at=now();
