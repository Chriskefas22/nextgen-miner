'use client';

import Link from 'next/link';
import {
  Activity, ArrowRight, Bell, CalendarCheck2, ChevronRight, Coins, Cuboid, Gauge, HeartPulse, History, RefreshCw, ShieldCheck, Sparkles,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './HomeCommandCenter.module.css';
import { HolographicEarth } from './HolographicEarth';

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
const num = (v: number | string | null | undefined, digits = 2) => Number(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: digits });
const money = (v: number | string | null | undefined, digits = 2) => Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const crypto = (v: number | string | null | undefined) => Number(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: 12 });
const clean = (v: string) => v.replaceAll('_', ' ');

function CryptoLogo({ asset }: { asset: string }) {
  const a = asset.toUpperCase();
  const common = { width: 22, height: 22, viewBox: '0 0 32 32', 'aria-hidden': true } as const;
  if (a === 'BTC') return <svg {...common}><circle cx="16" cy="16" r="13" fill="#f7931a"/><path d="M18.8 8.1c2.5.6 3.7 2.1 3.4 4-.2 1.2-1 2.1-2.2 2.7 2.2.7 3.2 2.1 2.9 4-.5 3-3.3 4.2-7.4 3.6l-.3 2.3-1.9-.2.3-2.4-1.6-.2-.3 2.4-1.9-.2.3-2.4-1.5-.2.2-1.8 1.1.1c.5.1.8-.2.9-.8l1.1-7.2c.1-.6-.1-.9-.7-1l-1.1-.1.3-1.8 1.5.2.4-2.5 1.9.3-.4 2.4 1.6.2.4-2.4 1.9.3-.3 2.2Zm-5.1 8.1-.5 3.1c2.6.4 4.3 0 4.5-1.4.2-1.3-1-1.9-4-2.3Zm.7-4.8-.4 2.7c2.4.3 3.8-.1 4-1.4.2-1.2-1-1.7-3.6-2Z" fill="#fff"/></svg>;
  if (a === 'ETH') return <svg {...common}><circle cx="16" cy="16" r="13" fill="#627eea"/><path d="m16 5.5 7 11-7 4-7-4 7-11Z" fill="#d9ddff"/><path d="m16 5.5-7 11 7-3.1V5.5Z" fill="#fff"/><path d="m16 21.8 7-5.3-7 10-7-10 7 5.3Z" fill="#c1c8ff"/></svg>;
  if (a === 'USDT') return <svg {...common}><circle cx="16" cy="16" r="13" fill="#26a17b"/><path d="M8 9h16v3h-6v11h-4V12H8V9Zm2 6.5c1.7 1.1 4 1.7 6 1.7s4.3-.6 6-1.7v2c-1.7 1-3.8 1.5-6 1.5s-4.3-.5-6-1.5v-2Z" fill="#fff"/></svg>;
  if (a === 'BNB') return <svg {...common}><circle cx="16" cy="16" r="13" fill="#f3ba2f"/><path d="m16 7 2.5 2.5-2.5 2.5-2.5-2.5L16 7Zm-5 5 2.5 2.5L11 17l-2.5-2.5L11 12Zm10 0 2.5 2.5L21 17l-2.5-2.5L21 12Zm-5 5 2.5 2.5-2.5 2.5-2.5-2.5L16 17Zm0-5 4 4-4 4-4-4 4-4Z" fill="#fff"/></svg>;
  if (a === 'DOGE') return <svg {...common}><circle cx="16" cy="16" r="13" fill="#c2a633"/><path d="M10 8h6.2c4.1 0 6.7 3.1 6.7 8s-2.6 8-6.7 8H10v-6.5H8.5v-2.5H10V8Zm4 3.5v9h2c2 0 3-1.5 3-4.5s-1-4.5-3-4.5h-2Z" fill="#fff"/></svg>;
  if (a === 'BCH') return <svg {...common}><circle cx="16" cy="16" r="13" fill="#0ac18e"/><path d="M11 8h5.2c2.9 0 4.6 1.5 4.6 3.6 0 1.4-.7 2.5-1.9 3.1 1.5.5 2.4 1.6 2.4 3.2 0 2.6-2.1 4.1-5 4.1H11V8Zm3 2.7v3h2.1c1.1 0 1.8-.5 1.8-1.5s-.7-1.5-1.8-1.5H14Zm0 5.5v3.1h2.4c1.2 0 2-.5 2-1.5s-.8-1.6-2-1.6H14Z" fill="#fff"/></svg>;
  if (a === 'DASH') return <svg {...common}><circle cx="16" cy="16" r="13" fill="#008de4"/><path d="M9 11h10.5c1.6 0 2.8 1 2.8 2.4 0 1.2-.8 2.2-2 2.5 1.2.3 2 1.3 2 2.6 0 1.5-1.2 2.5-2.8 2.5H9l1-3h9.1c.4 0 .7-.3.7-.7s-.3-.7-.7-.7h-8.5l1-3h7.8c.4 0 .7-.3.7-.7s-.3-.7-.7-.7H9.8L9 11Z" fill="#fff"/></svg>;
  if (a === 'DGB') return <svg {...common}><circle cx="16" cy="16" r="13" fill="#006ad4"/><path d="M10 9h6.5c3.5 0 5.5 2.3 5.5 7s-2 7-5.5 7H10V9Zm3.5 3.2v7.6h2.7c1.7 0 2.7-1.1 2.7-3.8s-1-3.8-2.7-3.8h-2.7Z" fill="#fff"/></svg>;
  if (a === 'FEY') return <svg {...common}><circle cx="16" cy="16" r="13" fill="#6c63ff"/><path d="M9 9h13v3.2h-8.8v2.2h7.2v3h-7.2V23H9V9Z" fill="#fff"/></svg>;
  return <svg {...common}><circle cx="16" cy="16" r="13" fill="url(#coinGradient)"/><defs><linearGradient id="coinGradient" x1="4" y1="4" x2="28" y2="28"><stop stopColor="#55f4c5"/><stop offset="1" stopColor="#0c7a7a"/></linearGradient></defs><text x="16" y="21" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800">{a.slice(0,1)}</text></svg>;
}

function actionError(e: unknown) { if (e && typeof e === 'object' && 'message' in e) return String((e as { message?: unknown }).message ?? 'Action failed'); return e instanceof Error ? e.message : 'Action failed'; }
function sparkPath(values: number[]) {
  const width = 680, height = 220, pad = 22;
  const max = Math.max(...values, 0.0000001), min = Math.min(...values, 0), span = Math.max(max - min, 0.0000001);
  return values.map((v, i) => { const x = pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2); const y = height - pad - ((v - min) / span) * (height - pad * 2); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
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

  const load = useCallback(async (nextAsset = asset, silent = false) => {
    const sb = createClient();
    if (!silent) setLoading(true);
    try {
      const [a, c] = await Promise.all([
        sb.rpc('nextgen_farm_snapshot', { p_asset: nextAsset }),
        sb.rpc('nextgen_farm_claim_status', { p_asset: nextAsset }),
      ]);
      if (a.error) throw a.error;
      if (c.error) throw c.error;
      setData(a.data as HomeSnapshot);
      setClaim(c.data as ClaimStatus);
      setAsset(nextAsset);
    } catch (e) { setMessage(actionError(e)); }
    finally { if (!silent) setLoading(false); }
  }, [asset]);

  useEffect(() => { void load(asset, true); const t = window.setInterval(() => void load(asset, true), 15000); return () => window.clearInterval(t); }, [asset, load]);
  useEffect(() => { const t = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  const historyValues = useMemo(() => data.earnings_history.map((x) => Number(x.allocated_usd ?? 0)), [data.earnings_history]);
  const chart = useMemo(() => sparkPath(historyValues.length ? historyValues : [0, 0, 0, 0, 0, 0, 0]), [historyValues]);
  const activeNow = ['ACTIVE', 'ACTIVE_GUARDED', 'ACTIVE_POOL'].includes(data.live_earnings.status) && (!data.live_earnings.recharge_expires_at || clock < new Date(data.live_earnings.recharge_expires_at).getTime());
  const snapshotMs = new Date(data.live_earnings.as_of ?? new Date().toISOString()).getTime();
  const elapsedSeconds = Math.max(0, (clock - snapshotMs) / 1000);
  const maxLiveSeconds = data.live_earnings.recharge_expires_at ? Math.max(0, (new Date(data.live_earnings.recharge_expires_at).getTime() - clock) / 1000) : elapsedSeconds;
  const cryptoUsd = Math.max(Number(data.live_earnings.crypto_rate_usd ?? 1), 0.0000001);
  const perSecond = Number(data.live_earnings.reward_rate_usd_per_hash_second ?? 0) * Number(data.effective_hashrate ?? 0) / cryptoUsd;
  const liveDisplay = activeNow ? Number(data.live_earnings.estimated_crypto ?? 0) + Math.min(elapsedSeconds, maxLiveSeconds) * Math.max(perSecond, 0) : Number(data.live_earnings.estimated_crypto ?? 0);
  const selected = data.crypto_options.find((x) => x.asset === asset) ?? data.selected_asset;
  const visibleAssets = useMemo(() => { const ordered = [selected, ...data.crypto_options.filter((x) => x.asset !== selected.asset)]; return ordered.slice(0, 8); }, [data.crypto_options, selected]);
  const liveRate = Number(selected.rate_usd ?? 0);
  const rawCoverage = Number(data.live_earnings.starter_coverage_days ?? 0);
  const coverageLabel = Number.isFinite(rawCoverage) && rawCoverage > 0 && rawCoverage < 100000 ? `${num(rawCoverage, 1)} days` : 'Capacity guarded';
  const dailyClaim = data.streak.days.find((d) => d.status === 'ready');
  const activity = data.recent_transactions.slice(0, 4);

  async function settle() { if (claim?.status !== 'READY' || claiming) return; setClaiming(true); setMessage(''); try { const r = await createClient().rpc('nextgen_claim_mining', { p_asset: asset }); if (r.error) throw r.error; setMessage(r.data?.settled ? `Settlement ${r.data?.payout_id ? `#${r.data.payout_id} ` : ''}posted successfully.` : String(r.data?.reason ?? 'No settlement was available.')); await load(asset, true); } catch (e) { setMessage(actionError(e)); } finally { setClaiming(false); } }
  async function checkIn() { if (checkingIn || data.streak.today_claimed) return; setCheckingIn(true); setMessage(''); try { const r = await createClient().rpc('nextgen_claim_daily_checkin'); if (r.error) throw r.error; setMessage(`Daily check-in claimed: ${num(r.data?.diamond_awarded, 0)} 💎.`); await load(asset, true); } catch (e) { setMessage(actionError(e)); } finally { setCheckingIn(false); } }
  async function recharge() { if (recharging) return; setRecharging(true); setMessage(''); try { const r = await createClient().rpc('nextgen_recharge_hashrate'); if (r.error) throw r.error; setMessage('Mining recharged for 24h.'); await load(asset, true); } catch (e) { setMessage(actionError(e)); } finally { setRecharging(false); } }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.heroKicker}>WELCOME BACK</div>
          <div className={styles.heroTitle}>YOUR <span>MINING CORE</span></div>
          <p>Recharge your starter reserve to resume mining.<br className={styles.desktopOnly} /> Choose your asset, stay active and grow your earnings.</p>
          <div className={`${styles.pausePill} ${activeNow ? styles.activePill : ''}`}><span className={styles.pulseDot} />{activeNow ? 'MINING ACTIVE' : 'PAUSED · ACTION NEEDED'}</div>
          <div className={styles.heroActions}>
            <button className={styles.primaryBtn} onClick={() => void recharge()} disabled={recharging}><Zap size={17} />{recharging ? 'RECHARGING…' : activeNow ? 'RECHARGE 24H' : 'RECHARGE & RESUME'}<ChevronRight size={17} /></button>
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
          }} />
        </div>
      </section>

      {message ? <section className={styles.notice}><ShieldCheck size={16} />{message}</section> : null}

      <section className={styles.statsRow}>
        <div className={styles.statCard}><span><Zap size={16} />ACTIVE HASHRATE</span><strong>{num(data.active_hashrate)} <em>H/s</em></strong><small>+0%</small></div>
        <div className={styles.statCard}><span><Coins size={16} />MINING OUTPUT (TODAY)</span><strong>${money(data.live_earnings.daily_usd)}</strong><small>{money(data.live_earnings.estimated_crypto)} {asset}</small></div>
        <div className={styles.statCard}><span><Cuboid size={16} />ACTIVE MINERS</span><strong>{data.active_miners}</strong><Link href="/miners">View All <ArrowRight size={13} /></Link></div>
        <div className={styles.statCard}><span><Sparkles size={16} />DIAMOND BALANCE</span><strong>{num(data.diamond_balance, 0)}</strong><small>Internal Utility</small></div>
      </section>

      <section className={styles.assetPanel}>
        <div className={styles.panelHeader}>
          <div><div className={styles.sectionKicker}>MINING OUTPUT</div><h2>Select Mining Asset</h2><p>Choose the cryptocurrency you want to mine. You can change anytime.</p></div>
          <span className={styles.liveRates}><i /> Live Rates <RefreshCw size={13} /></span>
        </div>
        <div className={styles.assetRail}>
          {visibleAssets.map((opt) => { const active = opt.asset === asset; return <button key={opt.asset} type="button" className={`${styles.assetButton} ${active ? styles.assetSelected : ''}`} onClick={() => void load(opt.asset)} disabled={loading && active}><span className={styles.assetIcon}><CryptoLogo asset={opt.asset} /></span><b>{opt.asset}</b><small>{opt.display_name}</small></button>; })}
          <Link href="/more" className={styles.assetButton}><span className={styles.assetIcon}>+</span><b>More</b><small>Assets</small></Link>
        </div>
        <div className={styles.assetSelectedBar}><div><span>Selected:</span> {selected.display_name}</div><div><span>Live Rate:</span> ${liveRate ? num(liveRate, 8) : '—'}</div><span className={styles.activeBadge}>{selected.status === 'ACTIVE' ? 'ACTIVE' : clean(selected.status)}</span><button className={styles.changeAsset} onClick={() => void load(asset)} disabled={loading}><RefreshCw size={15} />Refresh Rate</button></div>
      </section>

      <section className={styles.threeCol}>
        <div className={`${styles.panel} ${styles.earningsPanel}`}>
          <div className={styles.panelHeader}><div><div className={styles.sectionKicker}>EARNINGS SIGNAL</div><h2>Mining Output</h2></div><span className={styles.periodBtn} aria-label="Earnings period">7 Days</span></div>
          <div className={styles.chartWrap}><svg viewBox="0 0 680 220" preserveAspectRatio="none" className={styles.chartSvg} aria-label="Earnings chart"><defs><linearGradient id="earningsArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".22" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>{[20,65,110,155,200].map((y) => <line key={y} x1="22" x2="658" y1={y} y2={y} className={styles.chartGrid} />)}<path d={`${chart} L658,198 L22,198 Z`} fill="url(#earningsArea)" className={styles.chartArea} /><path d={chart} className={styles.chartLine} /></svg><div className={styles.axis}><span>09-07</span><span>09-08</span><span>09-09</span><span>09-10</span><span>09-11</span><span>09-12</span><span>09-13</span></div></div>
          <div className={styles.chartMessage}><History size={18} /><div><b>No settled mining payout yet.</b><small>Live accrual remains separate from settled history.</small></div></div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}><div><div className={styles.sectionKicker}>CORE STATUS</div><h2>Mining Core</h2></div><HeartPulse size={18} /></div>
          <div className={styles.coreStatus}><div className={styles.coreIcon}><HeartPulse size={22} /></div><div><span className={styles.goldBadge}>{activeNow ? 'ACTIVE' : 'ACTION REQUIRED'}</span><h3>{activeNow ? 'Mining Active' : 'Mining Paused'}</h3><p>{activeNow ? 'Your 24h activation window is active and live accrual is being visualized from the latest server snapshot.' : 'Mining is paused because the 24h activation window has expired or the starter reserve is unavailable.'}</p></div></div>
          <div className={styles.coreStats}><div><small>ACTIVE</small><b>{num(data.active_hashrate)} H/s</b></div><div><small>EFFECTIVE</small><b>{num(data.effective_hashrate)} H/s</b></div></div>
          <button className={styles.primaryWide} onClick={() => void recharge()} disabled={recharging}><Zap size={16} />{recharging ? 'RECHARGING…' : 'Recharge & Resume'}</button>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}><div><div className={styles.sectionKicker}>RECENT ACTIVITY</div><h2>Latest Events</h2></div><Link href="/wallet/history" className={styles.viewAll}>View All <ArrowRight size={13} /></Link></div>
          <div className={styles.activityList}>{activity.map((row) => <div className={styles.activityRow} key={row.id}><span className={styles.activityIcon}><Coins size={15} /></span><div><b>{clean(row.type)}</b><small>{new Date(row.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div><strong>{Number(row.diamond_delta) < 0 ? '' : '+'}{num(row.diamond_delta, 0)} <em>💎</em></strong></div>)}{!activity.length ? <div className={styles.emptyActivity}>No recent activity yet.</div> : null}</div>
        </div>
      </section>

      <section className={styles.lowerGrid}>
        <div className={styles.panel}><div className={styles.panelHeader}><div><div className={styles.sectionKicker}>DAILY PULSE</div><h2>Check-in</h2></div><CalendarCheck2 size={18} /></div><div className={styles.pulseStats}><div><small>Current Streak</small><strong>{data.streak.current} <em>days</em></strong></div><div><small>Best Streak</small><strong>{data.streak.best} <em>days</em></strong></div><div><small>Base Check-in</small><strong>{num(data.streak.base_reward_diamond, 0)} <em>💎</em></strong></div></div><div className={styles.streakRail}>{data.streak.days.slice(0, 7).map((day) => <div key={day.day} className={`${styles.dayCell} ${styles[day.status]}`}><b>D{day.day}</b><span>{num(day.reward_diamond, 0)}</span></div>)}</div><button className={styles.primaryWide} onClick={() => void checkIn()} disabled={checkingIn || data.streak.today_claimed}><CalendarCheck2 size={16} />{data.streak.today_claimed ? 'CHECK-IN CLAIMED' : checkingIn ? 'CLAIMING…' : `Claim Daily Check-in${dailyClaim ? ` · ${num(dailyClaim.reward_diamond, 0)} 💎` : ''}`}</button></div>
        <div className={styles.panel}><div className={styles.panelHeader}><div><div className={styles.sectionKicker}>LIVE EARNINGS</div><h2>Current Accrual</h2></div><Gauge size={18} /></div><div className={styles.accrualValue}>{crypto(liveDisplay)} <span>{asset}</span></div><p className={styles.muted}>${money(data.live_earnings.estimated_usd)} USD server snapshot · {activeNow ? 'live visualization active' : 'paused'}</p><div className={styles.accrualGrid}><div><small>PER HOUR</small><b>${money(data.live_earnings.hourly_usd)}</b></div><div><small>TODAY</small><b>${money(data.live_earnings.daily_usd)}</b></div><div><small>30D EST.</small><b>${money(data.live_earnings.thirty_day_usd)}</b></div></div><div className={styles.capacityLine}><span>Capacity multiplier</span><b>{Number(data.live_earnings.capacity_multiplier ?? 1).toFixed(4)}×</b></div><div className={styles.capacityLine}><span>Starter coverage</span><b>{coverageLabel}</b></div></div>
      </section>

      <section className={styles.bottomBanner}><div><div className={styles.sectionKicker}>NEXTGEN MINER</div><h2>A STRONGER TOMORROW</h2><p>Build your miners. Strengthen your core. Grow with the network.</p></div><div className={styles.bannerStats}><div><b>12</b><small>Miner Families</small></div><div><b>LIVE</b><small>Global Network</small></div><div><b>24/7</b><small>Server Operations</small></div><div><b>LIVE</b><small>Platform Data</small></div></div></section>
      <div className={styles.mobileHint}><Bell size={14} /> Home is synchronized every 15 seconds from the production snapshot.</div>
    </div>
  );
}
