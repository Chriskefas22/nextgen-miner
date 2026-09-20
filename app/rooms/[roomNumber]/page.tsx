'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Boxes,
  GitMerge,
  LockKeyhole,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import styles from '../RoomsPage.module.css';

type Slot = {
  slot_index: number;
  user_miner_id: number;
  miner_id: number;
  name: string;
  slug: string;
  tier: string;
  level: number;
  hashrate: number;
  bonus_hashrate_percent: number;
  status: string;
  deployment_state: 'inventory' | 'deployed';
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
  slots: Slot[];
};

type RoomsSnapshot = {
  room_count: number;
  max_rooms: number;
  next_room_number: number | null;
  next_room_unlock_price_diamond: number;
  rooms: Room[];
};

const num = (value: number, digits = 1) =>
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

export default function RoomDetailPage() {
  const params = useParams<{ roomNumber: string }>();
  const roomNumber = Number(params?.roomNumber ?? 0);

  const [data, setData] =
    useState<RoomsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] =
    useState<'unlock' | 'merge' | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const result = await createClient().rpc(
        'nextgen_rooms_snapshot',
      );

      if (result.error) throw result.error;

      setData(result.data as RoomsSnapshot);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load Room.',
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

  const room = useMemo(
    () =>
      data?.rooms.find(
        (candidate) =>
          candidate.room_number === roomNumber,
      ) ?? null,
    [data, roomNumber],
  );

  const nextRoom = data?.next_room_number ?? null;
  const isNextLockedRoom =
    !room && nextRoom === roomNumber;

  async function unlockRoom() {
    if (busy || !isNextLockedRoom) return;

    setBusy('unlock');
    setMessage('');

    try {
      const result = await createClient().rpc(
        'nextgen_create_room',
      );

      if (result.error) throw result.error;

      setMessage(
        `Room ${String(
          result.data?.room_number ?? roomNumber,
        ).padStart(2, '0')} unlocked.`,
      );

      window.dispatchEvent(new Event('nextgen:sync'));
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Room unlock failed.',
      );
    } finally {
      setBusy(null);
    }
  }

  function selectMiner(slot: Slot) {
    setMessage('');

    if (selectedIds.includes(slot.user_miner_id)) {
      setSelectedIds((current) =>
        current.filter(
          (id) => id !== slot.user_miner_id,
        ),
      );
      return;
    }

    if (selectedIds.length === 0) {
      setSelectedIds([slot.user_miner_id]);
      return;
    }

    if (selectedIds.length >= 2) {
      setSelectedIds([slot.user_miner_id]);
      return;
    }

    const first = room?.slots.find(
      (candidate) =>
        candidate.user_miner_id === selectedIds[0],
    );

    if (
      first &&
      first.miner_id === slot.miner_id &&
      first.level === slot.level
    ) {
      setSelectedIds((current) => [
        ...current,
        slot.user_miner_id,
      ]);
      return;
    }

    setMessage(
      'Select another matching miner at the same level.',
    );
  }

  async function mergeSelected() {
    if (!room || busy || selectedIds.length !== 2) {
      return;
    }

    setBusy('merge');
    setMessage('');

    try {
      const result = await createClient().rpc(
        'nextgen_merge_miners',
        {
          p_first_user_miner_id: selectedIds[0],
          p_second_user_miner_id: selectedIds[1],
        },
      );

      if (result.error) throw result.error;

      const payload = result.data as
        | {
            bonus_hashrate_percent?: number;
            to_level?: number;
            hashrate?: number;
          }
        | null;

      setSelectedIds([]);

      setMessage(
        `Merge complete · Level ${
          payload?.to_level ?? 'next'
        } · ${num(
          Number(payload?.hashrate ?? 0),
          1,
        )} H/s · Bonus +${num(
          Number(payload?.bonus_hashrate_percent ?? 0),
          1,
        )}%.`,
      );

      window.dispatchEvent(new Event('nextgen:sync'));
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Merge failed.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function autoMerge() {
    if (!room || busy) return;

    setBusy('merge');
    setSelectedIds([]);
    setMessage('');

    try {
      const result = await createClient().rpc(
        'nextgen_merge_all_ready',
        { p_room_id: room.id },
      );

      if (result.error) throw result.error;

      const payload = result.data as
        | { merged_count?: number }
        | null;

      setMessage(
        payload?.merged_count
          ? `${payload.merged_count} merge${
              payload.merged_count === 1 ? '' : 's'
            } completed.`
          : 'No ready matching pairs in this Room.',
      );

      window.dispatchEvent(new Event('nextgen:sync'));
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Auto merge failed.',
      );
    } finally {
      setBusy(null);
    }
  }

  if (!loading && !data) {
    return (
      <AppShell>
        <div className={styles.page}>
          <section className={styles.emptyPanel}>
            <div className={styles.kicker}>
              ROOM DATA UNAVAILABLE
            </div>
            <h1>Unable to load Room</h1>
          </section>
        </div>
      </AppShell>
    );
  }

  if (
    !loading &&
    (roomNumber < 1 ||
      roomNumber > (data?.max_rooms ?? 5))
  ) {
    return (
      <AppShell>
        <div className={styles.page}>
          <section className={styles.emptyPanel}>
            <div className={styles.kicker}>
              ROOM NOT FOUND
            </div>
            <h1>Invalid Room</h1>
            <Link
              href="/rooms"
              className={styles.secondaryBtn}
            >
              <ArrowLeft size={15} />
              BACK TO ROOMS
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
            SYNCING ROOM{' '}
            {String(roomNumber).padStart(2, '0')}…
          </section>
        </div>
      </AppShell>
    );
  }

  if (!room) {
    const price =
      data?.next_room_unlock_price_diamond ?? 0;

    return (
      <AppShell>
        <div className={styles.page}>
          <section className={styles.lockPanel}>
            <div className={styles.lockIcon}>
              <LockKeyhole size={26} />
            </div>

            <div className={styles.kicker}>
              ROOM {String(roomNumber).padStart(2, '0')} · LOCKED
            </div>

            <h1>
              Room {String(roomNumber).padStart(2, '0')}
            </h1>

            <p>
              Unlock this Room to create another independent
              12-slot mining workspace.
            </p>

            {isNextLockedRoom ? (
              <>
                <div className={styles.lockPrice}>
                  💎 {num(price, 0)}
                </div>

                <button
                  type="button"
                  className={styles.openRoomBtn}
                  disabled={busy === 'unlock'}
                  onClick={() => void unlockRoom()}
                >
                  <LockKeyhole size={15} />
                  {busy === 'unlock'
                    ? 'UNLOCKING…'
                    : 'UNLOCK ROOM'}
                </button>
              </>
            ) : (
              <div className={styles.sequenceNote}>
                Unlock the previous Room first.
              </div>
            )}

            <Link
              href="/rooms"
              className={styles.secondaryBtn}
            >
              <ArrowLeft size={15} />
              BACK TO ROOMS
            </Link>
          </section>
        </div>
      </AppShell>
    );
  }

  const slots = Array.from(
    { length: 12 },
    (_, index) =>
      room.slots.find(
        (slot) => slot.slot_index === index + 1,
      ) ?? null,
  );

  return (
    <AppShell>
      <div className={styles.page}>
        <div className={styles.roomNav}>
          <Link
            href="/rooms"
            className={styles.backLink}
          >
            <ArrowLeft size={14} />
            ALL ROOMS
          </Link>

          <span className={styles.roomNavItem}>
            ROOM {String(room.room_number).padStart(2, '0')}
          </span>
        </div>

        {message ? (
          <section className={styles.message}>
            {message}
          </section>
        ) : null}

        <section className={styles.roomHero}>
          <div>
            <div className={styles.kicker}>
              ROOM {String(room.room_number).padStart(2, '0')}
            </div>
            <h1>{room.name}</h1>
            <p>{room.room_label}</p>
          </div>

          <div className={styles.roomHeroBadge}>
            <Sparkles size={15} />
            12-SLOT WORKSPACE
          </div>
        </section>

        <section className={styles.roomControls}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={busy === 'merge'}
            onClick={() => void autoMerge()}
          >
            <GitMerge size={16} />
            {busy === 'merge'
              ? 'MERGING…'
              : 'AUTO MERGE ALL'}
          </button>

          {selectedIds.length === 2 ? (
            <button
              type="button"
              className={styles.mergeSelectedBtn}
              disabled={busy === 'merge'}
              onClick={() => void mergeSelected()}
            >
              <GitMerge size={16} />
              {busy === 'merge'
                ? 'MERGING…'
                : 'MERGE SELECTED'}
            </button>
          ) : (
            <div className={styles.manualHint}>
              Tap two matching miners at the same level to merge.
            </div>
          )}
        </section>

        <section className={styles.rackPanel}>
          <div className={styles.rackHead}>
            <div>
              <div className={styles.kicker}>RACK GRID</div>
              <h2>12 Miner Slots</h2>
            </div>

            {selectedIds.length ? (
              <span className={styles.selectionBadge}>
                {selectedIds.length}/2 SELECTED
              </span>
            ) : null}
          </div>

          <div className={styles.rackGrid}>
            {slots.map((slot, index) =>
              slot ? (
                <button
                  key={slot.slot_index}
                  type="button"
                  className={`${styles.slot} ${
                    selectedIds.includes(
                      slot.user_miner_id,
                    )
                      ? styles.slotSelected
                      : ''
                  }`}
                  onClick={() => selectMiner(slot)}
                  title={`${slot.name} · LV ${
                    slot.level
                  } · ${num(
                    slot.hashrate,
                    1,
                  )} H/s · +${num(
                    slot.bonus_hashrate_percent,
                    1,
                  )}%`}
                >
                  <img
                    src={imagePath(
                      slot.image_path,
                      slot.slug,
                    )}
                    alt=""
                  />

                  <div className={styles.slotShade} />

                  <b>LV {slot.level}</b>
                  <small>
                    #{String(index + 1).padStart(2, '0')}
                  </small>

                  <em>
                    {num(
                      slot.hashrate,
                      1,
                    )}{' '}
                    H/s · +{num(
                      slot.bonus_hashrate_percent,
                      1,
                    )}%
                  </em>
                </button>
              ) : (
                <div
                  key={`empty-${index}`}
                  className={`${styles.slot} ${styles.slotEmpty}`}
                >
                  <span>+</span>
                  <small>
                    #{String(index + 1).padStart(2, '0')}
                  </small>
                  <em>EMPTY</em>
                </div>
              ),
            )}
          </div>
        </section>

        {selectedIds.length ? (
          <div className={styles.selectionNote}>
            {selectedIds.length === 1
              ? 'Now tap the matching miner you want to merge with.'
              : 'Two matching miners selected. Confirm the merge above.'}

            <button
              type="button"
              className={styles.selectionClear}
              onClick={() => setSelectedIds([])}
              aria-label="Clear selected miners"
            >
              <X size={13} />
            </button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
