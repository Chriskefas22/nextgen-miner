'use client';

import Link from 'next/link';
import { ArrowRight, Boxes, ChevronUp, LockKeyhole } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import styles from './RoomsPage.module.css';

type Room = {
  id: number;
  room_number: number;
  name: string;
  room_level: number;
  room_label: string;
  capacity_slots: number;
  used_slots: number;
  upgrade: {
    available: boolean;
    next_level: number | null;
    next_capacity_slots: number | null;
    price_diamond: number;
    label: string;
  };
};

type RoomsSnapshot = {
  room_count: number;
  max_rooms: number;
  next_room_number: number | null;
  next_room_unlock_price_diamond: number;
  rooms: Room[];
};

const num = (value: number) =>
  Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });

export default function RoomsPage() {
  const [data, setData] = useState<RoomsSnapshot | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'unlock' | number | null>(null);
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
      setMessage(error instanceof Error ? error.message : 'Unable to load Rooms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function unlockNextRoom() {
    if (
      busy ||
      !data?.next_room_number ||
      balance < data.next_room_unlock_price_diamond
    ) {
      return;
    }

    setBusy('unlock');
    setMessage('');

    try {
      const result = await createClient().rpc('nextgen_create_room');
      if (result.error) throw result.error;

      setMessage(
        `Room ${String(
          result.data?.room_number ?? data.next_room_number,
        ).padStart(2, '0')} unlocked.`,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Room unlock failed.');
    } finally {
      setBusy(null);
    }
  }

  async function upgradeRoom(room: Room) {
    if (
      busy ||
      !room.upgrade.available ||
      balance < room.upgrade.price_diamond
    ) {
      return;
    }

    setBusy(room.id);
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

  const maxRooms = data?.max_rooms ?? 5;
  const roomsByNumber = new Map(
    (data?.rooms ?? []).map((room) => [room.room_number, room]),
  );

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.selectorHero}>
          <div>
            <div className={styles.kicker}>ROOMS</div>
            <h1 className={styles.title}>Choose Your Room</h1>
            <p>
              Each Room is a separate 12-slot mining workspace. Open a Room to
              deploy miners and merge matching miners.
            </p>
          </div>
        </section>

        {message ? <section className={styles.message}>{message}</section> : null}

        {loading ? (
          <section className={styles.loadingPanel}>SYNCING ROOMS…</section>
        ) : (
          <section className={styles.roomSelector} aria-label="Choose a Room">
            <div className={styles.roomGrid}>
              {Array.from({ length: maxRooms }, (_, index) => index + 1).map(
                (roomNumber) => {
                  const room = roomsByNumber.get(roomNumber);
                  const isNext = data?.next_room_number === roomNumber;
                  const canUnlock =
                    isNext &&
                    balance >= (data?.next_room_unlock_price_diamond ?? 0);

                  return (
                    <article
                      key={roomNumber}
                      className={`${styles.roomCard} ${
                        room ? styles.roomCardOpen : styles.roomCardLocked
                      }`}
                    >
                      <div className={styles.roomCardTop}>
                        <div className={styles.roomIcon}>
                          {room ? <Boxes size={19} /> : <LockKeyhole size={18} />}
                        </div>

                        <div className={styles.roomCardTitle}>
                          <span>ROOM {String(roomNumber).padStart(2, '0')}</span>
                          <strong>{room?.name ?? 'Locked Room'}</strong>
                          <small>
                            {room
                              ? room.room_label
                              : isNext
                                ? 'Ready to unlock'
                                : 'Unlock previous Room first'}
                          </small>
                        </div>

                        <b className={styles.roomStatus}>
                          {room ? 'OPEN' : 'LOCKED'}
                        </b>
                      </div>

                      <div className={styles.roomCardActions}>
                        {room ? (
                          <Link
                            href={`/rooms/${roomNumber}`}
                            className={styles.openRoomBtn}
                          >
                            OPEN ROOM
                            <ArrowRight size={15} />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className={styles.openRoomBtn}
                            disabled={!canUnlock || busy === 'unlock'}
                            onClick={() => void unlockNextRoom()}
                          >
                            <LockKeyhole size={15} />
                            {busy === 'unlock'
                              ? 'UNLOCKING…'
                              : isNext
                                ? `UNLOCK · 💎 ${num(
                                    data?.next_room_unlock_price_diamond ?? 0,
                                  )}`
                                : 'LOCKED'}
                          </button>
                        )}

                        {room?.upgrade.available ? (
                          <button
                            type="button"
                            className={styles.upgradeBtn}
                            disabled={
                              busy === room.id ||
                              balance < room.upgrade.price_diamond
                            }
                            onClick={() => void upgradeRoom(room)}
                          >
                            <ChevronUp size={14} />
                            UPGRADE · 💎 {num(room.upgrade.price_diamond)}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
