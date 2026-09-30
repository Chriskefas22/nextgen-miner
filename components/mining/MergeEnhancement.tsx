import React, { useEffect, useMemo, useState } from "react";
import "./merge-enhancement.css";

export type MergeMiner = {
  id: string | number;
  minerId: string | number;
  name: string;
  level: number;
  hashrate?: number | string | null;
  powerWatts?: number | string | null;
  valueDiamond?: number | string | null;
  bonusPercent?: number | string | null;
  roomId?: string | number | null;
  imageUrl?: string | null;
};

export type MergeResult = {
  success?: boolean;
  message?: string;
  minerName?: string;
  [key: string]: unknown;
};

export type MergeEnhancementProps = {
  miners: MergeMiner[];
  selectedMinerIds?: Array<string | number>;
  onSelectionChange?: (ids: Array<string | number>) => void;

  /**
   * Return the authoritative fee from the backend.
   * The existing NextGenMiner backend already calculates miner-specific
   * fees, so do not hardcode a global fee in the UI.
   */
  getMergeFee: (args: {
    minerId: string | number;
    fromLevel: number;
  }) => Promise<number>;

  /**
   * Execute the authoritative backend merge RPC.
   */
  onMerge: (args: {
    firstMinerId: string | number;
    secondMinerId: string | number;
    expectedFeeDiamond: number;
  }) => Promise<MergeResult>;

  /**
   * Optional: keeps the current website styling intact by allowing
   * the host page to turn the detail panel on/off.
   */
  showDetailPanel?: boolean;
};

function sameMinerTypeAndLevel(a: MergeMiner, b: MergeMiner) {
  return a.minerId === b.minerId && a.level === b.level && a.level < 10;
}

function sameRoom(a: MergeMiner, b: MergeMiner) {
  if (a.roomId == null || b.roomId == null) return true;
  return String(a.roomId) === String(b.roomId);
}

function formatNumber(value: number | string | null | undefined, digits = 2) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

function formatDiamond(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

export default function MergeEnhancement({
  miners,
  selectedMinerIds: controlledIds,
  onSelectionChange,
  getMergeFee,
  onMerge,
  showDetailPanel = true,
}: MergeEnhancementProps) {
  const [internalIds, setInternalIds] = useState<Array<string | number>>([]);
  const [mergeFee, setMergeFee] = useState<number | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const selectedIds = controlledIds ?? internalIds;

  const setSelectedIds = (ids: Array<string | number>) => {
    if (controlledIds == null) setInternalIds(ids);
    onSelectionChange?.(ids);
  };

  const selectedMiners = useMemo(
    () =>
      selectedIds
        .map((id) => miners.find((m) => String(m.id) === String(id)))
        .filter(Boolean) as MergeMiner[],
    [miners, selectedIds]
  );

  const selectedMiner = selectedMiners[0] ?? null;

  const matchableIds = useMemo(() => {
    if (!selectedMiner) return new Set<string>();
    return new Set(
      miners
        .filter(
          (m) =>
            String(m.id) !== String(selectedMiner.id) &&
            sameMinerTypeAndLevel(m, selectedMiner) &&
            sameRoom(m, selectedMiner)
        )
        .map((m) => String(m.id))
    );
  }, [miners, selectedMiner]);

  useEffect(() => {
    setMergeFee(null);
    setConfirmOpen(false);
    setNotice(null);

    if (selectedMiners.length !== 2) return;

    const [a, b] = selectedMiners;

    if (!sameMinerTypeAndLevel(a, b)) {
      setNotice({
        type: "error",
        text: "Only two identical miners at the same level can be merged.",
      });
      return;
    }

    if (!sameRoom(a, b)) {
      setNotice({
        type: "error",
        text: "Both miners must be deployed in the same room.",
      });
      return;
    }

    if (a.level >= 10) {
      setNotice({
        type: "error",
        text: "Level 10 is MAX and cannot be merged further.",
      });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setFeeLoading(true);
        const fee = await getMergeFee({
          minerId: a.minerId,
          fromLevel: a.level,
        });
        if (!cancelled) {
          setMergeFee(Number(fee));
          setConfirmOpen(true);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({
            type: "error",
            text:
              error instanceof Error
                ? error.message
                : "Unable to load the merge fee.",
          });
        }
      } finally {
        if (!cancelled) setFeeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedMiners, getMergeFee]);

  const toggleMiner = (miner: MergeMiner) => {
    setNotice(null);

    if (miner.level >= 10) {
      setNotice({
        type: "error",
        text: `${miner.name} is already Level 10 MAX.`,
      });
      return;
    }

    const id = String(miner.id);

    if (selectedIds.some((x) => String(x) === id)) {
      setSelectedIds(selectedIds.filter((x) => String(x) !== id));
      return;
    }

    if (selectedIds.length === 0) {
      setSelectedIds([miner.id]);
      return;
    }

    const first = miners.find(
      (m) => String(m.id) === String(selectedIds[0])
    );

    if (!first) {
      setSelectedIds([miner.id]);
      return;
    }

    if (!sameMinerTypeAndLevel(first, miner)) {
      setNotice({
        type: "error",
        text: "Select another miner with the same type and level.",
      });
      return;
    }

    if (!sameRoom(first, miner)) {
      setNotice({
        type: "error",
        text: "Both miners must be in the same room.",
      });
      return;
    }

    setSelectedIds([first.id, miner.id]);
  };

  const cancelMerge = () => {
    setConfirmOpen(false);
    setMergeFee(null);
    setSelectedIds(selectedMiners.length >= 2 ? [selectedMiners[0].id] : []);
  };

  const confirmMerge = async () => {
    if (selectedMiners.length !== 2 || mergeFee == null) return;

    const [first, second] = selectedMiners;

    try {
      setBusy(true);
      setNotice(null);

      const result = await onMerge({
        firstMinerId: first.id,
        secondMinerId: second.id,
        expectedFeeDiamond: mergeFee,
      });

      if (result?.success === false) {
        throw new Error(result.message || "Merge failed.");
      }

      setConfirmOpen(false);
      setMergeFee(null);
      setSelectedIds([]);
      setNotice({
        type: "success",
        text: `Purchase Successful! 🎉 ${
          result?.minerName || first.name
        } has been upgraded to Level ${first.level + 1}.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Merge failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ngm-merge-enhancement">
      {notice && (
        <div
          className={`ngm-merge-toast ${
            notice.type === "success"
              ? "ngm-merge-toast-success"
              : "ngm-merge-toast-error"
          }`}
          role="status"
        >
          {notice.text}
        </div>
      )}

      <div className="ngm-merge-grid">
        {miners.map((miner) => {
          const id = String(miner.id);
          const selected = selectedIds.some((x) => String(x) === id);
          const matchable =
            selectedIds.length === 1 && matchableIds.has(id) && !selected;

          return (
            <button
              key={id}
              type="button"
              className={[
                "ngm-merge-miner-hook",
                selected ? "ngm-merge-selected" : "",
                matchable ? "ngm-merge-matchable" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => toggleMiner(miner)}
              aria-pressed={selected}
              data-miner-id={id}
              data-miner-type={String(miner.minerId)}
              data-miner-level={miner.level}
            >
              <span className="ngm-merge-miner-original">
                {miner.imageUrl ? (
                  <img src={miner.imageUrl} alt="" loading="lazy" />
                ) : null}
              </span>

              <span className="ngm-merge-level-badge">
                LV {miner.level}
              </span>

              {matchable && (
                <span className="ngm-merge-compatible-indicator">
                  MERGE
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showDetailPanel && selectedMiner && (
        <section className="ngm-merge-detail" aria-label="Selected Miner">
          <div className="ngm-merge-detail-title">Selected Miner</div>

          <div className="ngm-merge-detail-main">
            <div className="ngm-merge-detail-art">
              {selectedMiner.imageUrl ? (
                <img src={selectedMiner.imageUrl} alt="" />
              ) : (
                <div className="ngm-merge-detail-placeholder" />
              )}
            </div>

            <div className="ngm-merge-detail-copy">
              <strong>{selectedMiner.name}</strong>
              <span>Level: {selectedMiner.level}</span>
              <span>
                Hashrate: {formatNumber(selectedMiner.hashrate)} H/s
              </span>
              <span>
                Power: {formatNumber(selectedMiner.powerWatts, 0)} W
              </span>
              <span>
                Value: {formatNumber(selectedMiner.valueDiamond, 0)} 💎
              </span>
              <span>
                Bonus: +{formatNumber(selectedMiner.bonusPercent, 2)}%
              </span>
            </div>
          </div>

          <div className="ngm-merge-detail-hint">
            {matchableIds.size > 0
              ? "Matching miners are highlighted. Tap one to continue."
              : "Tap another identical miner at the same level to merge."}
          </div>
        </section>
      )}

      {feeLoading && (
        <div className="ngm-merge-fee-loading" role="status">
          Loading merge cost…
        </div>
      )}

      {confirmOpen && selectedMiners.length === 2 && mergeFee != null && (
        <div className="ngm-merge-modal-backdrop" role="presentation">
          <div
            className="ngm-merge-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ngm-merge-modal-title"
          >
            <div className="ngm-merge-modal-title" id="ngm-merge-modal-title">
              Confirm Merge
            </div>

            <div className="ngm-merge-modal-subtitle">
              Merge two {selectedMiners[0].name} (Lv
              {selectedMiners[0].level}) → Level {selectedMiners[0].level + 1}
            </div>

            <div className="ngm-merge-stat-row">
              <span>Merge Cost</span>
              <strong>{formatDiamond(mergeFee)} 💎</strong>
            </div>

            <div className="ngm-merge-stat-row">
              <span>Success rate</span>
              <strong>100%</strong>
            </div>

            <div className="ngm-merge-stat-row">
              <span>Max bonus</span>
              <strong>+5%</strong>
            </div>

            <div className="ngm-merge-modal-actions">
              <button
                type="button"
                className="ngm-merge-btn ngm-merge-btn-primary"
                onClick={confirmMerge}
                disabled={busy}
              >
                {busy ? "Merging…" : "Merge"}
              </button>

              <button
                type="button"
                className="ngm-merge-btn ngm-merge-btn-secondary"
                onClick={cancelMerge}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
