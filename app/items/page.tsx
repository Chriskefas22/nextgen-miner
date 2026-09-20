'use client';

import Link from 'next/link';
import { ArrowRight, Boxes, CheckCircle2, GitMerge, PackageOpen, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
  bonus_hashrate_percent: number;
};

type Catalog = {
  id: number;
  slug: string;
  name: string;
  tier: string;
  base_hashrate: number;
  image_path: string | null;
};

type RoomSlot = {
  room_id: number;
  slot_index: number;
  user_miner_id: number;
  room_number: number;
};

type Room = {
  id: number;
  room_number: number;
  name: string;
  room_level: number;
  capacity_slots: number;
  slots: RoomSlot[];
};

type InventoryItem = UserMiner & {
  name: string;
  slug: string;
  tier: string;
  image_path: string | null;
  hashrate: number;
  roomNumber: number | null;
  slotIndex: number | null;
  mergeReady: boolean;
};

const num = (value: number, digits = 2) =>
  Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });

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
  const [selectedRoom, setSelectedRoom] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();

      if (!user) {
        throw new Error('Please sign in to access your inventory.');
      }

      const [minersResult, catalogResult, levelsResult, roomsResult] =
        await Promise.all([
          sb
            .from('nextgen_user_miners')
            .select(
              'id,miner_id,current_level,status,is_merged,deployment_state,recharge_expires_at,bonus_hashrate_percent',
            )
            .eq('user_id', user.id)
            .eq('is_merged', false)
            .order('activated_at', { ascending: true }),
          sb
            .from('nextgen_miner_catalog')
            .select('id,slug,name,tier,base_hashrate,image_path')
            .eq('enabled', true),
          sb
            .from('nextgen_miner_levels')
            .select('miner_id,level,hashrate'),
          sb.rpc('nextgen_rooms_snapshot'),
        ]);

      if (minersResult.error) throw minersResult.error;
      if (catalogResult.error) throw catalogResult.error;
      if (levelsResult.error) throw levelsResult.error;
      if (roomsResult.error) throw roomsResult.error;

      const catalog = new Map<number, Catalog>(
        (catalogResult.data ?? []).map((row) => [Number(row.id), row as Catalog]),
      );

      const levels = new Map<string, number>(
        (levelsResult.data ?? []).map((row) => [
          `${Number(row.miner_id)}:${Number(row.level)}`,
          Number(row.hashrate ?? 0),
        ]),
      );

      const roomPayload = (roomsResult.data ?? {}) as { rooms?: Room[] };
      const nextRooms = Array.isArray(roomPayload.rooms) ? roomPayload.rooms : [];

      const slotByMiner = new Map<
        number,
        { roomNumber: number; slotIndex: number }
      >();

      for (const room of nextRooms) {
        for (const slot of room.slots ?? []) {
          slotByMiner.set(Number(slot.user_miner_id), {
            roomNumber: Number(room.room_number),
            slotIndex: Number(slot.slot_index),
          });
        }
      }

      const raw = (minersResult.data ?? []) as unknown as UserMiner[];
      const deployedPairs = new Map<string, number>();

      for (const row of raw) {
        if (row.deployment_state !== 'deployed') continue;
        const room = slotByMiner.get(Number(row.id));
        if (!room) continue;
        const key = `${room.roomNumber}:${Number(row.miner_id)}:${Number(row.current_level)}`;
        deployedPairs.set(key, (deployedPairs.get(key) ?? 0) + 1);
      }

      const nextItems: InventoryItem[] = raw.map((row) => {
        const catalogItem = catalog.get(Number(row.miner_id));
        const level = Number(row.current_level || 1);
        const baseHashrate = Number(
          levels.get(`${Number(row.miner_id)}:${level}`) ??
            catalogItem?.base_hashrate ??
            0,
        );
        const bonus = Math.max(
          0,
          Math.min(5, Number(row.bonus_hashrate_percent ?? 0)),
        );
        const hashrate = baseHashrate * (1 + bonus / 100);
        const room = slotByMiner.get(Number(row.id));
        const pairKey = room
          ? `${room.roomNumber}:${Number(row.miner_id)}:${level}`
          : '';
        const mergeReady = Boolean(
          room &&
            row.deployment_state === 'deployed' &&
            (deployedPairs.get(pairKey) ?? 0) >= 2 &&
            level < 10,
        );

        return {
          ...row,
          id: Number(row.id),
          miner_id: Number(row.miner_id),
          current_level: level,
          status: String(row.status),
          deployment_state:
            row.deployment_state === 'deployed' ? 'deployed' : 'inventory',
          is_merged: Boolean(row.is_merged),
          bonus_hashrate_percent: bonus,
          name: catalogItem?.name ?? `Miner #${row.miner_id}`,
          slug: catalogItem?.slug ?? 'miner',
          tier: catalogItem?.tier ?? 'COMMON',
          image_path: catalogItem?.image_path ?? null,
          hashrate,
          roomNumber: room?.roomNumber ?? null,
          slotIndex: room?.slotIndex ?? null,
          mergeReady,
        };
      });

      setItems(nextItems);
      setRooms(nextRooms);
      setSelectedRoom((previous) => {
        const next = { ...previous };
        for (const room of nextRooms) {
          if (next[room.id] == null) next[room.id] = room.id;
        }
        return next;
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to load inventory.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function deploy(item: InventoryItem) {
    const roomId = selectedRoom[item.id];
    if (!roomId) return;

    setBusyId(item.id);
    setMessage('');

    try {
      const result = await createClient().rpc('nextgen_deploy_miner', {
        p_user_miner_id: item.id,
        p_room_id: roomId,
      });

      if (result.error) throw result.error;

      setMessage(
        `${item.name} deployed to Room ${String(
          result.data?.room_number ?? '01',
        ).padStart(2, '0')}.`,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deploy failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function returnToInventory(item: InventoryItem) {
    setBusyId(item.id);
    setMessage('');

    try {
      const result = await createClient().rpc(
        'nextgen_return_miner_to_inventory',
        { p_user_miner_id: item.id },
      );

      if (result.error) throw result.error;

      setMessage(`${item.name} returned to Inventory.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Return failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell>
      <div className="inventory-page">
        <section className="inventory-hero">
          <div>
            <div className="inventory-kicker">MINER INVENTORY</div>
            <h1>Your Mining Inventory</h1>
            <p>
              Purchased miners arrive here first. Each miner keeps its own
              random hashrate bonus, which is re-rolled when you merge to the
              next level.
            </p>
          </div>

          <div className="inventory-hero-actions">
            <Link href="/miners" className="inventory-btn ghost">
              <PackageOpen size={15} />
              Shop
            </Link>
            <Link href="/rooms" className="inventory-btn primary">
              <Boxes size={15} />
              Rooms
            </Link>
          </div>
        </section>

        {message ? <section className="inventory-message">{message}</section> : null}

        {loading ? (
          <section className="inventory-empty">
            <div className="inventory-kicker">DATABASE SYNC</div>
            <h2>Loading inventory…</h2>
          </section>
        ) : items.length === 0 ? (
          <section className="inventory-empty">
            <CheckCircle2 size={38} />
            <h2>Inventory Empty</h2>
            <p>
              Visit the Shop to acquire your first miner and start building
              your mining setup.
            </p>
            <Link href="/miners" className="inventory-btn primary">
              <PackageOpen size={15} />
              Visit Shop
            </Link>
          </section>
        ) : (
          <div className="inventory-grid">
            {items.map((item) => (
              <article
                key={item.id}
                className={`inventory-card ${item.mergeReady ? 'merge-ready' : ''}`}
              >
                <div className="inventory-art">
                  <img
                    src={imagePath(item.image_path, item.slug)}
                    alt={`${item.name} virtual miner`}
                  />

                  <span className="inventory-tier">{item.tier}</span>
                  <span className="inventory-level">LV {item.current_level}/10</span>
                  <span className="inventory-bonus-badge">
                    +{num(item.bonus_hashrate_percent, 1)}% BONUS
                  </span>
                  <span className={`inventory-state ${item.deployment_state}`}>
                    {item.deployment_state === 'deployed'
                      ? 'DEPLOYED'
                      : 'IN INVENTORY'}
                  </span>
                </div>

                <div className="inventory-copy">
                  <div className="inventory-title">
                    <h3>{item.name}</h3>
                  </div>

                  <div className="inventory-stats">
                    <div className="inventory-stat-hash">
                      <small>HASHRATE</small>
                      <b>{num(item.hashrate)} H/s</b>
                    </div>
                    <div className="inventory-stat-bonus">
                      <small>BONUS HASHRATE</small>
                      <b>+{num(item.bonus_hashrate_percent, 1)}%</b>
                    </div>
                  </div>

                  {item.deployment_state === 'inventory' ? (
                    <div className="inventory-deploy-row">
                      <select
                        aria-label={`Choose room for ${item.name}`}
                        value={selectedRoom[item.id] ?? rooms[0]?.id ?? ''}
                        onChange={(event) =>
                          setSelectedRoom((state) => ({
                            ...state,
                            [item.id]: Number(event.target.value),
                          }))
                        }
                      >
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            Room {String(room.room_number).padStart(2, '0')} · Lv{' '}
                            {room.room_level} · {room.capacity_slots} slots
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="inventory-btn primary wide"
                        disabled={!rooms.length || busyId === item.id}
                        onClick={() => void deploy(item)}
                      >
                        <Boxes size={15} />
                        {busyId === item.id ? 'DEPLOYING…' : 'DEPLOY TO ROOM'}
                      </button>
                    </div>
                  ) : (
                    <div className="inventory-actions">
                      <button
                        type="button"
                        className="inventory-btn ghost"
                        disabled={busyId === item.id}
                        onClick={() => void returnToInventory(item)}
                      >
                        <RotateCcw size={15} />
                        Return
                      </button>

                      {item.mergeReady ? (
                        <Link href="/merge" className="inventory-btn primary">
                          <GitMerge size={15} />
                          Merge
                        </Link>
                      ) : (
                        <Link href="/rooms" className="inventory-btn ghost">
                          Open Room
                          <ArrowRight size={14} />
                        </Link>
                      )}
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
