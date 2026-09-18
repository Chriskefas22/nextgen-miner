'use client';

import Link from 'next/link';
import { ArrowRight, Boxes, ChevronUp, Gauge, GitMerge, LockKeyhole, PackageOpen, RefreshCw, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import styles from './RoomsPage.module.css';

type Slot = {
  slot_index: number;
  user_miner_id: number;
  name: string;
  slug: string;
  tier: string;
  level: number;
  hashrate: number;
  power_watts: number;
  status: string;
  deployment_state: 'inventory' | 'deployed';
  recharge_expires_at: string | null;
  image_path: string | null;
};

type Room = {
  id: number;
  room_number: number;
  name: string;
  room_level: number;
  room_label: string;
  capacity_slots: number;
  used_slots: number;
  empty_slots: number;
  active_miners: number;
  hashrate: number;
  power_watts: number;
  total_spent_diamond: number;
  upgrade: { available: boolean; next_level: number | null; next_capacity_slots: number | null; price_diamond: number; label: string };
  slots: Slot[];
};

type RoomsSnapshot = {
  room_count: number;
  max_rooms: number;
  next_room_number: number | null;
  next_room_unlock_price_diamond: number;
  rooms: Room[];
};

const num = (value: number, digits = 0) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });

function imagePath(path: string | null, slug: string) {
  if (!path) return `/assets/miners/${slug}.webp`;
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('assets/')) return `/${clean}`;
  if (clean.startsWith('miners/')) return `/assets/${clean}`;
  return `/assets/miners/${slug}.webp`;
}

export default function RoomsPage() {
  const [data, setData] = useState<RoomsSnapshot | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'create' | number | string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error('Please sign in to manage your Rooms.');
      const [roomsResult, walletResult] = await Promise.all([
        sb.rpc('nextgen_rooms_snapshot'),
        sb.from('nextgen_wallets').select('diamond_balance').eq('user_id', user.id).maybeSingle(),
      ]);
      if (roomsResult.error) throw roomsResult.error;
      if (walletResult.error) throw walletResult.error;
      setData(roomsResult.data as RoomsSnapshot);
      setBalance(Number(walletResult.data?.diamond_balance ?? 0));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load Rooms.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createRoom() {
    setBusy('create'); setMessage('');
    try {
      const result = await createClient().rpc('nextgen_create_room');
      if (result.error) throw result.error;
      setMessage(`Room ${String(result.data?.room_number ?? '').padStart(2, '0')} unlocked.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Room unlock failed.'); }
    finally { setBusy(null); }
  }

  async function upgradeRoom(room: Room) {
    setBusy(room.id); setMessage('');
    try {
      const result = await createClient().rpc('nextgen_upgrade_room', { p_room_id: room.id });
      if (result.error) throw result.error;
      setMessage(`${room.name} upgraded to Level ${result.data?.to_level ?? room.room_level + 1}.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Room upgrade failed.'); }
    finally { setBusy(null); }
  }

  async function autoMerge(room: Room) {
    setBusy(`merge:${room.id}`); setMessage('');
    try {
      const result = await createClient().rpc('nextgen_merge_all_ready', { p_room_id: room.id });
      if (result.error) throw result.error;
      setMessage(result.data?.merged_count ? `${result.data.merged_count} merge${result.data.merged_count === 1 ? '' : 's'} completed in ${room.name}.` : 'No ready pairs in this Room.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Auto merge failed.'); }
    finally { setBusy(null); }
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.hero}>
          <div>
            <div className={styles.kicker}>ROOMS / RACK CONTROL</div>
            <h1 className={styles.title}>Mining Rooms</h1>
            <p>Your Rooms are the workspace between Inventory and Farm. Deploy miners here, monitor capacity, and merge compatible miners without leaving the same Room.</p>
          </div>
          <div className={styles.heroStats}>
            <div><span>ROOMS</span><b>{data?.room_count ?? 0}/{data?.max_rooms ?? 5}</b></div>
            <div><span>DIAMOND</span><b>{num(balance)}</b></div>
          </div>
        </section>

        {message ? <section className={styles.message}>{message}</section> : null}

        {loading ? <section className={styles.panel}>SYNCING ROOM GRID…</section> : null}

        {!loading && data ? (
          <>
            <section className={styles.expansionPanel}>
              <div>
                <div className={styles.kicker}>ROOM EXPANSION</div>
                <h2>Grow from 1 Room to a maximum of 5 Rooms</h2>
                <p>Every Room starts at Level 1 with 12 slots. Upgrade the same Room through Levels 2–5 to expand its capacity, or unlock another Room when your fleet outgrows the current workspace.</p>
              </div>
              {data.next_room_number ? (
                <button type="button" className={styles.primaryBtn} disabled={busy === 'create' || balance < data.next_room_unlock_price_diamond} onClick={() => void createRoom()}>
                  <LockKeyhole size={15} />
                  {busy === 'create' ? 'UNLOCKING…' : `UNLOCK ROOM ${String(data.next_room_number).padStart(2, '0')} · 💎 ${num(data.next_room_unlock_price_diamond)}`}
                </button>
              ) : <div className={styles.maxBadge}>MAX 5 ROOMS UNLOCKED</div>}
            </section>

            <section className={styles.tierRail}>
              {[{l:1,s:12,p:0},{l:2,s:24,p:20000},{l:3,s:48,p:60000},{l:4,s:72,p:180000},{l:5,s:120,p:500000}].map((tier) => (
                <div key={tier.l} className={styles.tierCard}>
                  <span>LEVEL {tier.l}</span><b>{tier.s} SLOTS</b><small>{tier.l === 5 ? 'MAX' : `Upgrade · 💎 ${num(tier.p)}`}</small>
                </div>
              ))}
            </section>

            {data.rooms.map((room) => {
              const loadPct = Math.min(100, (room.used_slots / Math.max(room.capacity_slots, 1)) * 100);
              const slots = Array.from({ length: room.capacity_slots }, (_, index) => room.slots.find((slot) => slot.slot_index === index + 1) ?? null);
              return (
                <section key={room.id} className={styles.panel}>
                  <div className={styles.roomHead}>
                    <div>
                      <div className={styles.kicker}>ROOM {String(room.room_number).padStart(2, '0')}</div>
                      <h2>{room.name}</h2>
                      <span className={styles.subline}>{room.room_label} · Level {room.room_level}</span>
                    </div>
                    <div className={styles.roomActions}>
                      <Link href="/items" className={styles.secondaryBtn}><PackageOpen size={14} /> Inventory</Link>
                      <button type="button" className={styles.secondaryBtn} disabled={busy === `merge:${room.id}`} onClick={() => void autoMerge(room)}><GitMerge size={14} /> {busy === `merge:${room.id}` ? 'MERGING…' : 'AUTO MERGE ALL'}</button>
                      {room.upgrade.available ? <button type="button" className={styles.primaryBtn} disabled={busy === room.id || balance < room.upgrade.price_diamond} onClick={() => void upgradeRoom(room)}><ChevronUp size={14} /> {busy === room.id ? 'UPGRADING…' : `UPGRADE · 💎 ${num(room.upgrade.price_diamond)}`}</button> : <span className={styles.maxBadge}>MAX LEVEL</span>}
                    </div>
                  </div>

                  <div className={styles.metrics}>
                    <div><span>CAPACITY</span><b>{room.used_slots}/{room.capacity_slots}</b></div>
                    <div><span>LOAD</span><b>{loadPct.toFixed(0)}%</b></div>
                    <div><span>ACTIVE</span><b>{room.active_miners}</b></div>
                    <div><span>HASHRATE</span><b>{num(room.hashrate)} H/s</b></div>
                    <div><span>POWER</span><b>{num(room.power_watts)} W</b></div>
                  </div>
                  <div className={styles.progress}><span style={{ width: `${loadPct}%` }} /></div>

                  <div className={styles.rackGrid} style={{ '--rack-columns': room.capacity_slots >= 72 ? 10 : room.capacity_slots >= 48 ? 8 : room.capacity_slots >= 24 ? 6 : 4 } as React.CSSProperties}>
                    {slots.map((slot, index) => slot ? (
                      <div key={slot.slot_index} className={`${styles.slot} ${slot.status === 'active' ? styles.slotActive : ''}`} title={`${slot.name} Lv${slot.level} · ${slot.hashrate} H/s`}>
                        <img src={imagePath(slot.image_path, slot.slug)} alt="" />
                        <b>{slot.level}</b>
                        <small>#{String(index + 1).padStart(2, '0')}</small>
                        {slot.status !== 'active' ? <em>PAUSED</em> : <em>{num(slot.hashrate)} H/s</em>}
                      </div>
                    ) : (
                      <div key={`empty-${index}`} className={`${styles.slot} ${styles.slotEmpty}`}>
                        <span>+</span><small>#{String(index + 1).padStart(2, '0')}</small><em>EMPTY</em>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        ) : null}

        {!loading && data?.room_count === 0 ? <section className={styles.panel}><div className={styles.empty}>No Rooms found. The production seed normally creates Room 01 for an account before miners are deployed.</div></section> : null}

        <section className={styles.footerGrid}>
          <div><Gauge size={17}/><b>Workspace capacity</b><span>Room space controls where miners can be deployed. Economic capacity remains server-enforced.</span></div>
          <div><GitMerge size={17}/><b>Same-room merge</b><span>Two identical miners at the same level must share a Room before they can merge.</span></div>
          <div><Zap size={17}/><b>Mining activation</b><span>Deploying a miner starts its server-controlled 24h mining activation window.</span></div>
        </section>

        <button type="button" className={styles.refresh} onClick={() => void load()} disabled={loading}><RefreshCw size={13}/> Refresh Rooms</button>
      </div>
    </AppShell>
  );
}
