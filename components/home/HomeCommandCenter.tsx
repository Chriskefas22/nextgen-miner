'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarCheck2,
  ChevronRight,
  Coins,
  Cuboid,
  Gauge,
  HeartPulse,
  History,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './HomeCommandCenter.module.css';
import { HolographicEarth } from './HolographicEarth';
import { LiveMiningTop, MiningOpsPanels } from './UnifiedMiningUx';

export type HomeSnapshot = {
  engine: string; today_utc: string; asset: string; diamond_balance: number | string; reserved_diamond: number | string;
  active_miners: number; active_hashrate: number | string; effective_hashrate: number | string;
  room: { name: string; room_count: number; capacity: number; workers: number; load_percent: number | string; hashrate: number | string };
  hashrate_status: { status: string; recharge_expires_at: string | null; premium: boolean; membership_expires_at: string | null };
  membership: { active: boolean; slug: string; name: string; mining_factor: number | string; task_multiplier: number | string; referral_multiplier: number | string; task_limit_multiplier: number | string; upgrade_discount_bps: number; daily_bonus_diamond: number | string; premium_miner_access: boolean; priority_support: boolean; early_access: boolean; expires_at: string | null };
  pool: { pool_date: string; asset: string; mining_budget_usd: number | string; allocated_usd: number | string; reward_rate_usd_per_hash_second: number | string; reserve_balance_usd: number | string; reserve_coverage_ratio: number | string; reserve_status: string; network_baseline_hashrate: number | string; network_baseline_weight: number | string; prepared_at: string | null; mining_allocation_bps: number; reserve_allocation_bps: number; rolling_10d_net_revenue_usd: number | string; rolling_10d_mining_release_usd: number | string; mining_lot_days: number } | null;
  selected_asset: { asset: string; display_name: string; mining_enabled: boolean; pool_enabled: boolean; rate_usd: number | string; rate_updated_at: string | null; status: string };
  live_earnings: { status: string; estimated_usd: number | string; estimated_crypto: number | string; elapsed_seconds: number | string; currency: string; claim_is_server_settled: boolean; source?: string; hourly_usd?: number | string; daily_usd?: number | string; thirty_day_usd?: number | string; reward_rate_usd_per_hash_second?: number | string; crypto_rate_usd?: number | string; capacity_multiplier?: number | string; starter_reserve_balance_usd?: number | string; starter_coverage_days?: number | string; recharge_expires_at?: string | null; as_of?: string };
  streak: { current: number; best: number; today_claimed: boolean; base_reward_diamond: number | string; days: Array<{ day: number; status: 'claimed' | 'ready' | 'locked'; reward_diamond: number | string }> };
  bonuses: Array<{ key: string; label: string; value: string; active: boolean }>;
  crypto_options: Array<{ asset: string; display_name: string; mining_enabled: boolean; pool_enabled: boolean; rate_usd: number | string; rate_updated_at: string | null; status: string }>;
  earnings_history: Array<{ date: string; allocated_usd: number | string; crypto_amount: number | string }>;
  recent_transactions: Array<{ id: number; type: string; diamond_delta: number | string; usd_delta: number | string; asset: string | null; crypto_amount: number | string | null; created_at: string }>;
};

type ClaimStatus = { asset: string; settlement_date: string; status: 'READY' | 'ALREADY_SETTLED' | 'NOT_READY'; reason: string; payout_id: number | null; mining_budget_usd: number | string; pool_prepared: boolean };

const num = (v: number | string | null | undefined, digits = 2) =>
  Number(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: digits });
const money = (v: number | string | null | undefined, digits = 2) =>
  Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const crypto = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: 12 });
const clean = (v: string) => v.replaceAll('_', ' ');

function actionError(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message?: unknown }).message ?? 'Action failed');
  return e instanceof Error ? e.message : 'Action failed';
}

function sparkPath(values: number[]) {
  const width = 680, height = 220, pad = 22;
  const max = Math.max(...values, 0.0000001), min = Math.min(...values, 0), span = Math.max(max - min, 0.0000001);
  return values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function HomeCommandCenter({ initialData }: { initialData: HomeSnapshot }) {
  const [data, setData] = useState(initialData);
  const [claim, setClaim] = useState<ClaimStatus | null>(null);
  const [asset, setAsset] = useState(initialData.asset || 'USDT');
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [recharging, setRecharging] = useState(false);
  const [message, setMessage] = useState('');
  const [clock, setClock] = useState(Date.now());

  type NetworkUserLight = {
    lat: number;
    lon: number;
    intensity: number;
    country_code?: string;
  };

  const [networkUserLights, setNetworkUserLights] =
    useState<NetworkUserLight[]>([]);

  const load = useCallback(async (nextAsset = asset, silent = false) => {
    const sb = createClient();
    if (!silent) setLoading(true);
    try {
      const [a, c, n] = await Promise.all([
        sb.rpc('nextgen_farm_snapshot', { p_asset: nextAsset }),
        sb.rpc('nextgen_farm_claim_status', { p_asset: nextAsset }),
        sb.rpc('nextgen_home_network_lights'),
      ]);
      if (a.error) throw a.error;
      if (c.error) throw c.error;
      if (n.error) throw n.error;
      setData(a.data as HomeSnapshot);
      setNetworkUserLights(Array.isArray(n.data) ? (n.data as NetworkUserLight[]) : []);
      setClaim(c.data as ClaimStatus);
      setAsset(nextAsset);
    } catch (e) {
      setMessage(actionError(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [asset]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();

        if (user && !user.user_metadata?.country_code) {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
          const language = navigator.language ?? '';
          const response = await fetch(
            `/api/network/country?timezone=${encodeURIComponent(timezone)}&language=${encodeURIComponent(language)}`,
            { cache: 'no-store' },
          );
          const payload = await response.json();
          const code = typeof payload?.country_code === 'string' ? payload.country_code.toUpperCase() : '';

          if (!cancelled && /^[A-Z]{2}$/.test(code)) {
            await sb.auth.updateUser({ data: { country_code: code } });
          }
        }
      } catch {
        // Decorative map metadata must never block dashboard use.
      }

      if (!cancelled) await load(asset, true);
    })();

    const t = window.setInterval(() => void load(asset, true), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [asset, load]);

  useEffect(() => {
    const t = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const historyValues = useMemo(
    () => data.earnings_history.map((x) => Number(x.allocated_usd ?? 0)),
    [data.earnings_history],
  );
  const chart = useMemo(
    () => sparkPath(historyValues.length ? historyValues : [0, 0, 0, 0, 0, 0, 0]),
    [historyValues],
  );

  const activeNow =
    ['ACTIVE', 'ACTIVE_GUARDED', 'ACTIVE_POOL'].includes(data.live_earnings.status) &&
    (!data.live_earnings.recharge_expires_at || clock < new Date(data.live_earnings.recharge_expires_at).getTime());

  const snapshotMs = new Date(data.live_earnings.as_of ?? new Date().toISOString()).getTime();
  const elapsedSeconds = Math.max(0, (clock - snapshotMs) / 1000);
  const maxLiveSeconds = data.live_earnings.recharge_expires_at
    ? Math.max(0, (new Date(data.live_earnings.recharge_expires_at).getTime() - clock) / 1000)
    : elapsedSeconds;
  const cryptoUsd = Math.max(Number(data.live_earnings.crypto_rate_usd ?? 1), 0.0000001);
  const perSecond = Number(data.live_earnings.reward_rate_usd_per_hash_second ?? 0) * Number(data.effective_hashrate ?? 0) / cryptoUsd;
  const liveDisplay = activeNow
    ? Number(data.live_earnings.estimated_crypto ?? 0) + Math.min(elapsedSeconds, maxLiveSeconds) * Math.max(perSecond, 0)
    : Number(data.live_earnings.estimated_crypto ?? 0);

  const poolBudget = Number(data.pool?.mining_budget_usd ?? 0);
  const poolAllocated = Number(data.pool?.allocated_usd ?? 0);
  const dailyClaim = data.streak.days.find((d) => d.status === 'ready');
  const activity = data.recent_transactions.slice(0, 4);

  async function settle() {
    if (claim?.status !== 'READY' || claiming) return;
    setClaiming(true);
    setMessage('');
    try {
      const r = await createClient().rpc('nextgen_claim_mining', { p_asset: asset });
      if (r.error) throw r.error;
      setMessage(r.data?.settled ? `Settlement ${r.data?.payout_id ? `#${r.data.payout_id} ` : ''}posted successfully.` : String(r.data?.reason ?? 'No settlement was available.'));
      await load(asset, true);
    } catch (e) {
      setMessage(actionError(e));
    } finally {
      setClaiming(false);
    }
  }

  async function checkIn() {
    if (checkingIn || data.streak.today_claimed) return;
    setCheckingIn(true);
    setMessage('');
    try {
      const r = await createClient().rpc('nextgen_claim_daily_checkin');
      if (r.error) throw r.error;
      setMessage(`Daily check-in claimed: ${num(r.data?.diamond_awarded, 0)} 💎.`);
      await load(asset, true);
    } catch (e) {
      setMessage(actionError(e));
    } finally {
      setCheckingIn(false);
    }
  }

  async function recharge() {
    if (recharging) return;
    setRecharging(true);
    setMessage('');
    try {
      const r = await createClient().rpc('nextgen_recharge_hashrate');
      if (r.error) throw r.error;
      setMessage('Mining recharged for 24h.');
      await load(asset, true);
    } catch (e) {
      setMessage(actionError(e));
    } finally {
      setRecharging(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* HOME EARTH / GLOBE BLOCK — intentionally preserved. Do not modify. */}
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.heroKicker}>WELCOME BACK</div>
          <div className={styles.heroTitle}>YOUR <span>MINING CORE</span></div>
          <p>Recharge your starter reserve to resume mining.<br className={styles.desktopOnly} /> Choose your asset, stay active and grow your earnings.</p>
          <div className={`${styles.pausePill} ${activeNow ? styles.activePill : ''}`}><span className={styles.pulseDot} />{activeNow ? 'MINING ACTIVE' : 'PAUSED · ACTION NEEDED'}</div>
          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} onClick={() => void recharge()} disabled={recharging}>
              <Zap size={17} />
              {recharging ? 'RECHARGING…' : activeNow ? 'RECHARGE 24H' : 'RECHARGE & RESUME'}
              <ChevronRight size={17} />
            </button>
            <Link className={styles.secondaryBtn} href="/miners"><Cuboid size={17} />View Miner Arsenal</Link>
          </div>
          <div className={styles.statusChips}>
            <div><span className={styles.chipIcon}><Activity size={15} /></span><div><b>Server Online</b><small>Low Latency</small></div></div>
            <div><span className={styles.chipIcon}><ShieldCheck size={15} /></span><div><b>Network Secured</b><small>256-bit Encryption</small></div></div>
            <div><span className={styles.chipIcon}><Gauge size={15} /></span><div><b>Economy Stable</b><small>Live Data</small></div></div>
          </div>
        </div>
        <div className={styles.heroVisual} aria-label="Live NextGen global network visualization">
          <HolographicEarth metrics={{
            asset,
            status: activeNow ? 'LIVE' : 'PAUSED',
            activeHashrate: num(data.active_hashrate),
            activeMiners: num(data.active_miners, 0),
            dailyOutputUsd: money(data.live_earnings.daily_usd),
            networkUserLights,
          }} />
        </div>
      </section>

      {/* CP25 — primary live mining surface */}
      <LiveMiningTop
        data={data}
        asset={asset}
        onAssetChange={load}
        loading={loading}
        liveDisplay={liveDisplay}
        activeNow={activeNow}
        onRecharge={() => void recharge()}
      />

      {message ? <section className={styles.notice}><ShieldCheck size={16} />{message}</section> : null}

      <section className={styles.statsRow}>
        <div className={styles.statCard}><span><Zap size={16} />ACTIVE HASHRATE</span><strong>{num(data.active_hashrate)} <em>H/s</em></strong><small>Live platform snapshot</small></div>
        <div className={styles.statCard}><span><Coins size={16} />MINING OUTPUT (TODAY)</span><strong>${money(data.live_earnings.daily_usd)}</strong><small>{money(data.live_earnings.estimated_crypto)} {asset}</small></div>
        <div className={styles.statCard}><span><Cuboid size={16} />ACTIVE MINERS</span><strong>{data.active_miners}</strong><Link href="/miners">View All <ArrowRight size={13} /></Link></div>
        <div className={styles.statCard}><span><Sparkles size={16} />DIAMOND BALANCE</span><strong>{num(data.diamond_balance, 0)}</strong><small>Internal Utility</small></div>
      </section>

      {/* CP25 — Mining Rig / Energy / Wallet / Reinvest / Miners */}
      <MiningOpsPanels
        data={data}
        asset={asset}
        onRecharge={() => void recharge()}
      />

      <section className={styles.poolPanel} aria-label="USDT mining pool economics">
        <div className={styles.poolPanelHead}>
          <div>
            <div className={styles.sectionKicker}>ECONOMIC POOL</div>
            <h2>Today's USDT Mining Budget</h2>
            <p>Verified deposits fund the shared pool. Miner hashrate determines each active user's share.</p>
          </div>
          <span className={styles.poolState}>{data.pool?.reserve_status ?? 'SYNCING'}</span>
        </div>
        <div className={styles.poolMetrics}>
          <div><small>POOL BUDGET</small><b>${money(data.pool?.mining_budget_usd)}</b></div>
          <div><small>ALLOCATED</small><b>${money(data.pool?.allocated_usd)}</b></div>
          <div><small>REMAINING</small><b>${money(Math.max(poolBudget - poolAllocated, 0))}</b></div>
          <div><small>10D REVENUE</small><b>${money(data.pool?.rolling_10d_net_revenue_usd)}</b></div>
        </div>
        <div className={styles.poolNote}>
          <span>Funding is counted once.</span>
          <span>Unused Diamond does not create another revenue source.</span>
          <span>New deposits join the rolling pool according to the daily accounting window.</span>
        </div>
      </section>

      <section className={styles.threeCol}>
        <div className={`${styles.panel} ${styles.earningsPanel}`}>
          <div className={styles.panelHeader}>
            <div><div className={styles.sectionKicker}>EARNINGS SIGNAL</div><h2>Mining Output</h2></div>
            <span className={styles.periodBtn}>7 Days</span>
          </div>
          <div className={styles.chartWrap}>
            <svg viewBox="0 0 680 220" preserveAspectRatio="none" className={styles.chartSvg} aria-label="Earnings chart">
              <defs><linearGradient id="earningsArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".22" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
              {[20, 65, 110, 155, 200].map((y) => <line key={y} x1="22" x2="658" y1={y} y2={y} className={styles.chartGrid} />)}
              <path d={`${chart} L658,198 L22,198 Z`} fill="url(#earningsArea)" className={styles.chartArea} />
              <path d={chart} className={styles.chartLine} />
            </svg>
            <div className={styles.axis}><span>09-07</span><span>09-08</span><span>09-09</span><span>09-10</span><span>09-11</span><span>09-12</span><span>09-13</span></div>
          </div>
          <div className={styles.chartMessage}><History size={18} /><div><b>Settled mining history</b><small>Live accrual is kept separate from settled payout history.</small></div></div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}><div><div className={styles.sectionKicker}>CORE STATUS</div><h2>Mining Core</h2></div><HeartPulse size={18} /></div>
          <div className={styles.coreStatus}>
            <div className={styles.coreIcon}><HeartPulse size={22} /></div>
            <div>
              <span className={styles.goldBadge}>{activeNow ? 'ACTIVE' : 'ACTION REQUIRED'}</span>
              <h3>{activeNow ? 'Mining Active' : 'Mining Paused'}</h3>
              <p>{activeNow ? 'Your activation window is active and live accrual is being visualized from the latest server snapshot.' : 'Mining is paused because the activation window has expired or the reserve is unavailable.'}</p>
            </div>
          </div>
          <div className={styles.coreStats}><div><small>ACTIVE</small><b>{num(data.active_hashrate)} H/s</b></div><div><small>EFFECTIVE</small><b>{num(data.effective_hashrate)} H/s</b></div></div>
          <button className={styles.primaryWide} onClick={() => void recharge()} disabled={recharging}><Zap size={16} />{recharging ? 'RECHARGING…' : 'Recharge & Resume'}</button>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}><div><div className={styles.sectionKicker}>RECENT ACTIVITY</div><h2>Latest Events</h2></div><Link href="/wallet/history" className={styles.viewAll}>View All <ArrowRight size={13} /></Link></div>
          <div className={styles.activityList}>
            {activity.map((row) => (
              <div className={styles.activityRow} key={row.id}>
                <span className={styles.activityIcon}><Coins size={15} /></span>
                <div><b>{clean(row.type)}</b><small>{new Date(row.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div>
                <strong>{Number(row.diamond_delta) < 0 ? '' : '+'}{num(row.diamond_delta, 0)} <em>💎</em></strong>
              </div>
            ))}
            {!activity.length ? <div className={styles.emptyActivity}>No recent activity yet.</div> : null}
          </div>
        </div>
      </section>

      <section className={styles.lowerGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><div><div className={styles.sectionKicker}>DAILY PULSE</div><h2>Check-in</h2></div><CalendarCheck2 size={18} /></div>
          <div className={styles.pulseStats}>
            <div><small>Current Streak</small><strong>{data.streak.current} <em>days</em></strong></div>
            <div><small>Best Streak</small><strong>{data.streak.best} <em>days</em></strong></div>
            <div><small>Base Check-in</small><strong>{num(data.streak.base_reward_diamond, 0)} <em>💎</em></strong></div>
          </div>
          <div className={styles.streakRail}>{data.streak.days.slice(0, 7).map((day) => <div key={day.day} className={`${styles.dayCell} ${styles[day.status]}`}><b>D{day.day}</b><span>{num(day.reward_diamond, 0)}</span></div>)}</div>
          <button className={styles.primaryWide} onClick={() => void checkIn()} disabled={checkingIn || data.streak.today_claimed}>
            <CalendarCheck2 size={16} />
            {data.streak.today_claimed ? 'CHECK-IN CLAIMED' : checkingIn ? 'CLAIMING…' : `Claim Daily Check-in${dailyClaim ? ` · ${num(dailyClaim.reward_diamond, 0)} 💎` : ''}`}
          </button>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}><div><div className={styles.sectionKicker}>SETTLEMENT CONTROL</div><h2>Mining Settlement</h2></div><ShieldCheck size={18} /></div>
          <div className={styles.coreStatus}>
            <div className={styles.coreIcon}><ShieldCheck size={22} /></div>
            <div>
              <span className={`${styles.goldBadge} ${claim?.status === 'READY' ? styles.readyBadge : ''}`}>{claim?.status ?? 'SYNCING'}</span>
              <h3>{claim?.status === 'READY' ? 'Settlement ready' : claim?.status === 'ALREADY_SETTLED' ? 'Already settled' : 'Settlement window'}</h3>
              <p>{claim?.reason ?? 'Checking the server settlement state for the selected mining asset.'}</p>
            </div>
          </div>
          <div className={styles.coreStats}>
            <div><small>ASSET</small><b>{claim?.asset ?? asset}</b></div>
            <div><small>POOL</small><b>{claim?.pool_prepared ? 'PREPARED' : 'WAITING'}</b></div>
          </div>
          <button className={styles.primaryWide} onClick={() => void settle()} disabled={claiming || claim?.status !== 'READY'}>
            {claiming ? 'SETTLING…' : claim?.status === 'READY' ? 'Claim Mining Settlement' : 'Settlement Not Ready'}
          </button>
        </div>
      </section>

      <section className={styles.bottomBanner}>
        <div><div className={styles.sectionKicker}>NEXTGEN MINER</div><h2>A STRONGER TOMORROW</h2><p>Build your miners. Strengthen your core. Grow with the network.</p></div>
        <div className={styles.bannerStats}>
          <div><b>12</b><small>Miner Families</small></div>
          <div><b>LIVE</b><small>Global Network</small></div>
          <div><b>24/7</b><small>Server Operations</small></div>
          <div><b>LIVE</b><small>Platform Data</small></div>
        </div>
      </section>

      <div className={styles.mobileHint}><Bell size={14} /> Home is synchronized every 15 seconds from the production snapshot.</div>
    </div>
  );
}
