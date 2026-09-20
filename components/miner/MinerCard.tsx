'use client';

import { Check, ShoppingCart, X } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { number, diamond, hash } from '@/lib/format';
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

  /*
   * Starter Keyboard is the free launch miner.
   * After the server provisions it, Shop shows OWNED.
   */
  const isStarter = miner.slug === 'starter-keyboard';
  const starterOwned = isStarter && miner.owned;

  /*
   * SHOP PURCHASE RULE
   *
   * Every BUY creates ONE NEW Level 1 copy.
   *
   * Shop does NOT:
   * - upgrade an existing miner
   * - merge miners
   * - change a miner's level
   *
   * Level progression remains in the existing
   * Inventory / Room / Merge flow:
   *
   * BUY x2 -> same Room -> MERGE -> Level 2
   * BUY x2 -> same Room -> MERGE -> Level 2
   * Level 2 x2 -> MERGE -> Level 3
   * ... repeat through Level 10.
   */
  async function confirmPurchase() {
    if (busy || starterOwned) return;

    setBusy(true);
    setMessage('');

    try {
      const result = await createClient().rpc(
        'nextgen_purchase_miner',
        {
          p_miner_id: miner.catalogId,
        },
      );

      if (result.error) throw result.error;

      setConfirmOpen(false);

      setMessage(
        isStarter
          ? 'MINER ADDED TO INVENTORY ✓'
          : 'PURCHASE SUCCESSFUL ✓',
      );

      await onChanged?.();
    } catch (error) {
      setMessage(actionError(error));
    } finally {
      setBusy(false);
    }
  }

  function openConfirm() {
    if (busy || starterOwned) return;
    setMessage('');
    setConfirmOpen(true);
  }

  function closeConfirm() {
    if (busy) return;
    setConfirmOpen(false);
  }

  const hasEnoughDiamond =
    diamondBalance >= miner.purchasePrice;

  return (
    <>
      <article
        className={`miner-card glass rarity-${miner.tier
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')}`}
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
              ? `OWNED · LV 1/${miner.maxLevel}`
              : `LV 1/${miner.maxLevel}`}
          </span>

          {starterOwned ? (
            <span className="ownership active">
              OWNED · FREE
            </span>
          ) : miner.owned ? (
            /*
             * Do NOT display "×5", "×10", etc.
             * Inventory quantity remains available in the
             * data model, but the Shop card stays clean.
             */
            <span
              className={`ownership ${
                miner.active ? 'active' : ''
              }`}
            >
              {miner.deploymentState === 'deployed' &&
              miner.active
                ? 'DEPLOYED'
                : 'IN INVENTORY'}
            </span>
          ) : null}
        </div>

        <div className="miner-copy">
          <div className="miner-title-row">
            <div>
              <h3>{miner.name}</h3>

              <p>
                {starterOwned
                  ? 'Your free starter miner is already owned. Deploy it from Inventory into a Room.'
                  : miner.owned
                    ? 'Buy another copy anytime. Each purchase creates a new Level 1 miner for your collection.'
                    : 'Buy a Level 1 copy. Buy again whenever you need more identical miners for merging.'}
              </p>
            </div>
          </div>

          <div className="miner-grid">
            <div>
              <small>BASE HASHRATE</small>
              <b>{hash(miner.baseHashrate)}</b>
            </div>

            <div>
              <small>START LEVEL</small>
              <b>LV 1/{miner.maxLevel}</b>
            </div>

            <div>
              <small>OWNED</small>
              <b>
                {starterOwned
                  ? 'YES'
                  : number(miner.ownedCount)}
              </b>
            </div>

            <div>
              <small>BUY PRICE</small>
              <b>
                {isStarter
                  ? starterOwned
                    ? 'FREE'
                    : diamond(miner.purchasePrice)
                  : diamond(miner.purchasePrice)}
              </b>
            </div>
          </div>

          <button
            type="button"
            className={`btn ${
              starterOwned
                ? 'btn-ghost miner-owned-button'
                : 'btn-primary'
            }`}
            style={{
              width: '100%',
              minHeight: 44,
            }}
            disabled={busy || starterOwned}
            onClick={openConfirm}
          >
            {starterOwned ? (
              <>
                <Check size={16} />
                OWNED
              </>
            ) : busy ? (
              'PROCESSING…'
            ) : (
              <>
                <ShoppingCart size={16} />
                BUY
              </>
            )}
          </button>

          {message ? (
            <div
              className={`miner-action-message ${
                message.includes('✓') ? 'success' : 'error'
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
            if (event.target === event.currentTarget) {
              closeConfirm();
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
              onClick={closeConfirm}
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

            <h2 id={`confirm-purchase-${miner.catalogId}`}>
              Confirm Purchase
            </h2>

            <p className="miner-modal-copy">
              You are about to buy{' '}
              <strong>{miner.name}</strong>. This Shop purchase
              adds one new Level 1 copy to your collection.
            </p>

            <div className="miner-modal-summary">
              <div>
                <span>PRICE</span>
                <strong>
                  {isStarter
                    ? 'FREE'
                    : `${money(miner.purchasePrice)} 💎`}
                </strong>
              </div>

              <div>
                <span>YOUR BALANCE</span>
                <strong>{money(diamondBalance)} 💎</strong>
              </div>

              <div>
                <span>AFTER PURCHASE</span>
                <strong
                  className={
                    !hasEnoughDiamond && !isStarter
                      ? 'danger'
                      : ''
                  }
                >
                  {isStarter
                    ? money(diamondBalance)
                    : money(
                        Math.max(
                          0,
                          diamondBalance -
                            miner.purchasePrice,
                        ),
                      )}{' '}
                  💎
                </strong>
              </div>
            </div>

            {!hasEnoughDiamond && !isStarter ? (
              <div className="miner-modal-warning">
                Insufficient Diamond balance for this purchase.
              </div>
            ) : (
              <div className="miner-modal-note">
                Each BUY creates another Level 1 copy. Shop
                purchases never upgrade existing miners.
              </div>
            )}

            <div className="miner-modal-actions">
              <button
                type="button"
                className="miner-modal-cancel"
                onClick={closeConfirm}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="button"
                className="miner-modal-confirm"
                onClick={() => void confirmPurchase()}
                disabled={
                  busy ||
                  (!hasEnoughDiamond && !isStarter)
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
