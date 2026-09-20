'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { MinerCard, Miner } from '@/components/miner/MinerCard';
import { createClient } from '@/lib/supabase/client';
import { diamond } from '@/lib/format';

const FILTERS = [
  'All',
  'Starter',
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
  'Mythic',
] as const;

type CatalogRow = {
  id: number;
  slug: string;
  name: string;
  tier: string;
  base_hashrate: number;
  base_price_diamond: number;
  image_path: string | null;
  sort_order: number;
};

type UserMinerRow = {
  id: number;
  miner_id: number;
  current_level: number;
  status: string;
  deployment_state: 'inventory' | 'deployed';
};

function imagePath(path: string | null, slug: string) {
  if (!path) return `/assets/miners/${slug}.webp`;
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('assets/')) return `/${clean}`;
  if (clean.startsWith('miners/')) return `/assets/${clean}`;
  return `/assets/miners/${slug}.webp`;
}

export default function MinersPage() {
  const [miners, setMiners] = useState<Miner[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();

      const [catalogResult, userResult, walletResult] = await Promise.all([
        sb
          .from('nextgen_miner_catalog')
          .select('id,slug,name,tier,base_hashrate,base_price_diamond,image_path,sort_order')
          .eq('enabled', true)
          .order('sort_order'),
        user
          ? sb
              .from('nextgen_user_miners')
              .select('id,miner_id,current_level,status,deployment_state')
              .eq('user_id', user.id)
              .eq('is_merged', false)
          : Promise.resolve({ data: [], error: null }),
        user
          ? sb
              .from('nextgen_wallets')
              .select('diamond_balance')
              .eq('user_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (catalogResult.error) throw catalogResult.error;
      if (userResult.error) throw userResult.error;
      if (walletResult.error) throw walletResult.error;

      const catalog = (catalogResult.data ?? []) as unknown as CatalogRow[];
      const users = (userResult.data ?? []) as unknown as UserMinerRow[];

      const byMiner = new Map<number, UserMinerRow[]>();
      for (const row of users) {
        const id = Number(row.miner_id);
        const list = byMiner.get(id) ?? [];
        list.push(row);
        byMiner.set(id, list);
      }

      const tierOrder = ['STARTER', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];

      const mapped: Miner[] = catalog.map((item) => {
        const owned = byMiner.get(Number(item.id)) ?? [];
        const highest = owned.reduce(
          (max, row) => Math.max(max, Number(row.current_level || 1)),
          1,
        );

        return {
          catalogId: Number(item.id),
          slug: item.slug,
          name: item.name,
          tier: item.tier,
          image: imagePath(item.image_path, item.slug),
          baseHashrate: Number(item.base_hashrate),
          purchasePrice: Number(item.base_price_diamond),
          currentLevel: highest,
          maxLevel: 10,
          currentHashrate: Number(item.base_hashrate),
          ownedCount: owned.length,
          owned: owned.length > 0,
          active: owned.some((row) => row.status.toLowerCase() === 'active'),
          deploymentState: owned.some((row) => row.deployment_state === 'deployed')
            ? 'deployed'
            : 'inventory',
        };
      });

      mapped.sort(
        (a, b) =>
          tierOrder.indexOf(a.tier.toUpperCase()) - tierOrder.indexOf(b.tier.toUpperCase()) ||
          a.catalogId - b.catalogId,
      );

      setMiners(mapped);
      setBalance(Number(walletResult.data?.diamond_balance ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load miner catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      filter === 'All'
        ? miners
        : miners.filter((miner) => miner.tier.toLowerCase() === filter.toLowerCase()),
    [miners, filter],
  );

  return (
    <AppShell showSearch={false}>
      <div className="shop-page-head">
        <div>
          <div className="eyebrow">MINER SHOP</div>
          <h1 className="page-title">Choose Your Miner</h1>
          <p className="shop-page-subtitle">Browse miners and purchase directly from the collection.</p>
        </div>

        <div className="shop-balance-card" aria-label="Diamond balance">
          <span>💎</span>
          <div>
            <small>YOUR BALANCE</small>
            <strong>{diamond(balance)}</strong>
          </div>
        </div>
      </div>

      <div className="shop-filter-row">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            className={`filter ${filter === item ? 'active' : ''}`}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass section shop-state-panel">
          <div className="eyebrow">DATABASE SYNC</div>
          <h2>Loading miners…</h2>
        </div>
      ) : error ? (
        <div className="glass section shop-state-panel">
          <div className="eyebrow">SYNC ERROR</div>
          <h2>Unable to load miners</h2>
          <p className="muted">{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : (
        <div className="shop-grid shop-grid-clean">
          {filtered.map((miner) => (
            <MinerCard key={miner.catalogId} miner={miner} diamondBalance={balance} onChanged={load} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
