'use client';

import Link from 'next/link';
import { Boxes, LockKeyhole, Plus, Sparkles } from 'lucide-react';
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
  hashrate: number;
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

const num = (value: number, digits = 0) =>
  Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });

export default function RoomsPage() {
  const [data, setData] = useState<RoomsSnapshot | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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

    setBusy(true);
    setMessage('');

    try {
      const result = await createClient().rpc('nextgen_create_room');

      if (result.error) throw result.error;

      const roomNumber = String(
        result.data?.room_number ?? data.next_room_number,
      ).padStart(2, '0');

      setMessage(`Room ${roomNumber} unlocked.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Room unlock failed.');
    } finally {
      setBusy(false);
    }
  }

  const roomsByNumber = new Map(
    (data?.rooms ?? []).map((room) => [room.room_number, room]),
  );
  const maxRooms = data?.max_rooms ?? 5;

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.selectorHero}>
          <div>
            <div className={styles.kicker}>ROOM CONTROL</div>
            <h1 className={styles.title}>Choose Your Room</h1>
            <p>
              Open one Room at a time. Each Room has its own rack, capacity,
              miner placement and upgrade controls.
            </p>
          </div>

          <div className={styles.heroStats}>
            <div>
              <span>ROOMS</span>
              <b>{data?.room_count ?? 0}/{maxRooms}</b>
            </div>
            <div>
              <span>DIAMOND</span>
              <b>{num(balance)}</b>
            </div>
          </div>
        </section>

        {message ? <section className={styles.message}>{message}</section> : null}

        <section className={styles.roomSelector} aria-label="Select mining room">
          <div className={styles.selectorTop}>
            <div>
              <div className={styles.kicker}>MINING ROOMS</div>
              <h2>Room Network</h2>
            </div>
            <Sparkles size={18} />
          </div>

          <div className={styles.roomButtons}>
            {Array.from({ length: maxRooms }, (_, index) => index + 1).map(
              (roomNumber) => {
                const room = roomsByNumber.get(roomNumber);

                return room ? (
                  <Link
                    key={roomNumber}
                    href={`/rooms/${roomNumber}`}
                    className={styles.roomButton}
                  >
                    <span className={styles.roomButtonIcon}>
                      <Boxes size={18} />
                    </span>

                    <span>
                      <b>ROOM {String(roomNumber).padStart(2, '0')}</b>
                      <small>
                        {room.name} · Lv {room.room_level}
                      </small>
                    </span>

                    <strong>
                      {room.used_slots}/{room.capacity_slots}
                    </strong>
                  </Link>
                ) : (
                  <Link
                    key={roomNumber}
                    href={`/rooms/${roomNumber}`}
                    className={`${styles.roomButton} ${styles.lockedButton}`}
                  >
                    <span className={styles.roomButtonIcon}>
                      <LockKeyhole size={18} />
                    </span>

                    <span>
                      <b>ROOM {String(roomNumber).padStart(2, '0')}</b>
                      <small>
                        {roomNumber === 1 ? 'Starter Room' : 'Locked Room'}
                      </small>
                    </span>

                    <strong>LOCKED</strong>
                  </Link>
                );
              },
            )}
          </div>
        </section>

        <section className={styles.unlockPanel}>
          <div>
            <div className={styles.kicker}>NEXT UNLOCK</div>
            <h2>
              {data?.next_room_number
                ? `Unlock Room ${String(data.next_room_number).padStart(2, '0')}`
                : 'All 5 Rooms Unlocked'}
            </h2>
            <p>
              Unlock Rooms sequentially. Once unlocked, every Room gets its own
              dedicated page and rack workspace.
            </p>
          </div>

          {data?.next_room_number ? (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || balance < data.next_room_unlock_price_diamond}
              onClick={() => void unlockNextRoom()}
            >
              <Plus size={15} />
              {busy
                ? 'UNLOCKING…'
                : `UNLOCK · 💎 ${num(data.next_room_unlock_price_diamond)}`}
            </button>
          ) : (
            <div className={styles.maxBadge}>MAX 5 ROOMS</div>
          )}
        </section>

        {!loading && data && data.room_count > 0 ? (
          <Link href="/rooms/1" className={styles.openPrimary}>
            <Boxes size={18} />

            <span>
              <b>Open Room 01</b>
              <small>Enter your mining rack workspace</small>
            </span>

            <span>→</span>
          </Link>
        ) : null}
      </div>
    </AppShell>
  );
}
