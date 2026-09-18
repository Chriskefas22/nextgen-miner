'use client';

import Link from 'next/link';
import { ArrowRight, Boxes, CheckCircle2, GitMerge, PackageOpen, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import './inventory.css';

type UserMiner = {
  id: number;
  miner_id: number;
  current_level: number;
  status: string;
  is_merged: boolean;
  deployment_state: 'inventory' | 'deployed';
  recharge_expires_at: string | null;
};

type Catalog = {
  id: number;
  slug: string;
  name: string;
  tier: string;
  base_hashrate: number;
  base_power_watts: number;
  image_path: string | null;
};

type Level = { miner_id: number; level: number; hashrate: number };

type RoomSlot = {
  room_id: number;
  slot_index: number;
  user_miner_id: number;
  name: string;
  room_number: number;
};

type Room = { id: number; room_number: number; name: string; room_level: number; capacity_slots: number; slots: RoomSlot[] };

type InventoryItem = UserMiner & {
  name: string;
  slug: string;
  tier: string;
  image_path: string | null;
  hashrate: number;
  power_watts: number;
  roomId: number | null;
  roomNumber: number | null;
  slotIndex: number | null;
  mergeReady: boolean;
};

type Filter = 'ALL' | 'READY' | 'DEPLOYED' | 'MERGE READY';

const num = (value: number, digits = 2) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });

function imagePath(path: string | null, slug: string) {
  if (!path) return `/assets/miners/${slug}.webp`;
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('assets/')) return `/${clean}`;
  if (clean.startsWith('miners/')) return `/assets/${clean}`;
  return `/assets/miners/${slug}.webp`;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error('Please sign in to access your inventory.');

      const [u, c, l, r] = await Promise.all([
        sb.from('nextgen_user_miners')
          .select('id,miner_id,current_level,status,is_merged,deployment_state,recharge_expires_at')
          .eq('user_id', user.id)
          .eq('is_merged', false)
          .order('activated_at', { ascending: true }),
        sb.from('nextgen_miner_catalog')
          .select('id,slug,name,tier,base_hashrate,base_power_watts,image_path')
          .eq('enabled', true),
        sb.from('nextgen_miner_levels').select('miner_id,level,hashrate'),
        sb.rpc('nextgen_rooms_snapshot'),
      ]);
      if (u.error) throw u.error;
      if (c.error) throw c.error;
      if (l.error) throw l.error;
      if (r.error) throw r.error;

      const catalog = new Map<number, Catalog>((c.data ?? []).map((x) => [Number(x.id), x as Catalog]));
      const levels = new Map<string, number>((l.data ?? []).map((x) => [
        `${Number(x.miner_id)}:${Number(x.level)}`,
        Number(x.hashrate ?? 0),
      ]));
      const roomPayload = (r.data ?? {}) as { rooms?: Room[] };
      const nextRooms = Array.isArray(roomPayload.rooms) ? roomPayload.rooms : [];
      const slotByMiner = new Map<number, { roomId: number; roomNumber: number; slotIndex: number }>();
      for (const room of nextRooms) {
        for (const slot of room.slots ?? []) {
          slotByMiner.set(Number(slot.user_miner_id), {
            roomId: Number(room.id),
            roomNumber: Number(room.room_number),
            slotIndex: Number(slot.slot_index),
          });
        }
      }

      const raw = (u.data ?? []) as unknown as UserMiner[];
      const pairs = new Map<string, number>();
      for (const row of raw) {
        const slot = slotByMiner.get(Number(row.id));
        if (!slot || row.deployment_state !== 'deployed') continue;
        const key = `${slot.roomId}:${row.miner_id}:${row.current_level}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }

      const nextItems: InventoryItem[] = raw.map((row) => {
        const cat = catalog.get(Number(row.miner_id));
        const level = Number(row.current_level);
        const hashrate = Number(levels.get(`${Number(row.miner_id)}:${level}`) ?? cat?.base_hashrate ?? 0);
        const power = Math.round((Number(cat?.base_power_watts ?? 0) * hashrate) / Math.max(Number(cat?.base_hashrate ?? hashrate), 1));
        const slot = slotByMiner.get(Number(row.id));
        const mergeReady = Boolean(slot && row.deployment_state === 'deployed' && (pairs.get(`${slot.roomId}:${row.miner_id}:${level}`) ?? 0) >= 2 && level < 10);
        return {
          ...row,
          id: Number(row.id),
          miner_id: Number(row.miner_id),
          current_level: level,
          deployment_state: row.deployment_state === 'deployed' ? 'deployed' : 'inventory',
          status: String(row.status),
          is_merged: Boolean(row.is_merged),
          name: cat?.name ?? `Miner #${row.miner_id}`,
          slug: cat?.slug ?? 'miner',
          tier: cat?.tier ?? '',
          image_path: cat?.image_path ?? null,
          hashrate,
          power_watts: power,
          roomId: slot?.roomId ?? null,
          roomNumber: slot?.roomNumber ?? null,
          slotIndex: slot?.slotIndex ?? null,
          mergeReady,
        };
      });

      setItems(nextItems);
      setRooms(nextRooms);
      setSelectedRoom((previous) => {
        const next = { ...previous };
        for (const room of nextRooms) next[room.id] ??= room.id;
        return next;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    all: items.length,
    ready: items.filter((x) => x.deployment_state === 'inventory').length,
    deployed: items.filter((x) => x.deployment_state === 'deployed').length,
    merge: items.filter((x) => x.mergeReady).length,
  }), [items]);

  const filtered = useMemo(() => items.filter((item) => {
    if (filter === 'READY') return item.deployment_state === 'inventory';
    if (filter === 'DEPLOYED') return item.deployment_state === 'deployed';
    if (filter === 'MERGE READY') return item.mergeReady;
    return true;
  }), [items, filter]);

  async function deploy(item: InventoryItem) {
    const roomId = selectedRoom[item.id];
    if (!roomId) return;
    setBusyId(item.id); setMessage('');
    try {
      const result = await createClient().rpc('nextgen_deploy_miner', { p_user_miner_id: item.id, p_room_id: roomId });
      if (result.error) throw result.error;
      setMessage(`${item.name} deployed to Room ${result.data?.room_number ?? '01'}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deploy failed.');
    } finally { setBusyId(null); }
  }

  async function returnToInventory(item: InventoryItem) {
    setBusyId(item.id); setMessage('');
    try {
      const result = await createClient().rpc('nextgen_return_miner_to_inventory', { p_user_miner_id: item.id });
      if (result.error) throw result.error;
      setMessage(`${item.name} returned to Inventory.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Return failed.');
    } finally { setBusyId(null); }
  }

  return (
    <AppShell>
      <div className="inventory-page">
        <section className="inventory-hero">
          <div>
            <div className="inventory-kicker">MINER MANAGEMENT</div>
            <h1>Inventory</h1>
            <p>Every purchased miner arrives here first. Deploy it into a Room to start mining and make it eligible for same-room merging.</p>
          </div>
          <div className="inventory-hero-actions">
            <Link href="/miners" className="inventory-btn ghost"><PackageOpen size={16} /> Shop</Link>
            <Link href="/rooms" className="inventory-btn primary"><Boxes size={16} /> Rooms</Link>
          </div>
        </section>

        {message ? <section className="inventory-message">{message}</section> : null}

        <section className="inventory-summary">
          <div><span>TOTAL</span><b>{counts.all}</b><small>owned miners</small></div>
          <div><span>READY</span><b>{counts.ready}</b><small>waiting in inventory</small></div>
          <div><span>DEPLOYED</span><b>{counts.deployed}</b><small>installed in rooms</small></div>
          <div><span>MERGE READY</span><b>{counts.merge}</b><small>same-room pairs</small></div>
        </section>

        <div className="inventory-toolbar">
          <div className="inventory-filters">
            {(['ALL','READY','DEPLOYED','MERGE READY'] as Filter[]).map((value) => (
              <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>
            ))}
          </div>
          <button type="button" className="inventory-btn ghost" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button>
        </div>

        {loading ? (
          <section className="inventory-empty"><div className="inventory-kicker">DATABASE SYNC</div><h2>Loading inventory…</h2></section>
        ) : filtered.length === 0 ? (
          <section className="inventory-empty">
            <CheckCircle2 size={34} />
            <h2>{items.length ? 'No miners match this filter' : 'Inventory Empty'}</h2>
            <p>{items.length ? 'Try another filter.' : 'Visit the Shop to buy a miner. Purchased miners will appear here before deployment.'}</p>
            {!items.length ? <Link href="/miners" className="inventory-btn primary"><PackageOpen size={15} /> Visit Shop</Link> : null}
          </section>
        ) : (
          <div className="inventory-grid">
            {filtered.map((item) => (
              <article key={item.id} className={`inventory-card ${item.mergeReady ? 'merge-ready' : ''}`}>
                <div className="inventory-art">
                  <img src={imagePath(item.image_path, item.slug)} alt={`${item.name} virtual miner`} />
                  <span className="inventory-tier">{item.tier}</span>
                  <span className={`inventory-state ${item.deployment_state}`}>{item.deployment_state === 'deployed' ? 'DEPLOYED' : 'IN INVENTORY'}</span>
                  {item.mergeReady ? <span className="inventory-merge">MERGE READY</span> : null}
                </div>
                <div className="inventory-copy">
                  <div className="inventory-title"><h3>{item.name}</h3><span>Lv {item.current_level}/10</span></div>
                  <div className="inventory-stats">
                    <div><small>HASHRATE</small><b>{num(item.hashrate)} H/s</b></div>
                    <div><small>POWER</small><b>{num(item.power_watts, 0)} W</b></div>
                    <div><small>ROOM</small><b>{item.roomNumber ? `Room ${String(item.roomNumber).padStart(2, '0')}` : '—'}</b></div>
                    <div><small>SLOT</small><b>{item.slotIndex ?? '—'}</b></div>
                  </div>

                  {item.deployment_state === 'inventory' ? (
                    <div className="inventory-deploy-row">
                      <select aria-label={`Choose room for ${item.name}`} value={selectedRoom[item.id] ?? rooms[0]?.id ?? ''} onChange={(event) => setSelectedRoom((state) => ({ ...state, [item.id]: Number(event.target.value) }))}>
                        {rooms.map((room) => <option key={room.id} value={room.id}>Room {String(room.room_number).padStart(2, '0')} · Lv {room.room_level} · {room.capacity_slots} slots</option>)}
                      </select>
                      <button type="button" className="inventory-btn primary wide" disabled={!rooms.length || busyId === item.id} onClick={() => void deploy(item)}>
                        <Boxes size={15} /> {busyId === item.id ? 'DEPLOYING…' : 'DEPLOY TO ROOM'}
                      </button>
                    </div>
                  ) : (
                    <div className="inventory-actions">
                      <button type="button" className="inventory-btn ghost" disabled={busyId === item.id} onClick={() => void returnToInventory(item)}><RotateCcw size={15} /> Return</button>
                      {item.mergeReady ? <Link href="/merge" className="inventory-btn primary"><GitMerge size={15} /> Merge</Link> : <Link href="/rooms" className="inventory-btn ghost">Open Room <ArrowRight size={14} /></Link>}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
