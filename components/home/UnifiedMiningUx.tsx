'use client';

import type { HomeSnapshot } from './HomeCommandCenter';
import Link from 'next/link';
import { ArrowRight, Boxes, CircleGauge, Cpu, Gem, Gauge, Layers3, RefreshCw, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './UnifiedMiningUx.module.css';

type AssetOption = HomeSnapshot['crypto_options'][number];

type WalletBalance = {
  asset: string;
  balance: number;
  reserved_balance: number;
};

type RoomSummary = {
  id: number;
  room_number: number;
  name: string;
  room_level: number;
  capacity_slots: number;
  used_slots: number;
  active_miners: number;
  hashrate: number;
};

type OwnedMiner = {
  id: number;
  name: string;
  slug: string;
  tier: string;
  level: number;
  hashrate: number;
  status: string;
  deployment_state: 'inventory' | 'deployed';
  image_path: string | null;
  energy_percent: number;
  recharge_expires_at: string | null;
};

const n = (value: number | string | null | undefined, digits = 2) =>
  Number(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: digits });

const money = (value: number | string | null | undefined, digits = 2) =>
  Number(value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const crypto = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 12 });

function CoinMark({ asset }: { asset: string }) {
  const letter = asset === 'BTC' ? '₿' : asset.slice(0, 1).toUpperCase();
  return <span className={styles.coinMark}>{letter}</span>;
}

function imagePath(path: string | null, slug: string) {
  if (!path) return `/assets/miners/${slug}.webp`;
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('assets/')) return `/${clean}`;
  if (clean.startsWith('miners/')) return `/assets/${clean}`;
  return `/assets/miners/${slug}.webp`;
}

function roomLoad(used: number, capacity: number) {
  return Math.min(100, (used / Math.max(capacity, 1)) * 100);
}

function shortTier(tier: string) {
  const value = tier.replaceAll('_', ' ').trim();
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function LiveMiningTop({
  data,
  asset,
  onAssetChange,
  loading,
  liveDisplay,
  activeNow,
  onRecharge,
}: {
  data: HomeSnapshot;
  asset: string;
  onAssetChange: (nextAsset: string) => Promise<void> | void;
  loading: boolean;
  liveDisplay: number;
  activeNow: boolean;
  onRecharge: () => void;
}) {
  const selected = data.crypto_options.find((item) => item.asset === asset) ?? data.selected_asset;
  const choices = useMemo(() => {
    const enabled = data.crypto_options.filter((item) => item.mining_enabled && item.pool_enabled);
    const merged = [selected as AssetOption, ...enabled.filter((item) => item.asset !== selected.asset)];
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (seen.has(item.asset)) return false;
      seen.add(item.asset);
      return true;
    }).slice(0, 8);
  }, [data.crypto_options, selected]);

  const coverage = Number(data.live_earnings.starter_coverage_days ?? 0);
  const coverageText = Number.isFinite(coverage) && coverage > 0 && coverage < 100000
    ? `${coverage.toFixed(1)} days`
    : 'Guarded';

  return (
    <section className={styles.liveCard} aria-label="Live mining control">
      <div className={styles.liveGlow} aria-hidden="true" />
      <div className={styles.liveHeader}>
        <div>
          <div className={styles.kicker}>LIVE MINING</div>
          <h1>Current Accrual</h1>
          <p>Server-settled mining output, visualized live from the active NextGen mining snapshot.</p>
        </div>
        <div className={`${styles.stateBadge} ${activeNow ? styles.stateLive : styles.statePaused}`}>
          <span />
          {activeNow ? 'MINING ACTIVE' : 'MINING PAUSED'}
        </div>
      </div>

      <div className={styles.liveMain}>
        <div className={styles.accrualBlock}>
          <div className={styles.accrualLine}>
            <strong>{crypto(liveDisplay)}</strong>
            <span>{asset}</span>
          </div>
          <div className={styles.snapshotLine}>
            <ShieldCheck size={14} />
            ${money(data.live_earnings.estimated_usd)} USD server snapshot · {activeNow ? 'live visualization active' : 'action required'}
          </div>
        </div>

        <div className={styles.liveActions}>
          <button type="button" className={styles.primaryAction} onClick={onRecharge} disabled={loading}>
            <Zap size={16} />
            {activeNow ? 'RECHARGE 24H' : 'RECHARGE & RESUME'}
            <ArrowRight size={15} />
          </button>
          <Link href="/rooms" className={styles.secondaryAction}>
            <Boxes size={16} />
            FARM CONTROL
          </Link>
        </div>
      </div>

      <div className={styles.metricRail}>
        <div><small>PER HOUR</small><b>${money(data.live_earnings.hourly_usd)}</b><span>current pace</span></div>
        <div><small>TODAY</small><b>${money(data.live_earnings.daily_usd)}</b><span>projected day</span></div>
        <div><small>30D EST.</small><b>${money(data.live_earnings.thirty_day_usd)}</b><span>reference estimate</span></div>
        <div><small>HASHPOWER</small><b>{n(data.effective_hashrate)} <em>H/s</em></b><span>effective network share</span></div>
      </div>

      <div className={styles.assetHeader}>
        <div>
          <div className={styles.miniLabel}>SELECT MINING ASSET</div>
          <p>Choose which supported cryptocurrency is used for the live mining pool.</p>
        </div>
        <span className={styles.rateChip}><i /> LIVE RATE</span>
      </div>

      <div className={styles.assetRail}>
        {choices.map((option) => {
          const active = option.asset === asset;
          return (
            <button
              key={option.asset}
              type="button"
              className={`${styles.assetChoice} ${active ? styles.assetChoiceActive : ''}`}
              onClick={() => void onAssetChange(option.asset)}
              disabled={loading && active}
            >
              <CoinMark asset={option.asset} />
              <span>
                <b>{option.asset}</b>
                <small>{option.display_name}</small>
              </span>
              {active ? <span className={styles.selectedDot}>ACTIVE</span> : null}
            </button>
          );
        })}
      </div>

      <div className={styles.liveFooter}>
        <div><span>LIVE RATE</span><b>${selected.rate_usd ? n(selected.rate_usd, 8) : '—'}</b></div>
        <div><span>CAPACITY</span><b>{Number(data.live_earnings.capacity_multiplier ?? 1).toFixed(4)}×</b></div>
        <div><span>STARTER COVERAGE</span><b>{coverageText}</b></div>
        <div><span>SETTLEMENT</span><b>{data.live_earnings.claim_is_server_settled ? 'SERVER' : 'PENDING'}</b></div>
      </div>
    </section>
  );
}

export function MiningOpsPanels({
  data,
  asset,
  onRecharge,
}: {
  data: HomeSnapshot;
  asset: string;
  onRecharge: () => void;
}) {
  const [wallet, setWallet] = useState<WalletBalance[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [miners, setMiners] = useState<OwnedMiner[]>([]);
  const [opsLoading, setOpsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadOps() {
      try {
        const sb = createClient();
        const auth = await sb.auth.getUser();
        const userId = auth.data.user?.id;
        if (!userId) return;

        const [walletResult, roomResult, catalogResult, userMinerResult, levelResult] = await Promise.all([
          sb.from('nextgen_crypto_balances').select('asset,balance,reserved_balance').eq('user_id', userId).order('asset'),
          sb.rpc('nextgen_rooms_snapshot'),
          sb.from('nextgen_miner_catalog').select('id,slug,name,tier,image_path,base_hashrate').eq('enabled', true).order('sort_order'),
          sb.from('nextgen_user_miners').select('id,miner_id,current_level,status,deployment_state,energy_percent,recharge_expires_at').eq('user_id', userId).eq('is_merged', false).order('id'),
          sb.from('nextgen_miner_levels').select('miner_id,level,hashrate').order('miner_id').order('level'),
        ]);

        if (!alive) return;

        if (!walletResult.error) {
          setWallet((walletResult.data ?? []).map((row: any) => ({
            asset: String(row.asset),
            balance: Number(row.balance ?? 0),
            reserved_balance: Number(row.reserved_balance ?? 0),
          })));
        }

        if (!roomResult.error && Array.isArray(roomResult.data?.rooms)) {
          setRooms(roomResult.data.rooms.map((room: any) => ({
            id: Number(room.id),
            room_number: Number(room.room_number),
            name: String(room.name),
            room_level: Number(room.room_level ?? 1),
            capacity_slots: Number(room.capacity_slots ?? 12),
            used_slots: Number(room.used_slots ?? 0),
            active_miners: Number(room.active_miners ?? 0),
            hashrate: Number(room.hashrate ?? 0),
          })));
        }

        if (!catalogResult.error && !userMinerResult.error && !levelResult.error) {
          const catalog = new Map<number, { name: string; slug: string; tier: string; image_path: string | null; base_hashrate: number }>();
          for (const row of (catalogResult.data ?? []) as any[]) {
            catalog.set(Number(row.id), {
              name: String(row.name),
              slug: String(row.slug),
              tier: String(row.tier ?? ''),
              image_path: row.image_path ? String(row.image_path) : null,
              base_hashrate: Number(row.base_hashrate ?? 0),
            });
          }

          const levels = new Map<string, number>();
          for (const row of (levelResult.data ?? []) as any[]) {
            levels.set(`${Number(row.miner_id)}:${Number(row.level)}`, Number(row.hashrate ?? 0));
          }

          setMiners((userMinerResult.data ?? []).map((row: any) => {
            const minerId = Number(row.miner_id);
            const currentLevel = Number(row.current_level ?? 1);
            const meta = catalog.get(minerId);
            return {
              id: Number(row.id),
              name: meta?.name ?? 'NextGen Miner',
              slug: meta?.slug ?? 'basic-cpu',
              tier: meta?.tier ?? 'STARTER',
              level: currentLevel,
              hashrate: levels.get(`${minerId}:${currentLevel}`) ?? meta?.base_hashrate ?? 0,
              status: String(row.status ?? 'paused'),
              deployment_state: row.deployment_state === 'deployed' ? 'deployed' : 'inventory',
              image_path: meta?.image_path ?? null,
              energy_percent: Number(row.energy_percent ?? 0),
              recharge_expires_at: row.recharge_expires_at ? String(row.recharge_expires_at) : null,
            };
          }));
        }
      } catch {
        // Operations widgets are secondary UI; dashboard availability must not depend on them.
      } finally {
        if (alive) setOpsLoading(false);
      }
    }

    setOpsLoading(true);
    void loadOps();
    const timer = window.setInterval(loadOps, 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [data.live_earnings.as_of, data.selected_asset.asset]);

  const liveMiners = useMemo(
    () => miners.filter((miner) => miner.status.toLowerCase() === 'active' && miner.deployment_state === 'deployed'),
    [miners],
  );

  const fleetEnergy = useMemo(() => {
    if (!liveMiners.length) return 0;
    return liveMiners.reduce((sum, miner) => sum + Math.max(0, Math.min(100, miner.energy_percent)), 0) / liveMiners.length;
  }, [liveMiners]);

  const selectedWallet = wallet.find((item) => item.asset.toUpperCase() === asset.toUpperCase());
  const selectedAvailable = selectedWallet
    ? Math.max(0, selectedWallet.balance - selectedWallet.reserved_balance)
    : 0;
  const selectedRate = Number(data.selected_asset.rate_usd ?? 0);
  const selectedUsd = selectedAvailable * selectedRate;

  const roomCapacity = rooms.reduce((sum, room) => sum + room.capacity_slots, 0);
  const roomUsed = rooms.reduce((sum, room) => sum + room.used_slots, 0);
  const loadPercent = roomCapacity ? Math.min(100, (roomUsed / roomCapacity) * 100) : 0;

  const walletItems = useMemo(
    () => wallet.filter((item) => Number(item.balance) > 0 || item.asset.toUpperCase() === asset.toUpperCase()).slice(0, 8),
    [wallet, asset],
  );

  const topMiners = useMemo(
    () => [...miners].sort((a, b) => (b.hashrate - a.hashrate) || (b.level - a.level)).slice(0, 4),
    [miners],
  );

  return (
    <section className={styles.opsGrid} aria-label="Mining operations overview">
      <article className={`${styles.opsPanel} ${styles.farmPanel}`}>
        <div className={styles.panelTop}>
          <div><div className={styles.kicker}>MINING RIG</div><h2>Your active farm</h2><p>Rooms, deployed miners and total capacity in one control view.</p></div>
          <Link href="/rooms" className={styles.textLink}>ROOMS <ArrowRight size={13} /></Link>
        </div>
        <div className={styles.farmStatus}><span className={styles.onlineDot} />{liveMiners.length ? 'ONLINE · FARM ACTIVE' : 'ONLINE · WAITING FOR DEPLOYMENT'}</div>
        <div className={styles.farmMetrics}>
          <div><small>HASHPOWER</small><b>{n(data.active_hashrate)} H/s</b></div>
          <div><small>ROOMS</small><b>{rooms.length} / 5</b></div>
          <div><small>CAPACITY</small><b>{roomUsed} / {roomCapacity || 0}</b></div>
          <div><small>DEPLOYED</small><b>{liveMiners.length}</b></div>
        </div>
        <div className={styles.capacityWrap}>
          <div><span>SPACE UTILIZATION</span><b>{loadPercent.toFixed(0)}%</b></div>
          <i><span style={{ width: `${loadPercent}%` }} /></i>
        </div>
        <div className={styles.roomRail}>
          {rooms.length ? rooms.map((room) => {
            const roomLoadValue = roomLoad(room.used_slots, room.capacity_slots);
            return (
              <div key={room.id} className={styles.roomTile}>
                <div><b>ROOM {String(room.room_number).padStart(2, '0')}</b><span>LV {room.room_level}</span></div>
                <strong>{room.used_slots}/{room.capacity_slots}</strong>
                <small>{n(room.hashrate)} H/s · {room.active_miners} active</small>
                <i><span style={{ width: `${roomLoadValue}%` }} /></i>
              </div>
            );
          }) : <div className={styles.emptyState}>No Rooms available yet. Open Rooms to manage your mining workspace.</div>}
        </div>
      </article>

      <article className={styles.opsPanel}>
        <div className={styles.panelTop}>
          <div><div className={styles.kicker}>MINING ENERGY</div><h2>Fleet activation</h2><p>Energy is displayed from each miner's server-managed activation state.</p></div>
          <CircleGauge size={20} />
        </div>
        <div className={styles.energyGauge}>
          <div><strong>{fleetEnergy.toFixed(0)}%</strong><span>ACTIVE FLEET ENERGY</span></div>
          <div className={styles.energyBar}><i style={{ width: `${fleetEnergy}%` }} /></div>
        </div>
        <div className={styles.energyStats}>
          <div><span>ACTIVE MINERS</span><b>{liveMiners.length}</b></div>
          <div><span>EFFECTIVE HASH</span><b>{n(data.effective_hashrate)} H/s</b></div>
          <div><span>ACTIVATION</span><b>{data.hashrate_status.premium ? 'PREMIUM' : 'STANDARD'}</b></div>
        </div>
        <button type="button" className={styles.secondaryWide} onClick={onRecharge}>
          <RefreshCw size={15} />
          Refresh / Recharge Mining
        </button>
      </article>

      <article className={styles.opsPanel}>
        <div className={styles.panelTop}>
          <div><div className={styles.kicker}>CRYPTO WALLET</div><h2>Your mined balances</h2><p>Available crypto remains separate from Diamond until you exchange it.</p></div>
          <Link href="/wallet" className={styles.textLink}>WALLET <ArrowRight size={13} /></Link>
        </div>
        <div className={styles.diamondStrip}><Gem size={17} /><span>DIAMOND</span><b>{n(data.diamond_balance, 0)}</b></div>
        <div className={styles.walletList}>
          {walletItems.length ? walletItems.map((item) => {
            const available = Math.max(0, item.balance - item.reserved_balance);
            const selected = item.asset.toUpperCase() === asset.toUpperCase();
            return (
              <div key={item.asset} className={`${styles.walletRow} ${selected ? styles.walletRowActive : ''}`}>
                <CoinMark asset={item.asset} />
                <span><b>{item.asset}</b><small>{selected ? 'Selected mining asset' : 'Available balance'}</small></span>
                <strong>{crypto(available)}</strong>
              </div>
            );
          }) : <div className={styles.emptyState}>No mined crypto balance yet.</div>}
        </div>
      </article>

      <article className={`${styles.opsPanel} ${styles.reinvestPanel}`}>
        <div className={styles.panelTop}>
          <div><div className={styles.kicker}>REINVEST</div><h2>Convert crypto to Diamond</h2><p>Use settled crypto to fund the internal upgrade economy.</p></div>
          <Sparkles size={20} />
        </div>
        <div className={styles.reinvestCard}>
          <div><CoinMark asset={asset} /><div><small>SELECTED ASSET</small><b>{asset}</b></div><span>{crypto(selectedAvailable)}</span></div>
          <div className={styles.reinvestValue}><span>AVAILABLE USD VALUE</span><strong>${money(selectedUsd)}</strong><small>Based on the current platform rate for {asset}.</small></div>
        </div>
        <Link href="/wallet" className={styles.primaryWide}>
          <Gem size={16} />
          OPEN CRYPTO → DIAMOND EXCHANGE
          <ArrowRight size={15} />
        </Link>
      </article>

      <article className={`${styles.opsPanel} ${styles.minersPanel}`}>
        <div className={styles.panelTop}>
          <div><div className={styles.kicker}>MINERS</div><h2>Your mining rigs</h2><p>Owned miners across Inventory and Rooms, with live level and hashrate.</p></div>
          <Link href="/miners" className={styles.textLink}>ARSENAL <ArrowRight size={13} /></Link>
        </div>
        <div className={styles.minerRail}>
          {topMiners.map((miner) => (
            <div key={miner.id} className={styles.minerCard}>
              <div className={styles.minerVisual}>
                <img src={imagePath(miner.image_path, miner.slug)} alt="" />
                <span>LV {miner.level}</span>
              </div>
              <div className={styles.minerInfo}>
                <b>{miner.name}</b>
                <small>{shortTier(miner.tier)} · {miner.deployment_state === 'deployed' ? 'ROOM' : 'INVENTORY'}</small>
                <strong>{n(miner.hashrate)} <em>H/s</em></strong>
              </div>
            </div>
          ))}
          {!topMiners.length ? (
            <div className={styles.emptyMiner}>
              <Cpu size={22} />
              <div><b>No miners deployed yet</b><span>Buy a miner, place it in Inventory, then deploy it into a Room.</span></div>
            </div>
          ) : null}
        </div>
      </article>

      {opsLoading ? <div className={styles.syncBadge}><Gauge size={13} /> Operations syncing…</div> : null}
      <div className={styles.capacityNote}><Layers3 size={14} /> Workspace capacity is server-controlled; this dashboard only visualizes the current state.</div>
    </section>
  );
}
