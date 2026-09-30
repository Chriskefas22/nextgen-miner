'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Boxes, CheckCircle2, CircleAlert, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';

type Miner = {
  id: number;
  miner_id: number;
  name: string;
  tier: string;
  current_level: number;
  hashrate: number;
  next_hashrate: number | null;
  image_path: string | null;
  deployment_state: string;
  room_id: number | null;
  room_number: number | null;
  slot_index: number | null;
  power_watts: number;
  cumulative_price_diamond: number;
  bonus_hashrate_percent: number;
};

type FeeRow = {
  miner_id: number | string;
  from_level: number | string;
  to_level: number | string;
  fee_diamond: number | string;
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

type Notice = {
  type: 'success' | 'error';
  text: string;
} | null;

const numberText = (value: number, digits = 0) =>
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

function borderForLevel(level: number) {
  switch (Math.min(Math.max(level, 1), 10)) {
    case 1:
      return 'rgba(255, 207, 77, 0.55)';
    case 2:
      return 'rgba(80, 171, 255, 0.60)';
    case 3:
      return 'rgba(177, 92, 255, 0.68)';
    case 4:
      return 'rgba(255, 118, 194, 0.62)';
    case 5:
      return 'rgba(99, 225, 203, 0.62)';
    case 6:
      return 'rgba(255, 147, 68, 0.64)';
    case 7:
      return 'rgba(140, 137, 255, 0.68)';
    case 8:
      return 'rgba(107, 232, 255, 0.68)';
    case 9:
      return 'rgba(255, 103, 134, 0.72)';
    default:
      return 'rgba(255, 220, 118, 0.78)';
  }
}

export default function MergePage() {
  const [miners, setMiners] = useState<Miner[]>([]);
  const [fees, setFees] = useState<Record<string, number>>({});
  const [diamondBalance, setDiamondBalance] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => miners.find((miner) => miner.id === id))
        .filter(Boolean) as Miner[],
    [miners, selectedIds],
  );

  const first = selected[0] ?? null;
  const second = selected[1] ?? null;

  const currentFee =
    first && first.current_level < 10
      ? fees[`${first.miner_id}:${first.current_level}`] ?? null
      : null;

  const matchingIds = useMemo(() => {
    if (!first || selectedIds.length !== 1) return new Set<number>();

    return new Set(
      miners
        .filter(
          (miner) =>
            miner.id !== first.id &&
            miner.deployment_state === 'deployed' &&
            first.deployment_state === 'deployed' &&
            miner.miner_id === first.miner_id &&
            miner.current_level === first.current_level &&
            miner.room_id != null &&
            first.room_id != null &&
            miner.room_id === first.room_id,
        )
        .map((miner) => miner.id),
    );
  }, [first, miners, selectedIds]);

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

      const [
        minersResult,
        feeResult,
        levelResult,
        catalogResult,
        roomsResult,
        walletResult,
      ] = await Promise.all([
        supabase
          .from('nextgen_user_miners')
          .select(
            'id,miner_id,current_level,is_merged,status,deployment_state,bonus_hashrate_percent',
          )
          .eq('user_id', user.id)
          .eq('is_merged', false)
          .order('activated_at', { ascending: true }),

        // Pass p_miner_id explicitly so the miner-specific function is selected.
        supabase.rpc('nextgen_merge_fee_snapshot', {
          p_miner_id: null,
        }),

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
      if (levelResult.error) throw levelResult.error;
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

      for (const row of Array.isArray(catalogResult.data)
        ? catalogResult.data
        : []) {
        catalog.set(Number(row.id), {
          name: String(row.name ?? `Miner #${row.id}`),
          tier: String(row.tier ?? ''),
          image_path: row.image_path ? String(row.image_path) : null,
          base_power_watts: Number(row.base_power_watts ?? 0),
        });
      }

      const levels = new Map<
        string,
        {
          hashrate: number;
          cumulative_price_diamond: number;
        }
      >();

      for (const row of Array.isArray(levelResult.data)
        ? levelResult.data
        : []) {
        levels.set(`${Number(row.miner_id)}:${Number(row.level)}`, {
          hashrate: Number(row.hashrate ?? 0),
          cumulative_price_diamond: Number(
            row.cumulative_price_diamond ?? 0,
          ),
        });
      }

      const feeMap: Record<string, number> = {};

      for (const row of Array.isArray(feeResult.data)
        ? (feeResult.data as FeeRow[])
        : []) {
        feeMap[`${Number(row.miner_id)}:${Number(row.from_level)}`] =
          Number(row.fee_diamond ?? 0);
      }

      const roomByMiner = new Map<
        number,
        { room_id: number; room_number: number; slot_index: number }
      >();

      const snapshot = (roomsResult.data ?? {}) as RoomSnapshot;

      for (const room of Array.isArray(snapshot.rooms)
        ? snapshot.rooms
        : []) {
        for (const slot of Array.isArray(room.slots)
          ? room.slots
          : []) {
          roomByMiner.set(Number(slot.user_miner_id), {
            room_id: Number(room.id),
            room_number: Number(room.room_number),
            slot_index: Number(slot.slot_index),
          });
        }
      }

      const mapped: Miner[] = (
        Array.isArray(minersResult.data) ? minersResult.data : []
      ).map((row) => {
        const minerId = Number(row.miner_id);
        const level = Number(row.current_level);
        const current = levels.get(`${minerId}:${level}`);
        const next = levels.get(`${minerId}:${level + 1}`);
        const cat = catalog.get(minerId);
        const room = roomByMiner.get(Number(row.id));

        return {
          id: Number(row.id),
          miner_id: minerId,
          name: cat?.name ?? `Miner #${minerId}`,
          tier: cat?.tier ?? '',
          current_level: level,
          hashrate: current?.hashrate ?? 0,
          next_hashrate: next?.hashrate ?? null,
          image_path: cat?.image_path ?? null,
          deployment_state: String(row.deployment_state ?? 'inventory'),
          room_id: room?.room_id ?? null,
          room_number: room?.room_number ?? null,
          slot_index: room?.slot_index ?? null,
          power_watts: cat?.base_power_watts ?? 0,
          cumulative_price_diamond:
            current?.cumulative_price_diamond ?? 0,
          bonus_hashrate_percent: Number(
            row.bonus_hashrate_percent ?? 0,
          ),
        };
      });

      setFees(feeMap);
      setMiners(mapped);
      setDiamondBalance(
        Number(walletResult.data?.diamond_balance ?? 0),
      );
      setSelectedIds([]);
      setConfirmOpen(false);
    } catch (error) {
      setNotice({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Unable to load Merge Center.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function selectMiner(miner: Miner) {
    setNotice(null);

    if (miner.current_level >= 10) {
      setNotice({
        type: 'error',
        text: `${miner.name} is already Level 10 MAX.`,
      });
      return;
    }

    if (
      miner.deployment_state !== 'deployed' ||
      miner.room_id == null
    ) {
      setSelectedIds([miner.id]);
      setConfirmOpen(false);
      setNotice({
        type: 'error',
        text:
          'This miner must be deployed in a Room before it can be merged.',
      });
      return;
    }

    if (selectedIds.includes(miner.id)) {
      setSelectedIds(
        selectedIds.filter((id) => id !== miner.id),
      );
      setConfirmOpen(false);
      return;
    }

    if (selectedIds.length === 0) {
      setSelectedIds([miner.id]);
      return;
    }

    const firstMiner = miners.find(
      (item) => item.id === selectedIds[0],
    );

    if (!firstMiner) {
      setSelectedIds([miner.id]);
      setConfirmOpen(false);
      return;
    }

    const compatible =
      firstMiner.miner_id === miner.miner_id &&
      firstMiner.current_level === miner.current_level &&
      firstMiner.deployment_state === 'deployed' &&
      miner.deployment_state === 'deployed' &&
      firstMiner.room_id != null &&
      miner.room_id != null &&
      firstMiner.room_id === miner.room_id;

    if (!compatible) {
      setNotice({
        type: 'error',
        text:
          'Select a matching miner of the same type and level in the same Room.',
      });
      return;
    }

    const fee =
      fees[`${miner.miner_id}:${miner.current_level}`];

    setSelectedIds([firstMiner.id, miner.id]);

    if (fee == null) {
      setConfirmOpen(false);
      setNotice({
        type: 'error',
        text:
          'Merge fee is not configured for this miner level.',
      });
      return;
    }

    setConfirmOpen(true);
  }

  function cancelMerge() {
    setConfirmOpen(false);

    if (selected.length >= 2) {
      setSelectedIds([selected[0].id]);
    }
  }

  async function confirmMerge() {
    if (!first || !second || currentFee == null || busy) return;

    if (diamondBalance < currentFee) {
      setNotice({
        type: 'error',
        text: 'Insufficient Diamond balance for this merge.',
      });
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const result = await createClient().rpc(
        'nextgen_merge_miners',
        {
          p_first_user_miner_id: first.id,
          p_second_user_miner_id: second.id,
        },
      );

      if (result.error) throw result.error;

      const payload = (result.data ?? {}) as {
        to_level?: number;
        merge_fee_diamond?: number;
      };

      setConfirmOpen(false);
      setSelectedIds([]);

      setNotice({
        type: 'success',
        text: `${first.name} merged successfully to Level ${
          payload.to_level ?? first.current_level + 1
        }. Fee charged: 💎 ${numberText(
          Number(payload.merge_fee_diamond ?? currentFee),
        )}.`,
      });

      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Merge failed.';

      setNotice({
        type: 'error',
        text: message.includes('INSUFFICIENT_DIAMOND')
          ? 'Insufficient Diamond balance for this merge.'
          : message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">MINER MANAGEMENT</div>
          <h1 className="page-title">Merge Center</h1>
          <div className="muted">
            ✨ Tap two matching rigs to merge — matching miners in the
            same Room will blink automatically.
          </div>
        </div>
      </div>

      {notice ? (
        <div
          className="glass section"
          style={{
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            border:
              notice.type === 'success'
                ? '1px solid rgba(85,227,174,.25)'
                : '1px solid rgba(255,118,145,.25)',
          }}
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
          <h2>No miners available for Merge Center.</h2>
          <p className="muted">
            Buy miners from Shop, deploy them to a Room, then select two
            identical copies at the same level.
          </p>
        </section>
      ) : (
        <>
          <section
            className="glass section"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            <div>
              <div className="eyebrow">MERGE WORKSHOP</div>
              <strong>
                Select 1 miner. Matching candidates will blink.
              </strong>
            </div>
            <div
              className="muted"
              style={{
                fontSize: 12,
              }}
            >
              💎 {numberText(diamondBalance)}
            </div>
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
            }}
          >
            {miners.map((miner) => {
              const selectedState = selectedIds.includes(miner.id);
              const matchingState = matchingIds.has(miner.id);
              const deployed =
                miner.deployment_state === 'deployed' &&
                miner.room_id != null;

              return (
                <button
                  key={miner.id}
                  type="button"
                  onClick={() => selectMiner(miner)}
                  aria-pressed={selectedState}
                  style={{
                    position: 'relative',
                    minWidth: 0,
                    overflow: 'hidden',
                    padding: 9,
                    textAlign: 'left',
                    color: 'inherit',
                    border: `1px solid ${borderForLevel(
                      miner.current_level,
                    )}`,
                    borderRadius: 14,
                    background:
                      'linear-gradient(145deg,rgba(7,20,34,.98),rgba(2,10,18,.98))',
                    boxShadow: selectedState
                      ? '0 0 0 2px rgba(123,101,255,.85),0 0 22px rgba(123,101,255,.28)'
                      : matchingState
                        ? '0 0 18px rgba(123,101,255,.35)'
                        : 'none',
                    opacity: deployed ? 1 : 0.55,
                    cursor: 'pointer',
                    animation: matchingState
                      ? 'ngmMergeBlink 1.05s ease-in-out infinite'
                      : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 8,
                      fontWeight: 900,
                      letterSpacing: '.06em',
                    }}
                  >
                    <span>
                      LV {miner.current_level}
                    </span>
                    <span
                      style={{
                        color: '#7f99ac',
                      }}
                    >
                      {deployed ? 'DEPLOYED' : 'INVENTORY'}
                    </span>
                  </div>

                  <div
                    style={{
                      height: 126,
                      display: 'grid',
                      placeItems: 'center',
                      marginTop: 5,
                      overflow: 'hidden',
                      borderRadius: 11,
                    }}
                  >
                    <img
                      src={imagePath(
                        miner.image_path,
                        miner.name,
                      )}
                      alt=""
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: 3,
                      marginTop: 7,
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {miner.name}
                    </strong>

                    <span
                      style={{
                        fontSize: 9,
                        color: '#d5f4ff',
                      }}
                    >
                      {numberText(miner.hashrate, 2)} H/s
                    </span>

                    <small
                      style={{
                        color: '#6f8ca0',
                        fontSize: 8,
                      }}
                    >
                      {miner.room_number
                        ? `Room ${String(miner.room_number).padStart(
                            2,
                            '0',
                          )} · Slot ${String(
                            miner.slot_index ?? 0,
                          ).padStart(2, '0')}`
                        : 'Not deployed'}
                    </small>
                  </div>

                  {matchingState ? (
                    <span
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        zIndex: 3,
                        padding: '4px 6px',
                        borderRadius: 999,
                        background:
                          'rgba(123,101,255,.92)',
                        color: '#fff',
                        boxShadow:
                          '0 0 15px rgba(123,101,255,.48)',
                        fontSize: 7,
                        fontWeight: 900,
                        letterSpacing: '.08em',
                      }}
                    >
                      MERGE
                    </span>
                  ) : null}
                </button>
              );
            })}
          </section>

          {first ? (
            <section
              className="glass section"
              style={{
                marginTop: 14,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div className="eyebrow">SELECTED MINER</div>
                  <h2
                    style={{
                      margin: '3px 0 0',
                    }}
                  >
                    {first.name}
                  </h2>
                </div>

                <strong>LV {first.current_level}</strong>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit,minmax(130px,1fr))',
                  gap: 8,
                  marginTop: 13,
                }}
              >
                <div className="glass section">
                  <span className="muted">HASHRATE</span>
                  <b>
                    {numberText(first.hashrate, 2)} H/s
                  </b>
                </div>
                <div className="glass section">
                  <span className="muted">
                    NEXT HASHRATE
                  </span>
                  <b>
                    {first.next_hashrate == null
                      ? 'MAX'
                      : `${numberText(
                          first.next_hashrate,
                          2,
                        )} H/s`}
                  </b>
                </div>
                <div className="glass section">
                  <span className="muted">POWER</span>
                  <b>
                    {numberText(first.power_watts)} W
                  </b>
                </div>
                <div className="glass section">
                  <span className="muted">VALUE</span>
                  <b>
                    💎{' '}
                    {numberText(
                      first.cumulative_price_diamond,
                    )}
                  </b>
                </div>
                <div className="glass section">
                  <span className="muted">BONUS</span>
                  <b>
                    +{numberText(
                      first.bonus_hashrate_percent,
                      1,
                    )}%
                  </b>
                </div>
                <div className="glass section">
                  <span className="muted">ROOM</span>
                  <b>
                    {first.room_number
                      ? `Room ${String(
                          first.room_number,
                        ).padStart(2, '0')}`
                      : 'Not deployed'}
                  </b>
                </div>
              </div>

              <div
                className="muted"
                style={{
                  marginTop: 10,
                  fontSize: 10,
                }}
              >
                {matchingIds.size > 0
                  ? 'Matching miners are blinking. Tap one to continue.'
                  : first.deployment_state !== 'deployed'
                    ? 'Deploy this miner to a Room before merging.'
                    : 'No matching miner is available in the same Room.'}
              </div>
            </section>
          ) : null}
        </>
      )}

      {confirmOpen &&
      first &&
      second &&
      currentFee != null ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
            padding: 18,
            background: 'rgba(1,5,11,.68)',
            backdropFilter: 'blur(7px)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="merge-confirm-title"
            style={{
              position: 'relative',
              width: 'min(92vw,430px)',
              padding: 18,
              border: '1px solid rgba(98,130,196,.22)',
              borderRadius: 18,
              background: '#07111d',
              color: '#eafaff',
              boxShadow:
                '0 28px 70px rgba(0,0,0,.45)',
            }}
          >
            <button
              type="button"
              onClick={cancelMerge}
              disabled={busy}
              aria-label="Close merge confirmation"
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 30,
                height: 30,
                display: 'grid',
                placeItems: 'center',
                border: 0,
                borderRadius: '50%',
                background:
                  'rgba(255,255,255,.05)',
                color: 'inherit',
              }}
            >
              <X size={17} />
            </button>

            <div className="eyebrow">
              MERGE WORKSHOP
            </div>
            <h2 id="merge-confirm-title">
              Confirm Merge
            </h2>

            <p
              className="muted"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                lineHeight: 1.45,
              }}
            >
              Merge two {first.name} (
              Lv{first.current_level}){' '}
              <ArrowRight size={15} /> Level{' '}
              {first.current_level + 1}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2,minmax(0,1fr))',
                gap: 8,
                marginTop: 14,
              }}
            >
              <div className="glass section">
                <span className="muted">
                  CURRENT HASHRATE
                </span>
                <b>
                  {numberText(first.hashrate, 2)} H/s
                </b>
              </div>

              <div className="glass section">
                <span className="muted">
                  NEXT HASHRATE
                </span>
                <b>
                  {first.next_hashrate == null
                    ? 'MAX'
                    : `${numberText(
                        first.next_hashrate,
                        2,
                      )} H/s`}
                </b>
              </div>

              <div className="glass section">
                <span className="muted">
                  MERGE COST
                </span>
                <b>
                  💎 {numberText(currentFee)}
                </b>
              </div>

              <div className="glass section">
                <span className="muted">
                  SUCCESS RATE
                </span>
                <b>100%</b>
              </div>

              <div className="glass section">
                <span className="muted">
                  MAX BONUS
                </span>
                <b>+5%</b>
              </div>

              <div className="glass section">
                <span className="muted">
                  BALANCE AFTER
                </span>
                <b>
                  💎{' '}
                  {numberText(
                    Math.max(
                      0,
                      diamondBalance -
                        currentFee,
                    ),
                  )}
                </b>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 8,
                marginTop: 15,
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  busy ||
                  diamondBalance <
                    currentFee
                }
                onClick={() => void confirmMerge()}
              >
                {busy
                  ? 'MERGING…'
                  : diamondBalance <
                      currentFee
                    ? 'INSUFFICIENT DIAMOND'
                    : `MERGE · 💎 ${numberText(
                        currentFee,
                      )}`}
              </button>

              <button
                type="button"
                onClick={cancelMerge}
                disabled={busy}
                style={{
                  minHeight: 40,
                  border:
                    '1px solid rgba(255,255,255,.1)',
                  borderRadius: 10,
                  background:
                    'rgba(255,255,255,.04)',
                  color: 'inherit',
                  font: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        @keyframes ngmMergeBlink {
          0%,
          100% {
            opacity: 0.8;
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.018);
            filter: brightness(1.2);
          }
        }

        @media (max-width: 700px) {
          :global(.page-head) {
            gap: 10px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          button {
            animation: none !important;
          }
        }
      `}</style>
    </AppShell>
  );
}
