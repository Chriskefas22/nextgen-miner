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
  WalletCards,
  X,
  Zap,
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

type MergePreview = {
  miner_id: number;
  current_level: number;
  next_level: number;
  fee_diamond: number | null;
  next_hashrate: number;
  room_bonus_percent: number;
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
    description: 'Free 12-slot starter workspace. This is where every miner begins and where the first hashrate experience happens.',
    features: ['12 miner slots', 'Simple mining environment', 'Starter lighting + cooling', 'Room bonus +0% H/s'],
  },
  2: {
    name: 'ADVANCED ROOM',
    key: 'advanced',
    subtitle: 'Enhanced Mining Facility',
    bonus: 5,
    price: 25000,
    description: 'A brighter high-tech facility with active cooling, monitoring screens and moving equipment.',
    features: ['12 miner slots', '+5% Room H/s', 'Advanced cooling', 'Live monitoring', 'Dynamic fans + vents'],
  },
  3: {
    name: 'PREMIUM ROOM',
    key: 'premium',
    subtitle: 'Elite Reactor Chamber',
    bonus: 10,
    price: 75000,
    description: 'A neon reactor chamber with holographic displays, energy tubes and visible energy particles.',
    features: ['12 miner slots', '+10% Room H/s', 'Neon reactor core', 'Holographic controls', 'Energy tubes + particles'],
  },
  4: {
    name: 'LEGENDARY ROOM',
    key: 'legendary',
    subtitle: 'Legendary Power Chamber',
    bonus: 20,
    price: 250000,
    description: 'A high-output reactor environment with golden energy, stronger lighting and dynamic power beams.',
    features: ['12 miner slots', '+20% Room H/s', 'Golden reactor core', 'Dynamic energy beams', 'Legendary aura'],
  },
  5: {
    name: 'MYTHICAL ROOM',
    key: 'mythical',
    subtitle: 'Mythical Living Environment',
    bonus: 35,
    price: 750000,
    description: 'A living cosmic mining world filled with flowing energy, crystals, floating structures and nebula effects.',
    features: ['12 miner slots', '+35% Room H/s', 'Living cosmic environment', 'Energy crystals', 'Floating elements + nebula'],
  },
};

const LEVEL_TONE: Record<number, string> = {
  1: 'level1',
  2: 'level2',
  3: 'level3',
  4: 'level4',
  5: 'level5',
  6: 'level6',
  7: 'level7',
  8: 'level8',
  9: 'level9',
  10: 'level10',
};

const num = (value: number | string | null | undefined, digits = 1) =>
  Number(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: digits });

function imagePath(path: string | null, slug: string) {
  if (!path) return `/assets/miners/${slug}.webp`;
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('assets/')) return `/${clean}`;
  if (clean.startsWith('miners/')) return `/assets/${clean}`;
  return `/assets/miners/${slug}.webp`;
}

function minerLevelTone(level: number) {
  return LEVEL_TONE[Math.max(1, Math.min(10, Number(level) || 1))] ?? 'level1';
}

function statusText(status: string) {
  return status.toLowerCase() === 'active' ? 'MINING' : 'PAUSED';
}


export default function RoomDetailPage() {
  const params = useParams<{ roomNumber: string }>();
  const roomNumber = Number(params?.roomNumber ?? 0);

  const [data, setData] = useState<RoomsSnapshot | null>(null);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [diamondBalance, setDiamondBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'unlock' | 'merge' | 'move' | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedMiner, setSelectedMiner] = useState<Slot | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{
    title: string;
    detail: string;
  } | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!purchaseSuccess) return;

    const timeoutId = window.setTimeout(() => {
      setPurchaseSuccess(null);
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [purchaseSuccess]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sb = createClient();
      const [roomsResult, walletResult] = await Promise.all([
        sb.rpc('nextgen_rooms_snapshot'),
        sb.from('nextgen_wallets').select('diamond_balance').maybeSingle(),
      ]);

      if (roomsResult.error) throw roomsResult.error;
      if (walletResult.error) throw walletResult.error;

      setData(roomsResult.data as RoomsSnapshot);
      setDiamondBalance(Number(walletResult.data?.diamond_balance ?? 0));
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

  const roomMeta = ROOM_TIER_META[roomNumber] ?? ROOM_TIER_META[1];
  const nextRoom = data?.next_room_number ?? null;
  const isNextLockedRoom = !room && nextRoom === roomNumber;

  const firstSelected = useMemo(() => {
    if (!room || selectedIds.length === 0) return null;
    return room.slots.find((slot) => slot.user_miner_id === selectedIds[0]) ?? null;
  }, [room, selectedIds]);

  const loadMergePreview = useCallback(async (userMinerId: number) => {
    setPreviewLoading(true);
    setMergePreview(null);
    setMessage('');

    try {
      const sb = createClient();

      // Scalar JSON RPC: do not depend on PostgREST table-return shape.
      const result = await sb.rpc('nextgen_merge_preview_json', {
        p_user_miner_id: userMinerId,
      });

      if (result.error) throw result.error;

      const payload = result.data as {
        ok?: boolean;
        error_code?: string;
        miner_id?: number | string;
        current_level?: number | string;
        next_level?: number | string;
        fee_diamond?: number | string | null;
        next_hashrate?: number | string | null;
        room_bonus_percent?: number | string | null;
      } | null;

      if (!payload?.ok) {
        setMessage(
          'Merge preview was not returned by the server. The selected miner may no longer be eligible.',
        );
        return null;
      }

      const preview: MergePreview = {
        miner_id: Number(payload.miner_id),
        current_level: Number(payload.current_level),
        next_level: Number(payload.next_level),
        fee_diamond:
          payload.fee_diamond == null ? null : Number(payload.fee_diamond),
        next_hashrate: Number(payload.next_hashrate ?? 0),
        room_bonus_percent: Number(payload.room_bonus_percent ?? 0),
      };

      if (
        !Number.isFinite(preview.miner_id) ||
        !Number.isFinite(preview.current_level) ||
        !Number.isFinite(preview.next_level)
      ) {
        throw new Error('INVALID_MERGE_PREVIEW_PAYLOAD');
      }

      setMergePreview(preview);
      return preview;
    } catch (error) {
      setMergePreview(null);
      setMessage(
        error instanceof Error
          ? `Unable to load merge preview: ${error.message}`
          : 'Unable to load merge preview data.',
      );
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const selectedPair = useMemo(() => {
    if (!room || selectedIds.length !== 2) return null;
    const pair = selectedIds
      .map((id) => room.slots.find((slot) => slot.user_miner_id === id))
      .filter(Boolean) as Slot[];
    return pair.length === 2 ? pair : null;
  }, [room, selectedIds]);

  const matchingIds = useMemo(() => {
    if (!room || !firstSelected || selectedIds.length !== 1) return new Set<number>();

    return new Set(
      room.slots
        .filter(
          (slot) =>
            slot.user_miner_id !== firstSelected.user_miner_id &&
            slot.miner_id === firstSelected.miner_id &&
            slot.level === firstSelected.level,
        )
        .map((slot) => slot.user_miner_id),
    );
  }, [room, firstSelected]);

  const mergeFee = useMemo<number | null>(() => {
    if (!firstSelected || !mergePreview) return null;

    if (
      mergePreview.miner_id !== firstSelected.miner_id ||
      mergePreview.current_level !== firstSelected.level ||
      mergePreview.next_level !== firstSelected.level + 1
    ) {
      return null;
    }

    return mergePreview.fee_diamond == null
      ? null
      : Number(mergePreview.fee_diamond);
  }, [firstSelected, mergePreview]);

  const nextBaseHashrate = useMemo(() => {
    if (!firstSelected || !mergePreview) return 0;

    if (
      mergePreview.miner_id !== firstSelected.miner_id ||
      mergePreview.current_level !== firstSelected.level ||
      mergePreview.next_level !== firstSelected.level + 1
    ) {
      return 0;
    }

    return Number(mergePreview.next_hashrate ?? 0);
  }, [firstSelected, mergePreview]);

  const nextEffectiveHashrate = useMemo(() => {
    if (!firstSelected) return 0;
    return (
      nextBaseHashrate *
      (1 + Number(firstSelected.room_bonus_percent ?? 0) / 100)
    );
  }, [firstSelected, nextBaseHashrate]);

  const mergeAffordable = mergeFee != null && mergeFee > 0 && diamondBalance >= mergeFee;

  async function unlockRoom() {
    if (busy || !isNextLockedRoom) return;

    setBusy('unlock');
    setMessage('');

    try {
      const result = await createClient().rpc('nextgen_create_room');
      if (result.error) throw result.error;

      setPurchaseSuccess({
        title: 'Purchase Successful!',
        detail: `Room ${String(result.data?.room_number ?? roomNumber).padStart(2, '0')} has been unlocked and is ready for your miners.`,
      });

      window.dispatchEvent(new Event('nextgen:sync'));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Room unlock failed.');
    } finally {
      setBusy(null);
    }
  }

  async function selectForMerge(slot: Slot) {
    setMessage('');
    setSelectedMiner(slot);

    if (selectedIds.includes(slot.user_miner_id)) {
      setSelectedIds((current) =>
        current.filter((id) => id !== slot.user_miner_id),
      );
      setMergeOpen(false);
      setMergePreview(null);
      return;
    }

    if (selectedIds.length === 0) {
      setSelectedIds([slot.user_miner_id]);
      setMergeOpen(false);
      await loadMergePreview(slot.user_miner_id);
      return;
    }

    if (selectedIds.length >= 2) {
      setSelectedIds([slot.user_miner_id]);
      setMergeOpen(false);
      await loadMergePreview(slot.user_miner_id);
      return;
    }

    const first = room?.slots.find(
      (candidate) => candidate.user_miner_id === selectedIds[0],
    );

    const matches = Boolean(
      first &&
      first.miner_id === slot.miner_id &&
      first.level === slot.level,
    );

    if (matches && first) {
      setSelectedIds((current) => [...current, slot.user_miner_id]);

      const preview = await loadMergePreview(first.user_miner_id);
      setMergeOpen(
        Boolean(
          preview &&
          preview.current_level === first.level &&
          preview.next_level === first.level + 1,
        ),
      );
      return;
    }

    setMessage(
      'This miner is not a valid partner. Matching miners are highlighted automatically.',
    );
  }

  async function mergeSelected() {
    if (!room || busy || selectedIds.length !== 2 || !selectedPair) return;

    if (mergeFee == null || mergeFee <= 0) {
      setMessage('Merge fee data is unavailable for this miner level. Refresh before merging.');
      return;
    }

    if (!mergeAffordable) {
      setMessage(
        `Insufficient Diamond. Merge needs ${num(mergeFee, 0)} 💎 and your balance is ${num(diamondBalance, 0)} 💎.`,
      );
      return;
    }

    setBusy('merge');
    setMessage('');

    try {
      const result = await createClient().rpc('nextgen_merge_miners', {
        p_first_user_miner_id: selectedIds[0],
        p_second_user_miner_id: selectedIds[1],
      });

      if (result.error) throw result.error;

      const payload = result.data as {
        to_level?: number;
        hashrate?: number;
        bonus_hashrate_percent?: number;
        room_bonus_percent?: number;
      } | null;

      setMergeOpen(false);
      setSelectedIds([]);
      setSelectedMiner(null);
      setMergePreview(null);

      setPurchaseSuccess({
        title: 'Merge Successful!',
        detail: `${selectedPair[0].name} has been merged to Level ${payload?.to_level ?? selectedPair[0].level + 1}. Fee paid: ${num(mergeFee, 0)} 💎.`,
      });

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
    setMergeOpen(false);
    setMessage('');

    try {
      const result = await createClient().rpc('nextgen_merge_all_ready', {
        p_room_id: room.id,
      });

      if (result.error) throw result.error;

      const count = Number(
        (result.data as { merged_count?: number } | null)?.merged_count ?? 0,
      );

      if (count > 0) {
        setPurchaseSuccess({
          title: 'Purchase Successful!',
          detail: `${count} merge${count === 1 ? '' : 's'} completed automatically.`,
        });
      } else {
        setMessage('No matching pairs are ready in this Room.');
      }

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

      setSelectedIds((current) =>
        current.filter((id) => id !== slot.user_miner_id),
      );
      setSelectedMiner(null);
      setMergeOpen(false);
      setMessage(`${slot.name} moved to Inventory.`);
      window.dispatchEvent(new Event('nextgen:sync'));
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to move miner to Inventory.',
      );
    } finally {
      setBusy(null);
    }
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

  if (!data || roomNumber < 1 || roomNumber > data.max_rooms) {
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

  if (!room) {
    const meta = ROOM_TIER_META[roomNumber] ?? ROOM_TIER_META[2];

    return (
      <AppShell>
        <div className={styles.page}>
          <section
            className={`${styles.lockPanel} ${styles[`theme_${meta.key}`]}`}
          >
            <div className={styles.lockOrb}>
              <LockKeyhole size={28} />
            </div>

            <div className={styles.kicker}>
              ROOM {String(roomNumber).padStart(2, '0')} · LOCKED
            </div>

            <h1>{meta.name}</h1>
            <p>{meta.description}</p>

            <div className={styles.lockBenefits}>
              <span><Boxes size={14} /> 12 slots</span>
              <span><Zap size={14} /> +{meta.bonus}% Room H/s</span>
              <span>{meta.subtitle}</span>
            </div>

            <div className={styles.lockFeatureGrid}>
              {meta.features.map((feature) => (
                <span key={feature}>
                  <Sparkles size={12} />
                  {feature}
                </span>
              ))}
            </div>

            {isNextLockedRoom ? (
              <>
                <div className={styles.lockPrice}>
                  💎 {num(data.next_room_unlock_price_diamond, 0)}
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
                    : `UNLOCK ${meta.name}`}
                </button>
              </>
            ) : (
              <div className={styles.sequenceNote}>
                Unlock the previous Room first.
              </div>
            )}

            <Link href="/rooms/1" className={styles.secondaryBtn}>
              <ArrowLeft size={15} />
              BACK TO ROOM 01
            </Link>
          </section>
        </div>

        {purchaseSuccess ? (
          <SuccessToast
            title={purchaseSuccess.title}
            detail={purchaseSuccess.detail}
            onClose={() => setPurchaseSuccess(null)}
          />
        ) : null}
      </AppShell>
    );
  }

  const slots = Array.from(
    { length: 12 },
    (_, index) =>
      room.slots.find((slot) => slot.slot_index === index + 1) ?? null,
  );

  return (
    <AppShell>
      <div
        className={`${styles.page} ${styles[`roomPage_${roomMeta.key}`]}`}
      >
        <nav className={styles.roomNav} aria-label="Room selector">
          {Array.from({ length: data.max_rooms }, (_, index) => index + 1).map(
            (number) => {
              const unlocked = data.rooms.some(
                (candidate) => candidate.room_number === number,
              );

              return (
                <Link
                  key={number}
                  href={`/rooms/${number}`}
                  className={
                    number === room.room_number
                      ? styles.roomNavItem
                      : styles.backLink
                  }
                >
                  {unlocked ? (
                    <Sparkles size={11} />
                  ) : (
                    <LockKeyhole size={11} />
                  )}
                  ROOM {String(number).padStart(2, '0')}
                </Link>
              );
            },
          )}
        </nav>

        {message ? <section className={styles.message}>{message}</section> : null}

        <section
          className={`${styles.roomScene} ${styles[`theme_${roomMeta.key}`]}`}
        >
          <div className={styles.sceneOverlay} />
          <div className={styles.sceneParticles} />
          <div className={styles.sceneStars} />

          <div className={styles.roomHeroContent}>
            <div>
              <div className={styles.kicker}>
                ROOM {String(room.room_number).padStart(2, '0')} ·{' '}
                {roomMeta.name}
              </div>

              <h1>{roomMeta.name}</h1>
              <p>{roomMeta.description}</p>

              <div className={styles.heroTags}>
                <span>{roomMeta.subtitle}</span>
                <span>
                  <Zap size={13} /> +{roomMeta.bonus}% ROOM H/S
                </span>
                <span>
                  <Boxes size={13} /> 12 SLOTS
                </span>
              </div>
            </div>

            <div className={styles.heroOrbit} aria-hidden="true">
              <div className={styles.heroOrbitRing} />
              <div className={styles.heroCore}>
                <Sparkles size={26} />
              </div>
            </div>
          </div>

          <div className={styles.roomStats}>
            <div>
              <span>ACTIVE</span>
              <b>{room.active_miners}</b>
            </div>
            <div>
              <span>SLOTS</span>
              <b>{room.used_slots}/12</b>
            </div>
            <div>
              <span>ROOM EFFECTIVE H/S</span>
              <b>{num(room.hashrate)} H/s</b>
            </div>
            <div>
              <span>POWER</span>
              <b>{num(room.power_watts, 0)} W</b>
            </div>
          </div>
        </section>

        <section className={styles.manualMergePanel}>
          <div>
            <div className={styles.kicker}>MANUAL MERGE</div>
            <h2>
              {selectedIds.length === 0
                ? 'Tap a miner to find its match'
                : selectedIds.length === 1
                  ? 'Matching miners are flashing'
                  : 'Two miners selected'}
            </h2>
            <p>
              Tap one miner. Matching miners of the same type and level will
              glow and pulse. Tap the highlighted second miner to open the
              purchase confirmation.
            </p>
          </div>

          <div className={styles.mergeActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy === 'merge'}
              onClick={() => void autoMerge()}
            >
              <GitMerge size={15} />
              {busy === 'merge' ? 'MERGING…' : 'AUTO MERGE ALL'}
            </button>

            {selectedIds.length === 1 ? (
              <span className={styles.selectionHelp}>
                <Sparkles size={12} />
                {matchingIds.size} matching miner
                {matchingIds.size === 1 ? '' : 's'} highlighted
              </span>
            ) : (
              <span className={styles.selectionHelp}>
                {selectedIds.length}/2 selected
              </span>
            )}
          </div>
        </section>

        <section className={styles.rackPanel}>
          <div className={styles.rackHead}>
            <div>
              <div className={styles.kicker}>12-SLOT MINING RACK</div>
              <h2>{roomMeta.name}</h2>
            </div>

            <Link href="/items" className={styles.secondaryBtn}>
              <Boxes size={14} />
              INVENTORY
            </Link>
          </div>

          <div
            className={styles.rackGrid}
            aria-label={`${roomMeta.name} 12 slot rack`}
          >
            {slots.map((slot, index) => {
              if (!slot) {
                return (
                  <div
                    key={`empty-${index}`}
                    className={`${styles.slot} ${styles.slotEmpty}`}
                  >
                    <span className={styles.emptyPlus}>+</span>
                    <b>#{String(index + 1).padStart(2, '0')}</b>
                    <small>EMPTY SLOT</small>
                  </div>
                );
              }

              const levelTone = minerLevelTone(slot.level);
              const selected = selectedIds.includes(slot.user_miner_id);
              const isMatch = matchingIds.has(slot.user_miner_id);
              const isFirst = firstSelected?.user_miner_id === slot.user_miner_id;

              return (
                <div
                  key={slot.slot_index}
                  className={[
                    styles.slotWrap,
                    selected ? styles.slotWrapSelected : '',
                    isMatch ? styles.slotMatch : '',
                    isFirst ? styles.slotFirst : '',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    className={[
                      styles.slot,
                      styles.slotFilled,
                      styles[levelTone],
                      selected ? styles.slotSelected : '',
                      isMatch ? styles.slotMatching : '',
                    ].join(' ')}
                    onClick={() => void selectForMerge(slot)}
                    aria-label={`Select ${slot.name}, level ${slot.level}, slot ${index + 1}`}
                  >
                    {isMatch ? (
                      <span className={styles.matchBadge}>
                        <Sparkles size={10} />
                        MATCH
                      </span>
                    ) : null}

                    <div className={styles.slotIndex}>
                      #{String(index + 1).padStart(2, '0')}
                    </div>

                    <div className={styles.levelFrame}>
                      <span>LV {slot.level}</span>
                    </div>

                    <img
                      src={imagePath(slot.image_path, slot.slug)}
                      alt=""
                    />

                    <div className={styles.slotShade} />

                    <div className={styles.slotText}>
                      <b>{num(slot.room_effective_hashrate)} H/s</b>
                      <small>
                        {statusText(slot.status)} · Miner +{num(slot.bonus_hashrate_percent)}% · Room +{num(slot.room_bonus_percent)}%
                      </small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={styles.slotInfoButton}
                    aria-label={`Show details for ${slot.name}`}
                    title="Miner details"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedMiner(slot);
                      setSelectedIds([slot.user_miner_id]);
                      setMergeOpen(false);
                      void loadMergePreview(slot.user_miner_id);
                      window.setTimeout(() => {
                        document
                          .getElementById('selected-miner-panel')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }, 30);
                    }}
                  >
                    <Info size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {selectedMiner ? (
          <section
            id="selected-miner-panel"
            className={`${styles.selectedMinerPanel} ${styles[`panel_${minerLevelTone(selectedMiner.level)}`]}`}
          >
            <div className={styles.selectedMinerHeader}>
              <div>
                <div className={styles.kicker}>SELECTED MINER</div>
                <h2>{selectedMiner.name}</h2>
              </div>

              <button
                type="button"
                className={styles.selectedMinerClose}
                onClick={() => {
                  setSelectedMiner(null);
                  setSelectedIds([]);
                  setMergeOpen(false);
                }}
                aria-label="Clear selected miner"
              >
                <X size={15} />
              </button>
            </div>

            <div className={styles.selectedMinerGrid}>
              <div className={styles.selectedMinerArt}>
                <img
                  src={imagePath(selectedMiner.image_path, selectedMiner.slug)}
                  alt=""
                />
                <span className={`${styles.levelChip} ${styles[minerLevelTone(selectedMiner.level)]}`}>
                  LV {selectedMiner.level}/10
                </span>
              </div>

              <div className={styles.selectedMinerDetails}>
                <div>
                  <span>BASE HASHRATE</span>
                  <b>{num(selectedMiner.hashrate)} H/s</b>
                </div>
                <div>
                  <span>MINER BONUS</span>
                  <b>+{num(selectedMiner.bonus_hashrate_percent)}%</b>
                </div>
                <div>
                  <span>ROOM BONUS</span>
                  <b>+{num(selectedMiner.room_bonus_percent)}%</b>
                </div>
                <div>
                  <span>EFFECTIVE H/S</span>
                  <b>{num(selectedMiner.room_effective_hashrate)} H/s</b>
                </div>
                <div>
                  <span>POWER</span>
                  <b>{num(selectedMiner.power_watts, 0)} W</b>
                </div>
                <div>
                  <span>STATUS</span>
                  <b>{statusText(selectedMiner.status)}</b>
                </div>
              </div>
            </div>

            {selectedIds.length === 1 ? (
              <div className={styles.selectedMinerHint}>
                <Sparkles size={14} />
                {matchingIds.size > 0
                  ? 'Matching miners are glowing above. Tap one to continue.'
                  : 'No matching miner is currently available in this Room.'}
              </div>
            ) : null}

            {selectedPair ? (
              <div className={styles.inlinePair}>
                <span>READY</span>
                <b>
                  {selectedPair[0].name} · LV {selectedPair[0].level}
                </b>
                <ChevronRight size={15} />
                <b>LV {selectedPair[0].level + 1}</b>
                <span className={mergeFee != null ? (mergeAffordable ? styles.affordable : styles.insufficient) : styles.insufficient}>
                  {mergeFee == null ? 'FEE UNAVAILABLE' : `💎 ${num(mergeFee, 0)}`}
                </span>
              </div>
            ) : null}

            <button
              type="button"
              className={styles.moveButton}
              disabled={busy === 'move'}
              onClick={() => void moveMinerToInventory(selectedMiner)}
            >
              <Boxes size={14} />
              {busy === 'move' ? 'MOVING…' : 'MOVE TO INVENTORY'}
            </button>
          </section>
        ) : null}

        <section className={styles.formulaPanel}>
          <div className={styles.formulaHeader}>
            <Sparkles size={17} />
            <div>
              <div className={styles.kicker}>HASHRATE PIPELINE</div>
              <h2>Miner H/s → Room bonus → funded pool</h2>
            </div>
          </div>

          <div className={styles.formulaFlow}>
            <span>Miner Level H/s</span>
            <ChevronRight size={14} />
            <span>Miner Bonus</span>
            <ChevronRight size={14} />
            <span>Room +{roomMeta.bonus}%</span>
            <ChevronRight size={14} />
            <span>Efficiency × Energy</span>
            <ChevronRight size={14} />
            <span>Funded Pool Weight</span>
          </div>
        </section>

        {mergeOpen && selectedPair ? (
          <div
            className={styles.mergeModalOverlay}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && busy !== 'merge') {
                setMergeOpen(false);
              }
            }}
          >
            <section
              className={`${styles.mergeConfirmModal} ${styles[`modal_${minerLevelTone(selectedPair[0].level)}`]}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="merge-confirm-title"
            >
              <button
                type="button"
                className={styles.mergeModalClose}
                aria-label="Close merge confirmation"
                onClick={() => busy !== 'merge' && setMergeOpen(false)}
                disabled={busy === 'merge'}
              >
                <X size={18} />
              </button>

              <div className={styles.mergeConfirmHead}>
                <div className={styles.mergeIcon}>
                  <GitMerge size={21} />
                </div>
                <div>
                  <div className={styles.kicker}>MERGE PURCHASE</div>
                  <h2 id="merge-confirm-title">Confirm Merge</h2>
                  <p>
                    Merge two {selectedPair[0].name} miners at Level {selectedPair[0].level} into Level {selectedPair[0].level + 1}.
                  </p>
                </div>
              </div>

              <div className={styles.mergePairGrid}>
                {selectedPair.map((slot) => (
                  <div
                    className={`${styles.mergePairCard} ${styles[minerLevelTone(slot.level)]}`}
                    key={slot.user_miner_id}
                  >
                    <span>MINER</span>
                    <img src={imagePath(slot.image_path, slot.slug)} alt="" />
                    <b>LV {slot.level}</b>
                    <small>{num(slot.room_effective_hashrate)} H/s effective</small>
                  </div>
                ))}
              </div>

              <div className={styles.mergeArrow}>
                <span>LV {selectedPair[0].level}</span>
                <ChevronRight size={18} />
                <b>LV {selectedPair[0].level + 1}</b>
              </div>

              <div className={styles.mergeResultCard}>
                <div>
                  <span>NEXT BASE H/S</span>
                  <strong>{num(nextBaseHashrate)} H/s</strong>
                </div>
                <div>
                  <span>ROOM BONUS</span>
                  <strong>+{num(selectedPair[0].room_bonus_percent)}%</strong>
                </div>
                <div>
                  <span>NEXT EFFECTIVE H/S</span>
                  <strong>{num(nextEffectiveHashrate)} H/s</strong>
                </div>
              </div>

              <div className={styles.mergeCostBox}>
                <div>
                  <WalletCards size={15} />
                  <span>MERGE COST</span>
                </div>
                <strong>
                  {previewLoading
                    ? 'LOADING…'
                    : mergeFee == null
                      ? 'FEE UNAVAILABLE'
                      : `💎 ${num(mergeFee, 0)}`}
                </strong>
              </div>

              <div className={styles.balanceLine}>
                <span>YOUR BALANCE</span>
                <b className={mergeAffordable ? styles.affordable : styles.insufficient}>
                  💎 {num(diamondBalance, 0)}
                </b>
              </div>

              <div className={styles.mergeGuarantee}>
                <CheckCircle2 size={14} />
                <span>
                  Success rate: <b>100%</b> · New miner bonus is rolled by the server after a successful merge.
                </span>
              </div>

              {previewLoading ? (
                <div className={styles.insufficientBox}>
                  Loading the server merge fee…
                </div>
              ) : mergeFee == null ? (
                <div className={styles.insufficientBox}>
                  Merge fee data is unavailable for this miner level. Refresh before merging.
                </div>
              ) : !mergeAffordable ? (
                <div className={styles.insufficientBox}>
                  Insufficient Diamond. You need {num(Math.max(mergeFee - diamondBalance, 0), 0)} 💎 more.
                </div>
              ) : null}

              <div className={styles.mergeConfirmActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={
                    busy === 'merge' ||
                    previewLoading ||
                    !mergeAffordable ||
                    mergeFee == null
                  }
                  onClick={() => void mergeSelected()}
                >
                  <GitMerge size={15} />
                  {busy === 'merge'
                    ? 'MERGING…'
                    : previewLoading
                      ? 'LOADING…'
                      : mergeFee == null
                        ? 'FEE UNAVAILABLE'
                        : mergeAffordable
                          ? `MERGE · 💎 ${num(mergeFee, 0)}`
                          : 'INSUFFICIENT DIAMOND'}
                </button>

                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => !busy && setMergeOpen(false)}
                  disabled={busy === 'merge'}
                >
                  Cancel
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {purchaseSuccess ? (
          <SuccessToast
            title={purchaseSuccess.title}
            detail={purchaseSuccess.detail}
            onClose={() => setPurchaseSuccess(null)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function SuccessToast({
  title,
  detail,
  onClose,
}: {
  title: string;
  detail: string;
  onClose: () => void;
}) {
  return (
    <div className={styles.successToast} role="status">
      <div className={styles.successIcon}>
        <CheckCircle2 size={21} />
      </div>
      <div className={styles.successCopy}>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <button type="button" onClick={onClose} aria-label="Close success message">
        <X size={15} />
      </button>
    </div>
  );
}
