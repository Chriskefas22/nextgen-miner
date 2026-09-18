'use client';

import { Check, PackageOpen, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
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

type Props = { miner: Miner; onChanged?: () => Promise<void> | void };

function actionError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? 'Action failed');
  return error instanceof Error ? error.message : 'Action failed';
}

export function MinerCard({ miner, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const owned = miner.owned;
  const isStarter = miner.purchasePrice <= 0;

  async function buy() {
    setBusy(true); setMessage('');
    try {
      const result = await createClient().rpc('nextgen_purchase_miner', { p_miner_id: miner.catalogId });
      if (result.error) throw result.error;
      setMessage('ADDED TO INVENTORY ✓');
      await onChanged?.();
    } catch (error) { setMessage(actionError(error)); }
    finally { setBusy(false); }
  }

  return (
    <article className={`miner-card glass rarity-${miner.tier.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <div className="miner-visual">
        <img src={miner.image} alt={`${miner.name} virtual miner`} loading="lazy" decoding="async" />
        <span className="rarity-badge">{miner.tier}</span>
        <span className="lvl">LV {miner.currentLevel}/{miner.maxLevel}</span>
        {owned ? <span className={`ownership ${miner.active ? 'active' : ''}`}>{miner.deploymentState === 'deployed' && miner.active ? 'DEPLOYED' : 'IN INVENTORY'}{miner.ownedCount > 1 ? ` ×${miner.ownedCount}` : ''}</span> : null}
      </div>
      <div className="miner-copy">
        <div className="miner-title-row">
          <div><h3>{miner.name}</h3><p>{owned ? 'Manage copies from Inventory and deploy them into Rooms.' : 'Buy once, then deploy from Inventory into a Room.'}</p></div>
        </div>
        <div className="miner-grid">
          <div><small>HASHRATE</small><b>{hash(miner.currentHashrate)}</b></div>
          <div><small>BASE H/S</small><b>{hash(miner.baseHashrate)}</b></div>
          <div><small>LEVEL</small><b>{miner.currentLevel}/{miner.maxLevel}</b></div>
          <div><small>{owned ? 'OWNED' : 'PRICE'}</small><b>{owned ? number(miner.ownedCount) : diamond(miner.purchasePrice)}</b></div>
        </div>
        {owned ? (
          <Link href="/items" className="btn btn-primary" style={{ width: '100%', minHeight: 44 }}><PackageOpen size={16} /> MANAGE IN INVENTORY</Link>
        ) : (
          <button type="button" className="btn btn-primary" style={{ width: '100%', minHeight: 44 }} disabled={busy} onClick={() => void buy()}>
            {busy ? 'ADDING…' : isStarter ? <><Check size={16} /> CLAIM TO INVENTORY</> : <><ShoppingCart size={16} /> BUY · {number(miner.purchasePrice)} 💎</>}
          </button>
        )}
        {message ? <div className={`miner-action-message ${message.includes('✓') ? 'success' : 'error'}`}>{message}</div> : null}
      </div>
    </article>
  );
}
