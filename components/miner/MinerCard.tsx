'use client';

import { Check, ShoppingCart } from 'lucide-react';
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

  /*
   * These fields describe the user's current collection in the Shop.
   * IMPORTANT: Shop purchases NEVER upgrade an existing miner.
   * Every BUY creates another Level 1 copy (or claims the configured
   * free starter, when applicable).
   */
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
  onChanged?: () => Promise<void> | void;
};

function actionError(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error
  ) {
    return String(
      (error as { message?: unknown }).message ??
        'Action failed',
    );
  }

  return error instanceof Error
    ? error.message
    : 'Action failed';
}

export function MinerCard({
  miner,
  onChanged,
}: Props) {
  const [busy, setBusy] =
    useState(false);
  const [message, setMessage] =
    useState('');

  const isStarter =
    miner.purchasePrice <= 0;

  /*
   * SHOP FLOW — PURCHASE ONLY
   *
   * 1. BUY -> creates another miner in Inventory.
   * 2. BUY again -> creates another identical Level 1 miner.
   * 3. User merges two identical miners in the same Room.
   * 4. The merge creates the next level.
   * 5. Shop remains a purchase source; it never calls
   *    nextgen_upgrade_miner.
   */
  async function buy() {
    if (busy) return;

    setBusy(true);
    setMessage('');

    try {
      const result =
        await createClient().rpc(
          'nextgen_purchase_miner',
          {
            p_miner_id:
              miner.catalogId,
          },
        );

      if (result.error) {
        throw result.error;
      }

      setMessage(
        isStarter
          ? 'MINER ADDED TO INVENTORY ✓'
          : 'PURCHASE SUCCESSFUL ✓',
      );

      await onChanged?.();
    } catch (error) {
      setMessage(
        actionError(error),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={`miner-card glass rarity-${miner.tier
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          '-',
        )}`}
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
          {miner.owned
            ? `MAX LV ${miner.currentLevel}/${miner.maxLevel}`
            : `LV 1/${miner.maxLevel}`}
        </span>

        {miner.owned ? (
          <span
            className={`ownership ${
              miner.active
                ? 'active'
                : ''
            }`}
          >
            {miner.deploymentState ===
              'deployed' &&
            miner.active
              ? 'DEPLOYED'
              : 'IN INVENTORY'}
            {miner.ownedCount > 1
              ? ` ×${miner.ownedCount}`
              : ''}
          </span>
        ) : null}
      </div>

      <div className="miner-copy">
        <div className="miner-title-row">
          <div>
            <h3>
              {miner.name}
            </h3>

            <p>
              {miner.owned
                ? 'Buy another copy anytime. Merge two identical same-level miners in Rooms to advance to the next level.'
                : 'Buy a Level 1 copy. Merge identical copies later to progress through Level 10.'}
            </p>
          </div>
        </div>

        <div className="miner-grid">
          <div>
            <small>
              BASE HASHRATE
            </small>
            <b>
              {hash(
                miner.baseHashrate,
              )}
            </b>
          </div>

          <div>
            <small>
              PURCHASE LEVEL
            </small>
            <b>
              LV 1/{miner.maxLevel}
            </b>
          </div>

          <div>
            <small>
              OWNED
            </small>
            <b>
              {number(
                miner.ownedCount,
              )}
            </b>
          </div>

          <div>
            <small>
              BUY PRICE
            </small>
            <b>
              {diamond(
                miner.purchasePrice,
              )}
            </b>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{
            width:
              '100%',
            minHeight: 44,
          }}
          disabled={busy}
          onClick={() =>
            void buy()
          }
        >
          {busy ? (
            'PROCESSING…'
          ) : isStarter ? (
            <>
              <Check
                size={16}
              />
              BUY
            </>
          ) : (
            <>
              <ShoppingCart
                size={16}
              />
              BUY
            </>
          )}
        </button>

        {message ? (
          <div
            className={`miner-action-message ${
              message.includes(
                '✓',
              )
                ? 'success'
                : 'error'
            }`}
          >
            {message}
          </div>
        ) : null}
      </div>
    </article>
  );
}
