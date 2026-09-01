'use client';

import { ArrowUpRight, Check, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { diamond, hash, number } from '@/lib/format';
import './miner-card.css';

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

function tierClass(tier: string) {
  return tier.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function MinerCard({ miner, onChanged }: MinerCardProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const atMax = miner.owned && miner.currentLevel >= miner.maxLevel;
  const fallback = `/assets/miners/${miner.slug}.svg`;
  const normalizedImage = miner.image?.trim() || fallback;
  const progress = Math.min(100, Math.max(10, Math.round((miner.currentLevel / miner.maxLevel) * 100)));

  async function handleAction() {
    if (busy || atMax) return;
    setBusy(true);
    setMessage('');
    try {
      const supabase = createClient();
      const result = miner.owned
        ? await supabase.rpc('nextgen_upgrade_miner', { p_user_miner_id: miner.userMinerId })
        : await supabase.rpc('nextgen_purchase_miner', { p_miner_id: miner.catalogId });
      if (result.error) throw result.error;
      setMessage(miner.owned ? 'UPGRADED ✓' : 'ACTIVATED ✓');
      await onChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const actionLabel = busy
    ? 'SYNCING…'
    : atMax
      ? 'MAX LEVEL'
      : miner.owned
        ? `UPGRADE · ${number(miner.nextUpgradePrice ?? 0)}`
        : miner.purchasePrice === 0
          ? 'CLAIM FREE'
          : `ACTIVATE · ${number(miner.purchasePrice)}`;

  return (
    <article className={`miner-card glass rarity-${tierClass(miner.tier)}`}>
      <div className="miner-visual">
        <div className="miner-scan" aria-hidden="true" />
        <img
          src={normalizedImage}
          alt={`${miner.name} virtual miner`}
          loading="lazy"
          decoding="async"
          width={1536}
          height={864}
          onError={(event) => {
            const target = event.currentTarget;
            if (!target.src.endsWith(fallback)) target.src = fallback;
            else target.style.display = 'none';
          }}
        />
        <span className="rarity-badge">{miner.tier}</span>
        <span className="lvl">LV {miner.currentLevel}/{miner.maxLevel}</span>
        {miner.owned ? <span className={`ownership ${miner.active ? 'active' : ''}`}>{miner.active ? 'ACTIVE' : 'OWNED'}</span> : null}
      </div>

      <div className="miner-copy">
        <div className="miner-title-row">
          <div>
            <h3>{miner.name}</h3>
            <p>Precision virtual miner with scalable mining power progression.</p>
          </div>
          {(tierClass(miner.tier) === 'premium' || tierClass(miner.tier) === 'omega-') && <span className="premium-tag">PREMIUM</span>}
        </div>

        <div className="level-head"><span>LEVEL {miner.currentLevel}/{miner.maxLevel}</span><b>{progress}%</b></div>
        <div className="progress"><span style={{ width: `${progress}%` }} /></div>

        <div className="miner-grid">
          <div><small>HASHRATE</small><b>{hash(miner.currentHashrate)}</b></div>
          <div><small>NEXT LEVEL</small><b>{miner.nextHashrate === null ? 'MAX' : hash(miner.nextHashrate)}</b></div>
          <div><small>{miner.owned ? 'UPGRADE' : 'PRICE'}</small><b>{miner.owned ? miner.nextUpgradePrice === null ? '—' : diamond(miner.nextUpgradePrice) : diamond(miner.purchasePrice)}</b></div>
          <div><small>SPENT</small><b>{diamond(miner.totalSpent)}</b></div>
        </div>

        <button type="button" className={`btn ${atMax ? 'btn-ghost' : 'btn-primary'}`} disabled={busy || atMax} onClick={handleAction}>
          {busy ? 'SYNCING…' : atMax ? 'MAX LEVEL' : miner.owned ? <><ArrowUpRight size={16} />{actionLabel}</> : miner.purchasePrice === 0 ? <><Check size={16} />{actionLabel}</> : <><ShoppingCart size={16} />{actionLabel}</>}
        </button>

        {message ? <div className={`miner-action-message ${message.includes('✓') ? 'success' : 'error'}`}>{message}</div> : null}
      </div>
    </article>
  );
}
