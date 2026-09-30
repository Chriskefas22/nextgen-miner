'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ChevronRight,
  GitMerge,
  Info,
  LockKeyhole,
  Sparkles,
  Zap,
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
  room_effective_hashrate: number;
  bonus_hashrate_percent: number;
  room_bonus_percent: number;
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
  room_description: string;
  room_bonus_percent: number;
  visual_key: string;
  capacity_slots: number;
  used_slots: number;
  empty_slots: number;
  active_miners: number;
  hashrate: number;
  power_watts: number;
  total_spent_diamond: number;
  slots: Slot[];
};

type RoomsSnapshot = {
  room_count: number;
  max_rooms: number;
  next_room_number: number | null;
  next_room_unlock_price_diamond: number;
  next_room_level: number | null;
  next_room_label: string | null;
  next_room_bonus_percent: number | null;
  rooms: Room[];
};


const ROOM_TIER_META: Record<number, {
  name: string;
  key: string;
  subtitle: string;
  bonus: number;
  price: number;
  description: string;
  features: string[];
}> = {
  1: {
    name: 'STANDARD ROOM',
    key: 'standard',
    subtitle: 'Basic Starter Room',
    bonus: 0,
    price: 0,
    description: 'The free starter room. A simple 12-slot mining workspace where new users can deploy their first miner, experience mining, and begin building hashrate.',
    features: ['12 miner slots', 'Simple industrial environment', 'Starter lighting and cooling', 'Room bonus +0% H/s'],
  },
  2: {
    name: 'ADVANCED ROOM',
    key: 'advanced',
    subtitle: 'Enhanced Mining Facility',
    bonus: 5,
    price: 25000,
    description: 'A high-tech mining facility designed as the first paid progression step, with active cooling, monitoring and brighter technology lighting.',
    features: ['12 miner slots', '+5% Room H/s', 'Advanced cooling system', 'Live monitoring screens', 'Dynamic fans and vents'],
  },
  3: {
    name: 'PREMIUM ROOM',
    key: 'premium',
    subtitle: 'Elite Reactor Chamber',
    bonus: 10,
    price: 75000,
    description: 'A neon reactor chamber with holographic controls, energy tubes and floating particles that visibly transforms the mining environment.',
    features: ['12 miner slots', '+10% Room H/s', 'Neon reactor core', 'Holographic displays', 'Energy tubes and particles'],
  },
  4: {
    name: 'LEGENDARY ROOM',
    key: 'legendary',
    subtitle: 'Legendary Power Chamber',
    bonus: 20,
    price: 250000,
    description: 'A powerful reactor chamber with golden energy, dynamic beams and a high-output atmosphere for advanced mining fleets.',
    features: ['12 miner slots', '+20% Room H/s', 'Golden reactor core', 'Dynamic energy beams', 'Legendary aura lighting'],
  },
  5: {
    name: 'MYTHICAL ROOM',
    key: 'mythical',
    subtitle: 'Mythical Living Environment',
    bonus: 35,
    price: 750000,
    description: 'A living cosmic mining environment where nature, energy, crystals, floating elements and nebula effects make the room feel alive.',
    features: ['12 miner slots', '+35% Room H/s', 'Living cosmic environment', 'Energy crystals and flowing light', 'Floating islands and nebula effects'],
  },
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

function roomTheme(level: number, visualKey: string) {
  return `${styles.roomScene} ${styles[`theme_${visualKey || `level${level}`}`] ?? styles.theme_standard}`;
}

function statusText(status: string) {
  return status.toLowerCase() === 'active' ? 'MINING' : 'PAUSED';
}

export default function RoomDetailPage() {
  const params = useParams<{ roomNumber: string }>();
  const roomNumber = Number(params?.roomNumber ?? 0);

  const [data, setData] = useState<RoomsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'unlock' | 'merge' | 'move' | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedMiner, setSelectedMiner] = useState<Slot | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await createClient().rpc('nextgen_rooms_snapshot');
      if (result.error) throw result.error;
      setData(result.data as RoomsSnapshot);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load Room.');
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

  const room = useMemo(
    () => data?.rooms.find((candidate) => candidate.room_number === roomNumber) ?? null,
    [data, roomNumber],
  );

  const nextRoom = data?.next_room_number ?? null;
  const isNextLockedRoom = !room && nextRoom === roomNumber;

  async function unlockRoom() {
    if (busy || !isNextLockedRoom) return;
    setBusy('unlock');
    setMessage('');
    try {
      const result = await createClient().rpc('nextgen_create_room');
      if (result.error) throw result.error;
      setMessage(
        `Room ${String(result.data?.room_number ?? roomNumber).padStart(2, '0')} unlocked.`,
      );
      window.dispatchEvent(new Event('nextgen:sync'));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Room unlock failed.');
    } finally {
      setBusy(null);
    }
  }

  function selectForMerge(slot: Slot) {
    setMessage('');

    if (selectedIds.includes(slot.user_miner_id)) {
      setSelectedIds((current) => current.filter((id) => id !== slot.user_miner_id));
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

    const first = room?.slots.find((candidate) => candidate.user_miner_id === selectedIds[0]);
    if (first && first.miner_id === slot.miner_id && first.level === slot.level) {
      setSelectedIds((current) => [...current, slot.user_miner_id]);
      return;
    }

    setMessage('Select another identical miner at the same level.');
  }

  async function mergeSelected() {
    if (!room || busy || selectedIds.length !== 2) return;
    setBusy('merge');
    setMessage('');
    try {
      const result = await createClient().rpc('nextgen_merge_miners', {
        p_first_user_miner_id: selectedIds[0],
        p_second_user_miner_id: selectedIds[1],
      });
      if (result.error) throw result.error;
      const payload = result.data as { to_level?: number; hashrate?: number; bonus_hashrate_percent?: number; room_bonus_percent?: number };
      setSelectedIds([]);
      setMessage(
        `Merge complete · Level ${payload?.to_level ?? 'next'} · ${num(Number(payload?.hashrate ?? 0))} H/s · Miner +${num(Number(payload?.bonus_hashrate_percent ?? 0))}% · Room +${num(Number(payload?.room_bonus_percent ?? room.room_bonus_percent))}%`,
      );
      window.dispatchEvent(new Event('nextgen:sync'));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Merge failed.');
    } finally {
      setBusy(null);
    }
  }

  async function autoMerge() {
    if (!room || busy) return;
    setBusy('merge');
    setSelectedIds([]);
    setSelectedMiner(null);
    setMessage('');
    try {
      const result = await createClient().rpc('nextgen_merge_all_ready', { p_room_id: room.id });
      if (result.error) throw result.error;
      const payload = result.data as { merged_count?: number } | null;
      setMessage(
        payload?.merged_count
          ? `${payload.merged_count} merge${payload.merged_count === 1 ? '' : 's'} completed.`
          : 'No ready matching pairs in this Room.',
      );
      window.dispatchEvent(new Event('nextgen:sync'));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Auto merge failed.');
    } finally {
      setBusy(null);
    }
  }

  async function moveMinerToInventory(slot: Slot) {
    if (busy) return;
    setBusy('move');
    setMessage('');
    try {
      const result = await createClient().rpc('nextgen_return_miner_to_inventory', {
        p_user_miner_id: slot.user_miner_id,
      });
      if (result.error) throw result.error;
      setSelectedMiner(null);
      setSelectedIds((current) => current.filter((id) => id !== slot.user_miner_id));
      setMessage(`${slot.name} moved to Inventory.`);
      window.dispatchEvent(new Event('nextgen:sync'));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to move miner to Inventory.');
    } finally {
      setBusy(null);
    }
  }

  if (!loading && !data) {
    return (
      <AppShell>
        <div className={styles.page}>
          <section className={styles.emptyPanel}>
            <div className={styles.kicker}>ROOM DATA UNAVAILABLE</div>
            <h1>Unable to load Room</h1>
          </section>
        </div>
      </AppShell>
    );
  }

  if (!loading && (roomNumber < 1 || roomNumber > (data?.max_rooms ?? 5))) {
    return (
      <AppShell>
        <div className={styles.page}>
          <section className={styles.emptyPanel}>
            <div className={styles.kicker}>ROOM NOT FOUND</div>
            <h1>Invalid Room</h1>
            <Link href="/rooms/1" className={styles.secondaryBtn}>
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
          <section className={styles.loadingPanel}>SYNCING ROOM {String(roomNumber).padStart(2, '0')}…</section>
        </div>
      </AppShell>
    );
  }

  if (!room) {
    const price = data?.next_room_unlock_price_diamond ?? 0;
    const bonus = data?.next_room_bonus_percent ?? 0;
    const tier = data?.next_room_label ?? 'ROOM';

    return (
      <AppShell>
        <div className={styles.page}>
          <section className={`${styles.lockPanel} ${styles.lockScene} ${styles[`theme_${ROOM_TIER_META[roomNumber]?.key ?? 'standard'}`]}`}>
            <div className={styles.lockOrb}><LockKeyhole size={28} /></div>
            <div className={styles.kicker}>ROOM {String(roomNumber).padStart(2, '0')} · LOCKED</div>
            <h1>{ROOM_TIER_META[roomNumber]?.name ?? tier}</h1>
            <p>{ROOM_TIER_META[roomNumber]?.description ?? 'Unlock this 12-slot Room to activate its unique visual environment and Room H/s bonus.'}</p>
            <div className={styles.lockBenefits}>
              <span><Boxes size={14} /> 12 slots</span>
              <span><Zap size={14} /> +{num(ROOM_TIER_META[roomNumber]?.bonus ?? bonus)}% H/s</span>
              <span>{ROOM_TIER_META[roomNumber]?.subtitle ?? tier}</span>
            </div>
            <div className={styles.lockFeatureGrid}>
              {(ROOM_TIER_META[roomNumber]?.features ?? []).map((feature) => (
                <span key={feature}><Sparkles size={12} /> {feature}</span>
              ))}
            </div>
            {isNextLockedRoom ? (
              <>
                <div className={styles.lockPrice}>💎 {num(price, 0)}</div>
                <button type="button" className={styles.openRoomBtn} disabled={busy === 'unlock'} onClick={() => void unlockRoom()}>
                  <LockKeyhole size={15} />
                  {busy === 'unlock' ? 'UNLOCKING…' : `UNLOCK ${tier}`}
                </button>
              </>
            ) : (
              <div className={styles.sequenceNote}>Unlock the previous Room first.</div>
            )}
            <Link href="/rooms/1" className={styles.secondaryBtn}>
              <ArrowLeft size={15} />
              BACK TO ROOM 01
            </Link>
          </section>
        </div>
      </AppShell>
    );
  }

  const slots = Array.from({ length: 12 }, (_, index) =>
    room.slots.find((slot) => slot.slot_index === index + 1) ?? null,
  );

  return (
    <AppShell>
      <div className={styles.page}>
        <nav className={styles.roomNav} aria-label="Room selector">
          {Array.from({ length: data?.max_rooms ?? 5 }, (_, index) => index + 1).map((number) => {
            const unlocked = data?.rooms.some((candidate) => candidate.room_number === number);
            return (
              <Link
                key={number}
                href={`/rooms/${number}`}
                className={number === room.room_number ? styles.roomNavItem : styles.backLink}
              >
                {unlocked ? <Sparkles size={11} /> : <LockKeyhole size={11} />}
                ROOM {String(number).padStart(2, '0')}
              </Link>
            );
          })}
        </nav>

        {message ? <section className={styles.message}>{message}</section> : null}

        <section className={roomTheme(room.room_level, room.visual_key)}>
          <div className={styles.sceneOverlay} />
          <div className={styles.sceneParticles} />
          <div className={styles.sceneStars} />

          <div className={styles.roomHeroContent}>
            <div>
              <div className={styles.kicker}>ROOM {String(room.room_number).padStart(2, '0')} · {ROOM_TIER_META[room.room_number]?.name ?? room.name}</div>
              <h1>{room.name}</h1>
              <p>{room.room_description}</p>
              <div className={styles.heroTags}>
                <span>{room.room_label}</span>
                <span><Zap size={13} /> +{num(room.room_bonus_percent)}% ROOM H/S</span>
                <span><Boxes size={13} /> 12 SLOTS</span>
              </div>
            </div>
            <div className={styles.heroOrbit}>
              <div className={styles.heroOrbitRing} />
              <div className={styles.heroCore}><Sparkles size={26} /></div>
            </div>
          </div>

          <div className={styles.roomStats}
          >
            <div><span>ACTIVE</span><b>{room.active_miners}</b></div>
            <div><span>SLOTS</span><b>{room.used_slots}/12</b></div>
            <div><span>ROOM EFFECTIVE H/S</span><b>{num(room.hashrate)} H/s</b></div>
            <div><span>POWER</span><b>{num(room.power_watts, 0)} W</b></div>
          </div>
        </section>

        <section className={styles.manualMergePanel}>
          <div>
            <div className={styles.kicker}>MANUAL MERGE</div>
            <h2>Tap two matching deployed miners</h2>
            <p>
              The room remains visible while you select miners. Matching level + miner type is required,
              and the server confirms both miners are in this same Room.
            </p>
          </div>
          <div className={styles.mergeActions}>
            <button type="button" className={styles.secondaryBtn} disabled={busy === 'merge'} onClick={() => void autoMerge()}>
              <GitMerge size={15} />
              {busy === 'merge' ? 'MERGING…' : 'AUTO MERGE ALL'}
            </button>
            {selectedIds.length === 2 ? (
              <button type="button" className={styles.primaryBtn} disabled={busy === 'merge'} onClick={() => void mergeSelected()}>
                <CheckCircle2 size={15} />
                {busy === 'merge' ? 'MERGING…' : 'MERGE SELECTED'}
              </button>
            ) : (
              <span className={styles.selectionHelp}>{selectedIds.length}/2 selected</span>
            )}
          </div>
        </section>

        <section className={styles.rackPanel}>
          <div className={styles.rackHead}>
            <div>
              <div className={styles.kicker}>12-SLOT MINING RACK</div>
              <h2>{room.name}</h2>
            </div>
            <Link href="/items" className={styles.secondaryBtn}>
              <Boxes size={14} />
              INVENTORY
            </Link>
          </div>

          <div className={styles.rackGrid} aria-label={`${room.name} 12 slot rack`}>
            {slots.map((slot, index) =>
              slot ? (
                <div key={slot.slot_index} className={`${styles.slotWrap} ${selectedIds.includes(slot.user_miner_id) ? styles.slotWrapSelected : ''}`}>
                  <button
                    type="button"
                    className={`${styles.slot} ${styles.slotFilled} ${selectedIds.includes(slot.user_miner_id) ? styles.slotSelected : ''}`}
                    onClick={() => selectForMerge(slot)}
                    aria-label={`Select ${slot.name}, level ${slot.level}, slot ${index + 1}`}
                  >
                    <div className={styles.slotIndex}>#{String(index + 1).padStart(2, '0')}</div>
                    <img src={imagePath(slot.image_path, slot.slug)} alt="" />
                    <div className={styles.slotShade} />
                    <div className={styles.slotText}>
                      <span>LV {slot.level}</span>
                      <b>{num(slot.room_effective_hashrate)} H/s</b>
                      <small>{statusText(slot.status)} · +{num(slot.bonus_hashrate_percent)}% miner · +{num(room.room_bonus_percent)}% room</small>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={styles.slotInfoButton}
                    aria-label={`Details for ${slot.name}`}
                    title="Miner details"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedIds([]);
                      setSelectedMiner(slot);
                    }}
                  >
                    <Info size={12} />
                  </button>
                </div>
              ) : (
                <div key={`empty-${index}`} className={`${styles.slot} ${styles.slotEmpty}`}>
                  <span className={styles.emptyPlus}>+</span>
                  <b>#{String(index + 1).padStart(2, '0')}</b>
                  <small>EMPTY SLOT</small>
                </div>
              ),
            )}
          </div>
        </section>

        <section className={styles.formulaPanel}>
          <div className={styles.formulaHeader}>
            <Sparkles size={17} />
            <div>
              <div className={styles.kicker}>HASHRATE PIPELINE</div>
              <h2>No double counting</h2>
            </div>
          </div>
          <div className={styles.formulaFlow}>
            <span>Miner Level H/s</span><ChevronRight size={14} />
            <span>Miner Bonus</span><ChevronRight size={14} />
            <span>Room +{num(room.room_bonus_percent)}%</span><ChevronRight size={14} />
            <span>Efficiency × Energy</span><ChevronRight size={14} />
            <span>Funded Pool Weight</span>
          </div>
        </section>

        {selectedMiner ? (
          <div className={styles.minerModalOverlay} role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && busy !== 'move') setSelectedMiner(null);
          }}>
            <section className={styles.minerModal} role="dialog" aria-modal="true" aria-labelledby="room-miner-detail-title">
              <button type="button" className={styles.minerModalClose} aria-label="Close miner details" disabled={busy === 'move'} onClick={() => setSelectedMiner(null)}>
                <X size={18} />
              </button>
              <div className={styles.minerModalArt}>
                <img src={imagePath(selectedMiner.image_path, selectedMiner.slug)} alt={`${selectedMiner.name} virtual miner`} />
                <span className={styles.minerModalTier}>{selectedMiner.tier}</span>
                <span className={styles.minerModalLevel}>LV {selectedMiner.level}/10</span>
              </div>
              <div className={styles.minerModalBody}>
                <div className={styles.kicker}>MINER DETAILS</div>
                <h2 id="room-miner-detail-title">{selectedMiner.name}</h2>
                <p>
                  This deployed miner is contributing its persisted miner bonus first, then the Room bonus second.
                  Mining settlement applies efficiency, energy, membership and the funded pool after this Room calculation.
                </p>
                <div className={styles.minerModalStats}>
                  <div><small>LEVEL</small><strong>LV {selectedMiner.level}/10</strong></div>
                  <div><small>MINER H/S</small><strong>{num(selectedMiner.hashrate)} H/s</strong></div>
                  <div><small>MINER BONUS</small><strong>+{num(selectedMiner.bonus_hashrate_percent)}%</strong></div>
                  <div><small>ROOM BONUS</small><strong>+{num(selectedMiner.room_bonus_percent)}%</strong></div>
                  <div><small>EFFECTIVE H/S</small><strong>{num(selectedMiner.room_effective_hashrate)} H/s</strong></div>
                  <div><small>STATE</small><strong>{statusText(selectedMiner.status)}</strong></div>
                </div>
                <button type="button" className={styles.returnBtn} disabled={busy === 'move'} onClick={() => void moveMinerToInventory(selectedMiner)}>
                  <Boxes size={15} />
                  {busy === 'move' ? 'MOVING…' : 'MOVE TO INVENTORY'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
