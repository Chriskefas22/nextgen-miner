-- NEXTGEN MINER
-- Starter Keyboard = permanent free starter miner.
-- This changes future registration-bonus provisioning to use
-- Starter Keyboard instead of Entry GPU / Basic CPU.
--
-- Existing miners are NOT converted by this migration.
-- Existing Entry GPU claims remain as they are.

begin;

update public.nextgen_registration_bonus_campaigns
set
  campaign_name = 'Starter Keyboard Free Miner',
  bonus_miner_id = (
    select id
    from public.nextgen_miner_catalog
    where slug = 'starter-keyboard'
      and enabled = true
    limit 1
  ),
  fallback_miner_id = (
    select id
    from public.nextgen_miner_catalog
    where slug = 'starter-keyboard'
      and enabled = true
    limit 1
  ),
  updated_at = now()
where campaign_key = 'launch-entry-gpu';

commit;

-- Verification:
select
  c.campaign_key,
  c.campaign_name,
  c.total_slots,
  c.claimed_slots,
  c.enabled,
  bm.slug as bonus_miner,
  fm.slug as fallback_miner
from public.nextgen_registration_bonus_campaigns c
left join public.nextgen_miner_catalog bm
  on bm.id = c.bonus_miner_id
left join public.nextgen_miner_catalog fm
  on fm.id = c.fallback_miner_id
where c.campaign_key = 'launch-entry-gpu';
