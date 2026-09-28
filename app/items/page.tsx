'use client';

import Link from 'next/link';
import {
  Boxes,
  CheckCircle2,
  PackageOpen,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import './inventory.css';

type InventorySnapshotMiner = {
  id: number;
  miner_id: number;
  current_level: number;
  status: string;
  is_merged: boolean;
  deployment_state: 'inventory' | 'deployed';
  recharge_expires_at: string | null;
  bonus_hashrate_percent: number;
  name: string;
  slug: string;
  tier: string;
  image_path: string | null;
  base_hashrate: number;
  hashrate: number;
  room_id: number | null;
  room_number: number | null;
  slot_index: number | null;
  merge_ready: boolean;
};

type Room = {
  id: number;
  room_number: number;
  name: string;
  room_level: number;
  room_label?: string;
  room_description?: string;
  room_bonus_percent: number;
  visual_key?: string;
  capacity_slots: number;
  used_slots: number;
  empty_slots?: number;
  hashrate?: number;
};

type InventorySnapshot = {
  diamond_balance: number;
  miners: InventorySnapshotMiner[];
  rooms: Room[];
};

type InventoryItem = InventorySnapshotMiner;

const num = (value: number, digits = 2) =>
  Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: digits,
  });

function imagePath(path: string | null, slug: string) {
  if (!path) return `/assets/miners/${slug}.webp`;
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('assets/')) return `/${clean}`;
  if (clean.startsWith('miners/')) return `/assets/${clean}`;
  return `/assets/miners/${slug}.webp`;
}

const tierColor = (level: number) => {
  if (level >= 5) return '#c767ff';
  if (level === 4) return '#ffb933';
  if (level === 3) return '#e96cff';
  if (level === 2) return '#54cfff';
  return '#c6a96b';
};

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const result = await createClient().rpc('nextgen_inventory_snapshot');
      if (result.error) throw result.error;

      const snapshot = result.data as unknown as InventorySnapshot;

      const normalizedRooms = (snapshot.rooms ?? []).map((room) => ({
        ...room,
        id: Number(room.id),
        room_number: Number(room.room_number),
        room_level: Number(room.room_level),
        room_bonus_percent: Number(room.room_bonus_percent ?? 0),
        capacity_slots: 12,
        used_slots: Math.min(12, Math.max(0, Number(room.used_slots ?? 0))),
        empty_slots: Math.max(0, 12 - Math.min(12, Math.max(0, Number(room.used_slots ?? 0)))),
        hashrate: Number(room.hashrate ?? 0),
      }));

      setRooms(normalizedRooms);
      setSelectedRoomId((current) =>
        current && normalizedRooms.some((room) => room.id === current)
          ? current
          : normalizedRooms.find((room) => room.used_slots < 12)?.id ?? normalizedRooms[0]?.id ?? null,
      );

      setItems(
        (snapshot.miners ?? []).map((item) => ({
          ...item,
          id: Number(item.id),
          miner_id: Number(item.miner_id),
          current_level: Number(item.current_level || 1),
          status: String(item.status),
          is_merged: Boolean(item.is_merged),
          deployment_state: item.deployment_state === 'deployed' ? 'deployed' : 'inventory',
          bonus_hashrate_percent: Math.max(0, Math.min(5, Number(item.bonus_hashrate_percent ?? 0))),
          base_hashrate: Number(item.base_hashrate ?? 0),
          hashrate: Number(item.hashrate ?? 0),
          room_id: item.room_id == null ? null : Number(item.room_id),
          room_number: item.room_number == null ? null : Number(item.room_number),
          slot_index: item.slot_index == null ? null : Number(item.slot_index),
          merge_ready: Boolean(item.merge_ready),
        })),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const sync = () => {
      if (!document.hidden) void load();
    };

    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('nextgen:sync', sync as EventListener);

    return () => {
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('nextgen:sync', sync as EventListener);
    };
  }, [load]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const nextEffectiveHashrate = (item: InventoryItem) =>
    item.hashrate * (1 + Number(selectedRoom?.room_bonus_percent ?? 0) / 100);

  async function deploy(item: InventoryItem) {
    if (!selectedRoom) {
      setMessage('Unlock a Room before deploying a miner.');
      return;
    }

    if (selectedRoom.used_slots >= 12) {
      setMessage(`${selectedRoom.name} is full. Choose another unlocked Room.`);
      return;
    }

    setBusyId(item.id);
    setMessage('');

    try {
      const result = await createClient().rpc('nextgen_deploy_miner', {
        p_user_miner_id: item.id,
        p_room_id: selectedRoom.id,
        p_slot_index: null,
      });

      if (result.error) throw result.error;

      window.dispatchEvent(new Event('nextgen:sync'));
      router.push(`/rooms/${selectedRoom.room_number}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to deploy miner.');
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
              Miners stay here until you place them into an unlocked Room. Choose the destination Room first;
              the server then assigns the next free 12-slot rack position.
            </p>
          </div>

          <div className="inventory-hero-actions">
            <Link href="/miners" className="inventory-btn ghost">
              <PackageOpen size={15} />
              Shop
            </Link>
            <Link href="/rooms/1" className="inventory-btn primary">
              <Boxes size={15} />
              Rooms
            </Link>
          </div>
        </section>

        {message ? <section className="inventory-message">{message}</section> : null}

        {!loading && rooms.length ? (
          <section
            className="inventory-card"
            style={{
              padding: 16,
              border: '1px solid rgba(255,255,255,.10)',
              background: 'rgba(7,10,18,.78)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Sparkles size={16} />
              <div>
                <div className="inventory-kicker">DEPLOY DESTINATION</div>
                <strong style={{ color: '#fff' }}>Choose an unlocked Room with an open slot</strong>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 8,
              }}
            >
              {rooms.map((room) => {
                const full = room.used_slots >= 12;
                const selected = room.id === selectedRoomId;
                const levelColor = tierColor(room.room_level);
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      borderRadius: 14,
                      border: selected
                        ? `1px solid ${levelColor}`
                        : '1px solid rgba(255,255,255,.10)',
                      background: selected
                        ? `linear-gradient(145deg, rgba(255,255,255,.10), rgba(0,0,0,.20))`
                        : 'rgba(255,255,255,.03)',
                      boxShadow: selected ? `0 0 30px ${levelColor}22` : 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      opacity: full ? .75 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '.12em', opacity: .55 }}>
                        ROOM {String(room.room_number).padStart(2, '0')}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 900, color: levelColor }}>
                        +{num(room.room_bonus_percent, 0)}% H/s
                      </span>
                    </div>
                    <div style={{ marginTop: 7, fontWeight: 900 }}>{room.name}</div>
                    <div style={{ marginTop: 3, fontSize: 10, opacity: .62 }}>
                      {room.used_slots}/12 slots · {full ? 'FULL' : 'READY'}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedRoom ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(255,255,255,.07)',
                  color: 'rgba(255,255,255,.68)',
                  fontSize: 11,
                }}
              >
                <Zap size={14} />
                Selected: <strong style={{ color: '#fff' }}>{selectedRoom.name}</strong>
                · Room bonus +{num(selectedRoom.room_bonus_percent, 0)}%
              </div>
            ) : null}
          </section>
        ) : null}

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
              No miners are waiting in Inventory. Buy a miner from the Shop, or move one back from a Room.
            </p>
            <Link href="/miners" className="inventory-btn primary">
              <PackageOpen size={15} />
              Visit Shop
            </Link>
          </section>
        ) : (
          <div className="inventory-grid">
            {items.map((item) => (
              <article key={item.id} className="inventory-card">
                <div className="inventory-art">
                  <img src={imagePath(item.image_path, item.slug)} alt={`${item.name} virtual miner`} />
                  <span className="inventory-tier">{item.tier}</span>
                  <span className="inventory-level">LV {item.current_level}/10</span>
                  <span className="inventory-bonus-badge">+{num(item.bonus_hashrate_percent, 1)}% BONUS</span>
                  <span className="inventory-state inventory">IN INVENTORY</span>
                </div>

                <div className="inventory-copy">
                  <div className="inventory-title"><h3>{item.name}</h3></div>

                  <div className="inventory-stats">
                    <div className="inventory-stat-hash">
                      <small>MINER HASHRATE</small>
                      <b>{num(item.hashrate)} H/s</b>
                    </div>
                    <div className="inventory-stat-bonus">
                      <small>ROOM EFFECTIVE H/S</small>
                      <b>{selectedRoom ? `${num(nextEffectiveHashrate(item))} H/s` : 'Choose a Room'}</b>
                    </div>
                  </div>

                  <div className="inventory-deploy-row">
                    <button
                      type="button"
                      className="inventory-btn primary wide"
                      disabled={busyId === item.id || !selectedRoom || selectedRoom.used_slots >= 12}
                      onClick={() => void deploy(item)}
                    >
                      <Boxes size={15} />
                      {busyId === item.id
                        ? 'PLACING & POWERING…'
                        : selectedRoom
                          ? `PLACE IN ROOM ${String(selectedRoom.room_number).padStart(2, '0')}`
                          : 'SELECT A ROOM'}
                    </button>
                  </div>

                  <div className="inventory-copy-hint">
                    Deployment moves this miner out of Inventory. It contributes to funded mining only while deployed and active.
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
