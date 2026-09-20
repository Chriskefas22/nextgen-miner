'use client';

import { Check, LockKeyhole, ShoppingCart, X } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { diamond, hash } from '@/lib/format';
import './miner-card.css';

export type Miner = {
  catalogId: number;
  slug: string;
  name: string;
  tier: string;
  image: string;
  baseHashrate: number;
  purchasePrice: number;
  currentLevel: number;
  maxLevel: number;
  currentHashrate: number;
  ownedCount: number;
  owned: boolean;
  active: boolean;
  deploymentState: 'inventory' | 'deployed';
};

type Props = {
  miner: Miner;
  diamondBalance: number;
  onChanged?: () => Promise<void> | void;
};

function actionError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(
      (error as { message?: unknown }).message ?? 'Action failed',
    );
  }
  return error instanceof Error ? error.message : 'Action failed';
}

function money(value: number) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function MinerCard({
  miner,
  diamondBalance,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isStarter = miner.slug === 'starter-keyboard';
  const starterOwned = isStarter && miner.owned;
  const canBuy =
    isStarter || diamondBalance >= miner.purchasePrice;

  async function confirmPurchase() {
    if (busy || starterOwned || !canBuy) return;

    setBusy(true);
    setMessage('');

    try {
      const result = await createClient().rpc(
        'nextgen_purchase_miner',
        { p_miner_id: miner.catalogId },
      );

      if (result.error) throw result.error;

      const rawBonus = Number(
        (result.data as {
          bonus_hashrate_percent?: unknown;
        } | null)?.bonus_hashrate_percent ?? 0,
      );

      const bonus = Math.max(
        0,
        Math.min(5, rawBonus),
      );

      setConfirmOpen(false);
      setMessage(
        isStarter
          ? `MINER ADDED · BONUS +${bonus.toFixed(1)}% ✓`
          : `PURCHASE SUCCESSFUL · BONUS +${bonus.toFixed(1)}% ✓`,
      );

      window.dispatchEvent(new Event('nextgen:sync'));
      await onChanged?.();
    } catch (error) {
      setMessage(actionError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <article
        className={`miner-card shop-miner-card rarity-${
          miner.tier
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
        }`}
      >
        <div className="miner-visual">
          <img
            src={miner.image}
            alt={`${miner.name} virtual miner`}
            loading="lazy"
            decoding="async"
          />

          <span className="rarity-badge">
            {miner.tier}
          </span>

          <span className="lvl">
            {starterOwned
              ? 'OWNED · LV 1/10'
              : 'LV 1/10'}
          </span>

          {miner.owned && !starterOwned ? (
            <span
              className={`ownership ${
                miner.active ? 'active' : ''
              }`}
            >
              {miner.deploymentState === 'deployed' &&
              miner.active
                ? 'DEPLOYED'
                : 'OWNED'}
            </span>
          ) : null}
        </div>

        <div className="shop-miner-body">
          <h3>{miner.name}</h3>

          <div className="shop-miner-meta">
            <div>
              <span>HASHRATE</span>
              <strong>
                {hash(miner.baseHashrate)}
              </strong>
            </div>

            <div>
              <span>PRICE</span>
              <strong>
                {isStarter
                  ? 'FREE'
                  : diamond(miner.purchasePrice)}
              </strong>
            </div>
          </div>

          {!canBuy && !starterOwned ? (
            <div className="shop-miner-locked">
              <LockKeyhole size={12} />
              Insufficient balance
            </div>
          ) : null}

          <button
            type="button"
            className={`shop-buy-button ${
              starterOwned
                ? 'owned'
                : canBuy
                  ? 'ready'
                  : 'disabled'
            }`}
            disabled={
              busy ||
              starterOwned ||
              !canBuy
            }
            onClick={() => {
              if (
                !busy &&
                !starterOwned &&
                canBuy
              ) {
                setMessage('');
                setConfirmOpen(true);
              }
            }}
          >
            {starterOwned ? (
              <>
                <Check size={15} />
                OWNED
              </>
            ) : !canBuy ? (
              <>
                <LockKeyhole size={15} />
                INSUFFICIENT
              </>
            ) : busy ? (
              'PROCESSING…'
            ) : (
              <>
                <ShoppingCart size={15} />
                BUY
              </>
            )}
          </button>

          {message ? (
            <div
              className={`miner-action-message ${
                message.includes('✓')
                  ? 'success'
                  : 'error'
              } ${
                message.includes('BONUS')
                  ? 'bonus'
                  : ''
              }`}
            >
              {message}
            </div>
          ) : null}
        </div>
      </article>

      {confirmOpen ? (
        <div
          className="miner-purchase-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !busy
            ) {
              setConfirmOpen(false);
            }
          }}
        >
          <section
            className="miner-purchase-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`confirm-purchase-${miner.catalogId}`}
          >
            <button
              type="button"
              className="miner-modal-close"
              aria-label="Close purchase confirmation"
              onClick={() =>
                !busy &&
                setConfirmOpen(false)
              }
              disabled={busy}
            >
              <X size={18} />
            </button>

            <div className="miner-modal-icon">
              <ShoppingCart size={20} />
            </div>

            <div className="miner-modal-kicker">
              PURCHASE CONFIRMATION
            </div>

            <h2
              id={`confirm-purchase-${miner.catalogId}`}
            >
              Confirm Purchase
            </h2>

            <p className="miner-modal-copy">
              Confirm your purchase of{' '}
              <strong>{miner.name}</strong>.
            </p>

            <div className="miner-modal-summary">
              <div>
                <span>PRICE</span>
                <strong>
                  {isStarter
                    ? 'FREE'
                    : `${money(
                        miner.purchasePrice,
                      )} 💎`}
                </strong>
              </div>

              <div>
                <span>YOUR BALANCE</span>
                <strong>
                  {money(diamondBalance)} 💎
                </strong>
              </div>
            </div>

            <div className="miner-modal-actions">
              <button
                type="button"
                className="miner-modal-cancel"
                onClick={() =>
                  !busy &&
                  setConfirmOpen(false)
                }
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="miner-modal-confirm"
                onClick={() =>
                  void confirmPurchase()
                }
                disabled={
                  busy ||
                  starterOwned ||
                  !canBuy
                }
              >
                {busy
                  ? 'PROCESSING…'
                  : isStarter
                    ? 'Yes, Add Starter'
                    : 'Yes, Buy It'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
