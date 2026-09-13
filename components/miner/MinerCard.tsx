'use client';

import { ArrowUpRight, Check, ShoppingCart, CopyPlus } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { diamond, hash, number } from '@/lib/format';
import './miner-card.css';

export type Miner = {
  catalogId: number;
  userMinerId: number | null;
  ownedCount: number;
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

function tierClass(tier: string) {
  return tier.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function MinerCard({ miner, onChanged }: MinerCardProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  const atMax = miner.owned && miner.currentLevel >= miner.maxLevel;
  const normalizedImage = `/assets/miners/${miner.slug.trim().toLowerCase()}.webp`;
  const progress = Math.min(100, Math.max(10, Math.round((miner.currentLevel / miner.maxLevel) * 100)));

  async function rpcAction(name: 'nextgen_purchase_miner' | 'nextgen_upgrade_miner', args: Record<string, unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const supabase = createClient();
      const result = await supabase.rpc(name, args);
      if (result.error) throw result.error;
      setMessage(success);
      await onChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`miner-card glass rarity-${tierClass(miner.tier)}`}>
      <div className="miner-visual">
        <div className="miner-scan" aria-hidden="true" />
        {!imageFailed ? (
          <img
            src={normalizedImage}
            alt={`${miner.name} virtual miner`}
            loading="lazy"
            decoding="async"
            width={2048}
            height={1365}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="miner-image-missing" role="img" aria-label={`${miner.name} image unavailable`}>
            <span>IMAGE UNAVAILABLE</span>
          </div>
        )}
        <span className="rarity-badge">{miner.tier}</span>
        <span className="lvl">LV {miner.currentLevel}/{miner.maxLevel}</span>
        {miner.owned ? <span className={`ownership ${miner.active ? 'active' : ''}`}>{miner.active ? 'ACTIVE' : 'OWNED'}{miner.ownedCount > 1 ? ` ×${miner.ownedCount}` : ''}</span> : null}
      </div>

      <div className="miner-copy">
        <div className="miner-title-row">
          <div>
            <h3>{miner.name}</h3>
            <p>Scalable virtual mining power with server-controlled economics.</p>
          </div>
          {tierClass(miner.tier) === 'premium' || tierClass(miner.tier) === 'omega-' ? <span className="premium-tag">PREMIUM</span> : null}
        </div>

        <div className="level-head"><span>LEVEL {miner.currentLevel}/{miner.maxLevel}</span><b>{progress}%</b></div>
        <div className="progress"><span style={{ width: `${progress}%` }} /></div>

        <div className="miner-grid">
          <div><small>HASHRATE</small><b>{hash(miner.currentHashrate)}</b></div>
          <div><small>NEXT LEVEL</small><b>{miner.nextHashrate === null ? 'MAX' : hash(miner.nextHashrate)}</b></div>
          <div><small>{miner.owned ? 'UPGRADE' : 'PRICE'}</small><b>{miner.owned ? (miner.nextUpgradePrice === null ? '—' : diamond(miner.nextUpgradePrice)) : diamond(miner.purchasePrice)}</b></div>
          <div><small>SPENT</small><b>{diamond(miner.totalSpent)}</b></div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${atMax ? 'btn-ghost' : 'btn-primary'}`}
            disabled={busy || atMax}
            onClick={() =>
              miner.owned
                ? void rpcAction('nextgen_upgrade_miner', { p_user_miner_id: miner.userMinerId }, 'UPGRADED ✓')
                : void rpcAction('nextgen_purchase_miner', { p_miner_id: miner.catalogId }, 'ACTIVATED ✓')
            }
          >
            {busy ? 'SYNCING…' : atMax ? 'MAX LEVEL' : miner.owned ? <><ArrowUpRight size={16} />UPGRADE · {number(miner.nextUpgradePrice ?? 0)}</> : miner.purchasePrice === 0 ? <><Check size={16} />CLAIM FREE</> : <><ShoppingCart size={16} />ACTIVATE · {number(miner.purchasePrice)}</>}
          </button>

          {miner.owned ? (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void rpcAction('nextgen_purchase_miner', { p_miner_id: miner.catalogId }, 'NEW COPY ACTIVATED ✓')}
            >
              <CopyPlus size={16} /> BUY ANOTHER · {number(miner.purchasePrice)}
            </button>
          ) : null}
        </div>

        {message ? <div className={`miner-action-message ${message.includes('✓') ? 'success' : 'error'}`}>{message}</div> : null}
      </div>
    </article>
  );
}
