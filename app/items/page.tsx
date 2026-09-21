'use client';

import Link from 'next/link';
import {
  Boxes,
  CheckCircle2,
  PackageOpen,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
  capacity_slots: number;
  used_slots: number;
};

type InventorySnapshot = {
  diamond_balance: number;
  miners: InventorySnapshotMiner[];
  rooms: Room[];
};

type InventoryItem = InventorySnapshotMiner & {
  roomNumber: number | null;
  slotIndex: number | null;
};

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

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const result = await createClient().rpc(
        'nextgen_inventory_snapshot',
      );

      if (result.error) throw result.error;

      const snapshot =
        result.data as unknown as InventorySnapshot;

      setItems(
        (snapshot.miners ?? []).map((item) => ({
          ...item,
          id: Number(item.id),
          miner_id: Number(item.miner_id),
          current_level: Number(item.current_level || 1),
          status: String(item.status),
          is_merged: Boolean(item.is_merged),
          deployment_state:
            item.deployment_state === 'deployed'
              ? 'deployed'
              : 'inventory',
          bonus_hashrate_percent: Math.max(
            0,
            Math.min(5, Number(item.bonus_hashrate_percent ?? 0)),
          ),
          base_hashrate: Number(item.base_hashrate ?? 0),
          hashrate: Number(item.hashrate ?? 0),
          room_id:
            item.room_id == null ? null : Number(item.room_id),
          room_number:
            item.room_number == null
              ? null
              : Number(item.room_number),
          slot_index:
            item.slot_index == null
              ? null
              : Number(item.slot_index),
          merge_ready: Boolean(item.merge_ready),
          roomNumber:
            item.room_number == null
              ? null
              : Number(item.room_number),
          slotIndex:
            item.slot_index == null
              ? null
              : Number(item.slot_index),
        })),
      );

      setRooms(
        (snapshot.rooms ?? []).map((room) => ({
          id: Number(room.id),
          room_number: Number(room.room_number),
          name: String(room.name),
          room_level: Number(room.room_level),
          capacity_slots: 12,
          used_slots: Math.min(
            12,
            Math.max(0, Number(room.used_slots ?? 0)),
          ),
        })),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load inventory.',
      );
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
      window.removeEventListener(
        'nextgen:sync',
        sync as EventListener,
      );
    };
  }, [load]);

  async function deploy(item: InventoryItem) {
    const room1 = rooms.find(
      (room) => room.room_number === 1,
    );

    if (!room1) {
      setMessage('Room 01 is not available yet.');
      return;
    }

    if (
      Number(room1.used_slots ?? 0) >=
      Number(room1.capacity_slots ?? 12)
    ) {
      setMessage(
        'Room 01 is full. Move a miner to Inventory before placing another.',
      );
      return;
    }

    setBusyId(item.id);
    setMessage('');

    try {
      const result = await createClient().rpc(
        'nextgen_place_miner_to_room1',
        {
          p_user_miner_id: item.id,
        },
      );

      if (result.error) throw result.error;

      window.dispatchEvent(new Event('nextgen:sync'));
      router.push('/rooms/1');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to place miner in Room 01.',
      );
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
              Miners stay here only until they are placed in a Room.
              Once deployed, the same miner leaves Inventory and
              appears only in its Room rack.
            </p>
          </div>

          <div className="inventory-hero-actions">
            <Link href="/miners" className="inventory-btn ghost">
              <PackageOpen size={15} />
              Shop
            </Link>

            <Link href="/rooms/1" className="inventory-btn primary">
              <Boxes size={15} />
              Room 01
            </Link>
          </div>
        </section>

        {message ? (
          <section className="inventory-message">{message}</section>
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
              No miners are waiting in Inventory. Buy a miner from
              the Shop, or move one back from a Room.
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
                  <img
                    src={imagePath(item.image_path, item.slug)}
                    alt={`${item.name} virtual miner`}
                  />

                  <span className="inventory-tier">
                    {item.tier}
                  </span>

                  <span className="inventory-level">
                    LV {item.current_level}/10
                  </span>

                  <span className="inventory-bonus-badge">
                    +{num(item.bonus_hashrate_percent, 1)}% BONUS
                  </span>

                  <span className="inventory-state inventory">
                    IN INVENTORY
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
                      <b>
                        +{num(item.bonus_hashrate_percent, 1)}%
                      </b>
                    </div>
                  </div>

                  <div className="inventory-deploy-row">
                    <button
                      type="button"
                      className="inventory-btn primary wide"
                      disabled={
                        busyId === item.id ||
                        (() => {
                          const room1 = rooms.find(
                            (room) => room.room_number === 1,
                          );
                          return !room1 || room1.used_slots >= 12;
                        })()
                      }
                      onClick={() => void deploy(item)}
                    >
                      <Boxes size={15} />
                      {busyId === item.id
                        ? 'PLACING & POWERING…'
                        : 'PLACE & POWER UP · ROOM 01'}
                    </button>
                  </div>

                  <div className="inventory-copy-hint">
                    Placement immediately moves this miner out of
                    Inventory and into the Room rack.
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
