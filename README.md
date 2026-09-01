# NextGen Miner — Miner Store Visual Upgrade

This drop replaces the current miner shop presentation while preserving the project's Supabase + RPC architecture.

## GitHub paths

- `app/miners/page.tsx`
- `components/miner/MinerCard.tsx`
- `components/miner/miner-card.css`
- `public/assets/miners/miner-sprite.webp`
- `public/assets/miners/*.svg`

## Catalog

Core: Basic CPU, Entry GPU, Gaming PC, Mini Rig, Performance Rig, Hydro Rig, Titan Rig, Nebula Station, Nuclear Reactor, Orion Core, Quantum Rig.

Premium: Dark Matter Engine, Solaris Array, Chrono Nexus, Galactic Core, Infinity Nexus.

Starter Keyboard is removed from the UI and is not included in the visual map.

## Data source

Miner economics remain database-driven from `nextgen_miner_catalog`, `nextgen_miner_levels`, `nextgen_user_miners`, and `nextgen_wallets`.

Purchase/upgrade remains through the existing RPCs `nextgen_purchase_miner(p_miner_id)` and `nextgen_upgrade_miner(p_user_miner_id)`.

No `lib/miners.ts` file is introduced.
