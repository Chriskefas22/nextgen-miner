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

function minerImagePath(miner: Miner) {
  const slug = miner.slug.trim().toLowerCase();

  /*
   * WebP adalah format asset utama.
   * Jangan kembali ke SVG lama karena SVG tersebut
   * merupakan artwork/crop lama.
   */
  const webpPath = `/assets/miners/${slug}.webp`;

  /*
   * Untuk saat ini kita prioritaskan WebP lokal berdasarkan slug.
   * Ini membuat Basic CPU secara eksplisit menggunakan:
   *
   * /assets/miners/basic-cpu.webp
   */
  return webpPath;
}

export function MinerCard({ miner, onChanged }: MinerCardProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  const atMax = miner.owned && miner.currentLevel >= miner.maxLevel;
  const normalizedImage = minerImagePath(miner);

  const progress = Math.min(
    100,
    Math.max(
      10,
      Math.round((miner.currentLevel / miner.maxLevel) * 100)
    )
  );

  async function handleAction() {
    if (busy || atMax) return;

    setBusy(true);
    setMessage('');

    try {
      const supabase = createClient();

      const result = miner.owned
        ? await supabase.rpc('nextgen_upgrade_miner', {
            p_user_miner_id: miner.userMinerId,
          })
        : await supabase.rpc('nextgen_purchase_miner', {
            p_miner_id: miner.catalogId,
          });

      if (result.error) throw result.error;

      setMessage(miner.owned ? 'UPGRADED ✓' : 'ACTIVATED ✓');

      await onChanged?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Action failed'
      );
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
    <article
      className={`miner-card glass rarity-${tierClass(miner.tier)}`}
    >
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
            onError={() => {
              /*
               * Jangan fallback ke SVG lama.
               * Jika WebP tidak tersedia, sembunyikan image
              
