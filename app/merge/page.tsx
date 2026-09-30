'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Boxes, CheckCircle2, CircleAlert, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import styles from './MergePage.module.css';

type Miner = {
  id: number;
  miner_id: number;
  name: string;
  tier: string;
  current_level: number;
  hashrate: number;
  next_hashrate: number | null;
  power_watts: number;
  cumulative_value_diamond: number;
  bonus_hashrate_percent: number;
  deployment_state: 'inventory' | 'deployed' | string;
  room_id: number | null;
  room_number: number | null;
  slot_index: number | null;
  image_path: string | null;
};

type FeeRow = {
  miner_id: number | string;
  from_level: number | string;
  to_level: number | string;
  fee_diamond: number | string;
};

type LevelRow = {
  miner_id: number | string;
  level: number | string;
  hashrate: number | string;
  cumulative_price_diamond: number | string;
};

type RoomSnapshot = {
  rooms?: Array<{
    id: number | string;
    room_number: number | string;
    slots?: Array<{
      user_miner_id: number | string;
      slot_index: number | string;
    }>;
  }>;
};

type Notice =
  | { type: 'success' | 'error'; text: string }
  | null;

const money = (value: number, digits = 0) =>
  Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: digits,
  });

function imagePath(path: string | null, name: string) {
  if (!path) {
    return `/assets/miners/${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.webp`;
  }

  const cleaned = path.replace(/^\/+/, '');
  if (cleaned.startsWith('assets/')) return `/${cleaned}`;
  return `/assets/${cleaned}`;
}

function levelClass(level: number) {
  return styles[`level${Math.min(Math.max(level, 1), 10)}` as keyof typeof styles];
}

export default function MergePage() {
  const [miners, setMiners] = useState<Miner[]>([]);
  const [fees, setFees] = useState<Record<string, number>>({});
  const [diamondBalance, setDiamondBalance] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedMiners = useMemo(
    () =>
      selectedIds
        .map((id) => miners.find((miner) => miner.id === id))
        .filter(Boolean) as Miner[],
    [miners, selectedIds],
  );

  const selectedMiner = selectedMiners[0] ?? null;
  const secondMiner = selectedMiners[1] ?? null;

  const mergeFee = useMemo(() => {
    if (!selectedMiner || selectedMiner.current_level >= 10) return null;
    return fees[`${selectedMiner.miner_id}:${selectedMiner.current_level}`] ?? null;
  }, [fees, selectedMiner]);

  const matchingIds = useMemo(() => {
    if (!selectedMiner || selectedIds.length !== 1) return new Set<number>();

    return new Set(
      miners
        .filter(
          (miner) =>
            miner.id !== selectedMiner.id &&
            miner.deployment_state === 'deployed' &&
            selectedMiner.deployment_state === 'deployed' &&
            miner.miner_id === selectedMiner.miner_id &&
            miner.current_level === selectedMiner.current_level &&
            miner.room_id != null &&
            selectedMiner.room_id != null &&
            miner.room_id === selectedMiner.room_id,
        )
        .map((miner) => miner.id),
    );
  }, [miners, selectedIds, selectedMiner]);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setNotice({
          type: 'error',
          text: 'Please sign in to use Merge Center.',
        });
        return;
      }

      const [minersResult, feeResult, levelsResult, catalogResult, roomsResult, walletResult] =
        await Promise.all([
          supabase
            .from('nextgen_user_miners')
            .select(
              [
                'id',
                'miner_id',
                'current_level',
                'is_merged',
                'status',
                'deployment_state',
                'bonus_hashrate_percent',
              ].join(','),
            )
            .eq('user_id', user.id)
            .eq('is_merged', false)
            .order('activated_at', { ascending: true }),

          // Explicitly pass the named bigint argument so PostgREST selects
          // nextgen_merge_fee_snapshot(bigint), not the legacy no-arg overload.
          supabase.rpc('nextgen_merge_fee_snapshot', { p_miner_id: null }),

          supabase
            .from('nextgen_miner_levels')
            .select('miner_id,level,hashrate,cumulative_price_diamond')
            .order('miner_id')
            .order('level'),

          supabase
            .from('nextgen_miner_catalog')
            .select('id,name,tier,image_path,base_power_watts')
            .eq('enabled', true),

          supabase.rpc('nextgen_rooms_snapshot'),

          supabase
            .from('nextgen_wallets')
            .select('diamond_balance')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

      if (minersResult.error) throw minersResult.error;
      if (feeResult.error) throw feeResult.error;
      if (levelsResult.error) throw levelsResult.error;
      if (catalogResult.error) throw catalogResult.error;
      if (roomsResult.error) throw roomsResult.error;
      if (walletResult.error) throw walletResult.error;

      const catalog = new Map<
        number,
        {
          name: string;
          tier: string;
          image_path: string | null;
          base_power_watts: number;
        }
      >();

      for (const row of Array.isArray(catalogResult.data) ? catalogResult.data : []) {
        catalog.set(Number(row.id), {
          name: String(row.name ?? `Miner #${row.id}`),
          tier: String(row.tier ?? ''),
          image_path: row.image_path ? String(row.image_path) : null,
          base_power_watts: Number(row.base_power_watts ?? 0),
        });
      }

      const levels = new Map<
        string,
        { hashrate: number; cumulative_price_diamond: number }
      >();

      for (const row of (Array.isArray(levelsResult.data) ? levelsResult.data : []) as LevelRow[]) {
        levels.set(`${Number(row.miner_id)}:${Number(row.level)}`, {
          hashrate: Number(row.hashrate ?? 0),
          cumulative_price_diamond: Number(row.cumulative_price_diamond ?? 0),
        });
      }

      const feeMap: Record<string, number> = {};
      for (const row of (Array.isArray(feeResult.data) ? feeResult.data : []) as FeeRow[]) {
        feeMap[`${Number(row.miner_id)}:${Number(row.from_level)}`] = Number(row.fee_diamond ?? 0);
      }

      const roomByMiner = new Map<
        number,
        { room_id: number; room_number: number; slot_index: number }
      >();

      const snapshot = (roomsResult.data ?? {}) as RoomSnapshot;
      for (const room of Array.isArray(snapshot.rooms) ? snapshot.rooms : []) {
        const roomId = Number(room.id);
        const roomNumber = Number(room.room_number);

        for (const slot of Array.isArray(room.slots) ? room.slots : []) {
          roomByMiner.set(Number(slot.user_miner_id), {
            room_id: roomId,
            room_number: roomNumber,
            slot_index: Number(slot.slot_index),
          });
        }
      }

      const mappedMiners: Miner[] = (Array.isArray(minersResult.data) ? minersResult.data : []).map(
        (row) => {
          const minerId = Number(row.miner_id);
          const level = Number(row.current_level);
          const current = levels.get(`${minerId}:${level}`);
          const next = levels.get(`${minerId}:${level + 1}`);
          const catalogRow = catalog.get(minerId);
          const room = roomByMiner.get(Number(row.id));

          return {
            id: Number(row.id),
            miner_id: minerId,
            name: catalogRow?.name ?? `Miner #${minerId}`,
            tier: catalogRow?.tier ?? '',
            current_level: level,
            hashrate: current?.hashrate ?? 0,
            next_hashrate: next?.hashrate ?? null,
            power_watts: catalogRow?.base_power_watts ?? 0,
            cumulative_value_diamond: current?.cumulative_price_diamond ?? 0,
            bonus_hashrate_percent: Number(row.bonus_hashrate_percent ?? 0),
            deployment_state: String(row.deployment_state ?? 'inventory'),
            room_id: room?.room_id ?? null,
            room_number: room?.room_number ?? null,
            slot_index: room?.slot_index ?? null,
            image_path: catalogRow?.image_path ?? null,
          };
        },
      );

      setFees(feeMap);
      setMiners(mappedMiners);
      setDiamondBalance(Number(walletResult.data?.diamond_balance ?? 0));
      setSelectedIds([]);
      setConfirmOpen(false);
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to load Merge Center.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectMiner = (miner: Miner) => {
    setNotice(null);

    if (miner.current_level >= 10) {
      setNotice({
        type: 'error',
        text: `${miner.name} is already Level 10 MAX.`,
      });
      return;
    }

    if (miner.deployment_state !== 'deployed' || miner.room_id == null) {
      setSelectedIds([miner.id]);
      setNotice({
        type: 'error',
        text: 'This miner must be deployed in a Room before it can be merged.',
      });
      return;
    }

    if (selectedIds.includes(miner.id)) {
      setSelectedIds(selectedIds.filter((id) => id !== miner.id));
      return;
    }

    if (selectedIds.length === 0) {
      setSelectedIds([miner.id]);
      return;
    }

    const first = miners.find((item) => item.id === selectedIds[0]);

    if (!first) {
      setSelectedIds([miner.id]);
      return;
    }

    const compatible =
      first.miner_id === miner.miner_id &&
      first.current_level === miner.current_level &&
      first.deployment_state === 'deployed' &&
      miner.deployment_state === 'deployed' &&
      first.room_id != null &&
      miner.room_id != null &&
      first.room_id === miner.room_id;

    if (!compatible) {
      setNotice({
        type: 'error',
        text: 'Select a matching miner of the same type and level in the same Room.',
      });
      return;
    }

    setSelectedIds([first.id, miner.id]);

    if (fees[`${miner.miner_id}:${miner.current_level}`] == null) {
      setNotice({
        type: 'error',
        text: 'Merge fee is not configured for this miner level.',
      });
      return;
    }

    setConfirmOpen(true);
  };

  const cancelMerge = () => {
    setConfirmOpen(false);

    if (selectedMiners.length >= 2) {
      setSelectedIds([selectedMiners[0].id]);
    }
  };

  const confirmMerge = async () => {
    if (!selectedMiner || !secondMiner || mergeFee == null || busy) return;

    setBusy(true);
    setNotice(null);

    try {
      const result = await createClient().rpc('nextgen_merge_miners', {
        p_first_user_miner_id: selectedMiner.id,
        p_second_user_miner_id: secondMiner.id,
      });

      if (result.error) throw result.error;

      const payload = (result.data ?? {}) as {
        to_level?: number;
        merge_fee_diamond?: number;
      };

      setConfirmOpen(false);
      setSelectedIds([]);

      setNotice({
        type: 'success',
        text: `${selectedMiner.name} merged successfully to Level ${
          payload.to_level ?? selectedMiner.current_level + 1
        }. Fee charged: 💎 ${money(
          Number(payload.merge_fee_diamond ?? mergeFee),
        )}.`,
      });

      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Merge failed.';

      setNotice({
        type: 'error',
        text:
          message.includes('INSUFFICIENT_DIAMOND')
            ? 'Insufficient Diamond balance for this merge.'
            : message,
      });
    } finally {
      setBusy(false);
    }
  };

  const displayedMiners = useMemo(
    () =>
      [...miners].sort((a, b) => {
        if (a.deployment_state === 'deployed' && b.deployment_state !== 'deployed') return -1;
        if (a.deployment_state !== 'deployed' && b.deployment_state === 'deployed') return 1;
        return a.id - b.id;
      }),
    [miners],
  );

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">MINER MANAGEMENT</div>
          <h1 className="page-title">Merge Center</h1>
          <div className="muted">
            Tap one miner to select it. Matching miners in the same Room will
            highlight automatically.
          </div>
        </div>

        <div className={styles.balancePill}>
          <span>DIAMOND</span>
          <b>💎 {money(diamondBalance)}</b>
        </div>
      </div>

      {notice ? (
        <div
          className={`${styles.notice} ${
            notice.type === 'success' ? styles.noticeSuccess : styles.noticeError
          }`}
          role="status"
        >
          {notice.type === 'success' ? (
            <CheckCircle2 size={17} />
          ) : (
            <CircleAlert size={17} />
          )}
          <span>{notice.text}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="glass section">SYNCING MERGE ENGINE…</div>
      ) : miners.length === 0 ? (
        <section className="glass section">
          <div className="eyebrow">NO MINERS</div>
          <h2>There are no miners available for Merge Center.</h2>
          <p className="muted">
            Buy miners from Shop and deploy two identical copies into the same Room.
          </p>
        </section>
      ) : (
        <>
          <section className={styles.helper}>
            <div>
              <div className="eyebrow">MERGE WORKSHOP</div>
              <strong>✨ Tap two matching rigs to merge.</strong>
            </div>
            <div className={styles.helperStats}>
              <span>{miners.filter((miner) => miner.deployment_state === 'deployed').length} deployed</span>
              <span>Lv10 cannot merge</span>
            </div>
          </section>

          <section className={styles.minerGrid} aria-label="Miner selection">
            {displayedMiners.map((miner) => {
              const selected = selectedIds.includes(miner.id);
              const compatible = matchingIds.has(miner.id);
              const unavailable = miner.deployment_state !== 'deployed' || miner.room_id == null;

              return (
                <button
                  key={miner.id}
                  type="button"
                  className={`${styles.minerCard} ${levelClass(miner.current_level)} ${
                    selected ? styles.selected : ''
                  } ${compatible ? styles.compatible : ''} ${
                    unavailable ? styles.unavailable : ''
                  }`}
                  onClick={() => selectMiner(miner)}
                  aria-pressed={selected}
                >
                  <div className={styles.cardTop}>
                    <span>LV {miner.current_level}</span>
                    <span>{miner.deployment_state === 'deployed' ? 'DEPLOYED' : 'INVENTORY'}</span>
                  </div>

                  <div className={styles.imageWrap}>
                    <img
                      src={imagePath(miner.image_path, miner.name)}
                      alt=""
                      loading="lazy"
                    />
                  </div>

                  <div className={styles.cardBody}>
                    <strong>{miner.name}</strong>
                    <span>{money(miner.hashrate, 2)} H/s</span>
                    <small>
                      {miner.room_number
                        ? `Room ${String(miner.room_number).padStart(2, '0')} · Slot ${String(
                            miner.slot_index ?? 0,
                          ).padStart(2, '0')}`
                        : 'Not deployed'}
                    </small>
                  </div>

                  {compatible ? (
                    <div className={styles.mergeBadge}>MERGE</div>
                  ) : null}
                </button>
              );
            })}
          </section>

          {selectedMiner ? (
            <section className={styles.detail}>
              <div className={styles.detailHeader}>
                <div>
                  <div className="eyebrow">SELECTED MINER</div>
                  <h2>{selectedMiner.name}</h2>
                </div>
                <span className={styles.detailLevel}>LV {selectedMiner.current_level}</span>
              </div>

              <div className={styles.detailGrid}>
                <div>
                  <span>HASHRATE</span>
                  <b>{money(selectedMiner.hashrate, 2)} H/s</b>
                </div>
                <div>
                  <span>NEXT HASHRATE</span>
                  <b>
                    {selectedMiner.next_hashrate == null
                      ? 'MAX'
                      : `${money(selectedMiner.next_hashrate, 2)} H/s`}
                  </b>
                </div>
                <div>
                  <span>POWER</span>
                  <b>{money(selectedMiner.power_watts)} W</b>
                </div>
                <div>
                  <span>VALUE</span>
                  <b>💎 {money(selectedMiner.cumulative_value_diamond)}</b>
                </div>
                <div>
                  <span>BONUS</span>
                  <b>+{money(selectedMiner.bonus_hashrate_percent, 1)}%</b>
                </div>
                <div>
                  <span>ROOM</span>
                  <b>
                    {selectedMiner.room_number
                      ? `Room ${String(selectedMiner.room_number).padStart(2, '0')}`
                      : 'Not deployed'}
                  </b>
                </div>
              </div>

              <div className={styles.detailHint}>
                {matchingIds.size > 0
                  ? 'Matching miners are blinking. Tap one to continue.'
                  : selectedMiner.deployment_state !== 'deployed'
                    ? 'Deploy this miner to a Room before merging.'
                    : 'No matching deployed miner is currently available in the same Room.'}
              </div>
            </section>
          ) : null}
        </>
      )}

      {confirmOpen && selectedMiner && secondMiner && mergeFee != null ? (
        <div className={styles.modalBackdrop}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="merge-confirm-title"
          >
            <button
              type="button"
              className={styles.modalClose}
              onClick={cancelMerge}
              disabled={busy}
              aria-label="Close merge confirmation"
            >
              <X size={17} />
            </button>

            <div className="eyebrow">MERGE WORKSHOP</div>
            <h2 id="merge-confirm-title">Confirm Merge</h2>

            <p>
              Merge two {selectedMiner.name} (Lv{selectedMiner.current_level}){' '}
              <ArrowRight size={15} className={styles.inlineIcon} /> Level{' '}
              {selectedMiner.current_level + 1}
            </p>

            <div className={styles.modalStats}>
              <div>
                <span>CURRENT HASHRATE</span>
                <b>{money(selectedMiner.hashrate, 2)} H/s</b>
              </div>
              <div>
                <span>NEXT HASHRATE</span>
                <b>
                  {selectedMiner.next_hashrate == null
                    ? 'MAX'
                    : `${money(selectedMiner.next_hashrate, 2)} H/s`}
                </b>
              </div>
              <div>
                <span>MERGE COST</span>
                <b>💎 {money(mergeFee)}</b>
              </div>
              <div>
                <span>SUCCESS RATE</span>
                <b>100%</b>
              </div>
              <div>
                <span>MAX BONUS</span>
                <b>+5%</b>
              </div>
              <div>
                <span>BALANCE AFTER</span>
                <b>
                  💎 {money(Math.max(0, diamondBalance - mergeFee))}
                </b>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || diamondBalance < mergeFee}
                onClick={() => void confirmMerge()}
              >
                {busy
                  ? 'MERGING…'
                  : diamondBalance < mergeFee
                    ? 'INSUFFICIENT DIAMOND'
                    : `MERGE · 💎 ${money(mergeFee)}`}
              </button>

              <button
                type="button"
                className={styles.cancelBtn}
                onClick={cancelMerge}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
