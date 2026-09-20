'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Boxes,
  ChevronUp,
  GitMerge,
  LockKeyhole,
  PackageOpen,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import styles from '../RoomsPage.module.css';

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
  upgrade: {
    available: boolean;
    next_level: number | null;
    next_capacity_slots: number | null;
    price_diamond: number;
    label: string;
  };
  slots: Slot[];
};

type RoomsSnapshot = {
  room_count: number;
  max_rooms: number;
  next_room_number: number | null;
  next_room_unlock_price_diamond: number;
  rooms: Room[];
};

const num = (value: number, digits = 0) =>
  Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });

function imagePath(path: string | null, slug: string) {
  if (!path) return `/assets/miners/${slug}.webp`;

  const clean = path.replace(/^\/+/, '');

  if (clean.startsWith('assets/')) return `/${clean}`;
  if (clean.startsWith('miners/')) return `/assets/${clean}`;

  return `/assets/miners/${slug}.webp`;
}

export default function RoomDetailPage() {
  const params = useParams<{ roomNumber: string }>();
  const roomNumber = Number(params?.roomNumber);

  const [data, setData] = useState<RoomsSnapshot | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'unlock' | 'upgrade' | 'merge' | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();

      if (!user) throw new Error('Please sign in to manage your Rooms.');

      const [roomsResult, walletResult] = await Promise.all([
        sb.rpc('nextgen_rooms_snapshot'),
        sb
          .from('nextgen_wallets')
          .select('diamond_balance')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (roomsResult.error) throw roomsResult.error;
      if (walletResult.error) throw walletResult.error;

      setData(roomsResult.data as RoomsSnapshot);
      setBalance(Number(walletResult.data?.diamond_balance ?? 0));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load Room.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const room = useMemo(
    () =>
      data?.rooms.find(
        (candidate) => candidate.room_number === roomNumber,
      ) ?? null,
    [data, roomNumber],
  );

  const nextRoom = data?.next_room_number ?? null;
  const isNextLockedRoom = !room && nextRoom === roomNumber;

  async function unlockRoom() {
    if (busy || !isNextLockedRoom || !data) return;
    if (balance < data.next_room_unlock_price_diamond) return;

    setBusy('unlock');
    setMessage('');

    try {
      const result = await createClient().rpc('nextgen_create_room');
      if (result.error) throw result.error;

      setMessage(
        `Room ${String(
          result.data?.room_number ?? roomNumber,
        ).padStart(2, '0')} unlocked.`,
      );

      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Room unlock failed.');
    } finally {
      setBusy(null);
    }
  }

  async function upgradeRoom() {
    if (!room || busy || !room.upgrade.available) return;
    if (balance < room.upgrade.price_diamond) return;

    setBusy('upgrade');
    setMessage('');

    try {
      const result = await createClient().rpc('nextgen_upgrade_room', {
        p_room_id: room.id,
      });

      if (result.error) throw result.error;

      setMessage(
        `${room.name} upgraded to Level ${
          result.data?.to_level ?? room.room_level + 1
        }.`,
      );

      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Room upgrade failed.');
    } finally {
      setBusy(null);
    }
  }

  async function autoMerge() {
    if (!room || busy) return;

    setBusy('merge');
    setMessage('');

    try {
      const result = await createClient().rpc('nextgen_merge_all_ready', {
        p_room_id: room.id,
      });

      if (result.error) throw result.error;

      setMessage(
        result.data?.merged_count
          ? `${result.data.merged_count} merge${
              result.data.merged_count === 1 ? '' : 's'
            } completed in ${room.name}.`
          : 'No ready pairs in this Room.',
      );

      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Auto merge failed.');
    } finally {
      setBusy(null);
    }
  }

  if (
    !loading &&
    (roomNumber < 1 || roomNumber > (data?.max_rooms ?? 5))
  ) {
    return (
      <AppShell>
        <div className={styles.page}>
          <section className={styles.emptyPanel}>
            <div className={styles.kicker}>ROOM NOT FOUND</div>
            <h1>Invalid Room</h1>
            <Link href="/rooms" className={styles.primaryBtn}>
              <ArrowLeft size={15} />
              Back to Rooms
            </Link>
          </section>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className={styles.page}>
          <section className={styles.loadingPanel}>
            SYNCING ROOM {String(roomNumber).padStart(2, '0')}…
          </section>
        </div>
      </AppShell>
    );
  }

  if (!room) {
    const price = data?.next_room_unlock_price_diamond ?? 0;

    return (
      <AppShell>
        <div className={styles.page}>
          <div className={styles.roomNav}>
            <Link href="/rooms" className={styles.backLink}>
              <ArrowLeft size={15} />
              All Rooms
            </Link>

            {Array.from(
              { length: data?.max_rooms ?? 5 },
              (_, i) => i + 1,
            ).map((n) => (
              <Link
                key={n}
                href={`/rooms/${n}`}
                className={`${styles.roomNavItem} ${
                  n === roomNumber ? styles.roomNavCurrent : ''
                }`}
              >
                ROOM {String(n).padStart(2, '0')}
              </Link>
            ))}
          </div>

          {message ? <section className={styles.message}>{message}</section> : null}

          <section className={styles.lockPanel}>
            <div className={styles.lockIcon}>
              <LockKeyhole size={26} />
            </div>

            <div className={styles.kicker}>
              ROOM {String(roomNumber).padStart(2, '0')} · LOCKED
            </div>

            <h1>Room {String(roomNumber).padStart(2, '0')} is Locked</h1>

            <p>
              Unlock this Room to create a separate mining workspace with its
              own rack, slots and room upgrades.
            </p>

            {isNextLockedRoom ? (
              <>
                <div className={styles.lockPrice}>💎 {num(price)}</div>

                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={busy === 'unlock' || balance < price}
                  onClick={() => void unlockRoom()}
                >
                  <LockKeyhole size={15} />
                  {busy === 'unlock' ? 'UNLOCKING…' : 'UNLOCK ROOM'}
                </button>

                {balance < price ? (
                  <small className={styles.lockHint}>
                    Need {num(price - balance)} more Diamond.
                  </small>
                ) : null}
              </>
            ) : (
              <div className={styles.sequenceNote}>
                Unlock the previous Room first to continue.
              </div>
            )}
          </section>
        </div>
      </AppShell>
    );
  }

  const loadPct = Math.min(
    100,
    (room.used_slots / Math.max(room.capacity_slots, 1)) * 100,
  );

  const slots = Array.from(
    { length: room.capacity_slots },
    (_, index) =>
      room.slots.find((slot) => slot.slot_index === index + 1) ?? null,
  );

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.roomNav}>
          <Link href="/rooms" className={styles.backLink}>
            <ArrowLeft size={15} />
            All Rooms
          </Link>

          {Array.from(
            { length: data?.max_rooms ?? 5 },
            (_, i) => i + 1,
          ).map((n) => {
            const open = Boolean(
              data?.rooms.some(
                (candidate) => candidate.room_number === n,
              ),
            );

            return (
              <Link
                key={n}
                href={`/rooms/${n}`}
                className={`${styles.roomNavItem} ${
                  n === roomNumber ? styles.roomNavCurrent : ''
                } ${!open ? styles.roomNavLocked : ''}`}
              >
                {open ? <Boxes size={12} /> : <LockKeyhole size={11} />}
                ROOM {String(n).padStart(2, '0')}
              </Link>
            );
          })}
        </div>

        {message ? <section className={styles.message}>{message}</section> : null}

        <section className={styles.roomHero}>
          <div>
            <div className={styles.kicker}>
              ROOM {String(room.room_number).padStart(2, '0')} · MINING RACK
            </div>

            <h1>{room.name}</h1>
            <p>
              {room.room_label} · Level {room.room_level}
            </p>
          </div>

          <div className={styles.roomHeroBadge}>
            <Sparkles size={15} />
            <span>WORKSPACE ONLINE</span>
          </div>
        </section>

        <section className={styles.roomControls}>
          <Link href="/items" className={styles.secondaryBtn}>
            <PackageOpen size={15} />
            Inventory
          </Link>

          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={busy === 'merge'}
            onClick={() => void autoMerge()}
          >
            <GitMerge size={15} />
            {busy === 'merge' ? 'MERGING…' : 'AUTO MERGE'}
          </button>

          {room.upgrade.available ? (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={
                busy === 'upgrade' ||
                balance < room.upgrade.price_diamond
              }
              onClick={() => void upgradeRoom()}
            >
              <ChevronUp size={15} />
              {busy === 'upgrade'
                ? 'UPGRADING…'
                : `UPGRADE · 💎 ${num(room.upgrade.price_diamond)}`}
            </button>
          ) : (
            <div className={styles.maxBadge}>MAX LEVEL</div>
          )}
        </section>

        <section className={styles.roomStats}>
          <div>
            <span>SLOTS</span>
            <b>
              {room.used_slots}/{room.capacity_slots}
            </b>
            <small>occupied</small>
          </div>

          <div>
            <span>HASHRATE</span>
            <b>{num(room.hashrate)} H/s</b>
            <small>effective</small>
          </div>

          <div>
            <span>ACTIVE</span>
            <b>{room.active_miners}</b>
            <small>miners</small>
          </div>

          <div>
            <span>DIAMOND</span>
            <b>{num(balance)}</b>
            <small>available</small>
          </div>
        </section>

        <section className={styles.rackPanel}>
          <div className={styles.rackHead}>
            <div>
              <div className={styles.kicker}>RACK GRID</div>
              <h2>
                Room {String(room.room_number).padStart(2, '0')} Workspace
              </h2>
            </div>

            <span>
              {room.used_slots}/{room.capacity_slots} SLOTS
            </span>
          </div>

          <div className={styles.progress}>
            <span style={{ width: `${loadPct}%` }} />
          </div>

          <div
            className={`${styles.rackGrid} ${
              room.capacity_slots >= 48
                ? styles.rack6
                : room.capacity_slots >= 24
                  ? styles.rack4
                  : styles.rack3
            }`}
          >
            {slots.map((slot, index) =>
              slot ? (
                <div
                  key={slot.slot_index}
                  className={`${styles.slot} ${
                    slot.status === 'active' ? styles.slotActive : ''
                  }`}
                  title={`${slot.name} · Lv ${slot.level} · ${num(
                    slot.hashrate,
                  )} H/s`}
                >
                  <img
                    src={imagePath(slot.image_path, slot.slug)}
                    alt=""
                  />

                  <div className={styles.slotShade} />

                  <b>{slot.level}</b>
                  <small>#{String(index + 1).padStart(2, '0')}</small>
                  <em>
                    {slot.status === 'active'
                      ? `${num(slot.hashrate)} H/s`
                      : 'PAUSED'}
                  </em>
                </div>
              ) : (
                <div
                  key={`empty-${index}`}
                  className={`${styles.slot} ${styles.slotEmpty}`}
                >
                  <span>+</span>
                  <small>#{String(index + 1).padStart(2, '0')}</small>
                  <em>EMPTY</em>
                </div>
              ),
            )}
          </div>
        </section>

        <section className={styles.roomFooter}>
          <div>
            <span>NEXT LEVEL</span>
            <b>
              {room.upgrade.next_level
                ? `Level ${room.upgrade.next_level}`
                : 'MAX'}
            </b>
            <small>
              {room.upgrade.next_capacity_slots
                ? `${room.upgrade.next_capacity_slots} slots`
                : 'Maximum capacity reached'}
            </small>
          </div>

          <div>
            <span>POWER</span>
            <b>{num(room.power_watts)} W</b>
            <small>room load</small>
          </div>

          <Link href="/items" className={styles.secondaryBtn}>
            <RotateCcw size={14} />
            Manage Miners
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
