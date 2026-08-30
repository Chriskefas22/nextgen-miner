'use client';

import {
  ArrowUpRight,
  Check,
  ShoppingCart,
} from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { diamond, hash, number } from '@/lib/format';

export type Miner = {
  catalogId: number;
  userMinerId: number | null;

  slug: string;
  name: string;
  tier: string;

  image: string;

  baseHashrate: number;
  purchasePrice: number;

  currentLevel: number;
  maxLevel: number;

  currentHashrate: number;
  nextHashrate: number | null;

  nextUpgradePrice: number | null;

  totalSpent: number;
  owned: boolean;
  active: boolean;
};

type MinerCardProps = {
  miner: Miner;
  onChanged?: () => Promise<void> | void;
};

export function MinerCard({
  miner,
  onChanged,
}: MinerCardProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const atMax =
    miner.owned &&
    miner.currentLevel >= miner.maxLevel;

  async function handleAction() {
    if (busy || atMax) return;

    setBusy(true);
    setMessage('');

    try {
      const supabase = createClient();

      let result;

      if (miner.owned) {
        if (!miner.userMinerId) {
          throw new Error('USER_MINER_NOT_FOUND');
        }

        result = await supabase.rpc(
          'nextgen_upgrade_miner',
          {
            p_user_miner_id: miner.userMinerId,
          }
        );
      } else {
        result = await supabase.rpc(
          'nextgen_purchase_miner',
          {
            p_miner_id: miner.catalogId,
          }
        );
      }

      if (result.error) {
        throw result.error;
      }

      setMessage(
        miner.owned
          ? 'UPGRADED ✓'
          : 'ACTIVATED ✓'
      );

      await onChanged?.();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Action failed'
      );
    } finally {
      setBusy(false);
    }
  }

  const progress = Math.min(
    100,
    Math.max(
      10,
      Math.round(
        (miner.currentLevel / miner.maxLevel) * 100
      )
    )
  );

  const actionLabel = busy
    ? 'SYNCING…'
    : atMax
      ? 'MAX LEVEL'
      : miner.owned
        ? `UPGRADE · ${number(
            miner.nextUpgradePrice ?? 0
          )}`
        : miner.purchasePrice === 0
          ? 'CLAIM FREE'
          : `ACTIVATE · ${number(
              miner.purchasePrice
            )}`;

  return (
    <article
      className={`miner-card glass rarity-${miner.tier.toLowerCase()}`}
    >
      <div className="miner-visual">
        <img
          src={miner.image}
          alt={miner.name}
          loading="lazy"
        />

        <div className="lvl">
          LV {miner.currentLevel}/{miner.maxLevel}
        </div>
      </div>

      <div className="miner-copy">
        <div className="miner-line">
          <span className="rarity">
            {miner.tier}
          </span>

          <span className="owned">
            {miner.owned
              ? miner.active
                ? 'ACTIVE'
                : 'OWNED'
              : 'AVAILABLE'}
          </span>
        </div>

        <h3>{miner.name}</h3>

        <p>
          Precision virtual miner with scalable
          mining power progression.
        </p>

        <div className="level-head">
          <span>
            LEVEL {miner.currentLevel}/
            {miner.maxLevel}
          </span>

          <b>{progress}%</b>
        </div>

        <div className="progress">
          <span
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="miner-grid">
          <div>
            <small>HASHRATE</small>
            <b>{hash(miner.currentHashrate)}</b>
          </div>

          <div>
            <small>NEXT LEVEL</small>
            <b>
              {miner.nextHashrate === null
                ? 'MAX'
                : hash(miner.nextHashrate)}
            </b>
          </div>

          <div>
            <small>
              {miner.owned
                ? 'UPGRADE'
                : 'PRICE'}
            </small>

            <b>
              {miner.owned
                ? miner.nextUpgradePrice === null
                  ? '—'
                  : diamond(
                      miner.nextUpgradePrice
                    )
                : diamond(
                    miner.purchasePrice
                  )}
            </b>
          </div>

          <div>
            <small>SPENT</small>
            <b>
              {diamond(miner.totalSpent)}
            </b>
          </div>
        </div>

        <button
          type="button"
          className={`btn ${
            atMax
              ? 'btn-ghost'
              : 'btn-primary'
          }`}
          disabled={busy || atMax}
          onClick={handleAction}
        >
          {busy ? (
            'SYNCING…'
          ) : atMax ? (
            'MAX LEVEL'
          ) : miner.owned ? (
            <>
              <ArrowUpRight size={16} />
              {actionLabel}
            </>
          ) : miner.purchasePrice === 0 ? (
            <>
              <Check size={16} />
              {actionLabel}
            </>
          ) : (
            <>
              <ShoppingCart size={16} />
              {actionLabel}
            </>
          )}
        </button>

        {message && (
          <div className="miner-action-message">
            {message}
          </div>
        )}
      </div>
    </article>
  );
}
