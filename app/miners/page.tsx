'use client';

import { HelpCircle, Layers, Package, Sparkles, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { MinerCard, Miner } from '@/components/miner/MinerCard';
import { createClient } from '@/lib/supabase/client';
import { diamond } from '@/lib/format';
import './miners-shop.css';

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
  const [helpOpen, setHelpOpen] = useState(false);

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
    <AppShell showSearch={false} showBalance={false}>
      <div className="shop-page-head">
        <div className="shop-title-block">
          <div className="eyebrow">MINER SHOP</div>
          <div className="shop-title-line">
            <h1 className="page-title">Choose Your Miner</h1>
            <button
              type="button"
              className="shop-help-trigger"
              aria-label="What's this? Learn how miners work"
              aria-haspopup="dialog"
              aria-expanded={helpOpen}
              onClick={() => setHelpOpen(true)}
              title="What's this? Learn how miners work"
            >
              <HelpCircle size={18} strokeWidth={2.25} />
            </button>
          </div>
          <p className="shop-page-subtitle">Browse miners and purchase directly from the collection.</p>
        </div>

        <div className="shop-balance-card" aria-label="Diamond balance">
          <span className="shop-balance-gem">💎</span>
          <div>
            <small>YOUR BALANCE</small>
            <strong>{diamond(balance)}</strong>
          </div>
        </div>
      </div>

      {helpOpen ? (
        <div
          className="miner-shop-help-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false);
          }}
        >
          <section
            className="miner-shop-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="miner-shop-help-title"
          >
            <button
              type="button"
              className="miner-shop-help-close"
              aria-label="Close miner guide"
              onClick={() => setHelpOpen(false)}
            >
              <X size={20} />
            </button>

            <div className="miner-shop-help-icon">
              <HelpCircle size={21} />
            </div>

            <div className="miner-shop-help-kicker">MINER GUIDE</div>
            <h2 id="miner-shop-help-title">How the Miner Works</h2>
            <p className="miner-shop-help-intro">
              Miners are the core units that add hashrate to your mining network. Choose a miner, purchase it, then manage it from your Inventory and Rooms.
            </p>

            <div className="miner-shop-help-steps">
              <div className="miner-shop-help-step">
                <span><Package size={18} /></span>
                <div>
                  <b>1. Buy a Miner</b>
                  <p>Purchase a Level 1 miner directly from the Shop using your Diamond balance.</p>
                </div>
              </div>

              <div className="miner-shop-help-step">
                <span><Layers size={18} /></span>
                <div>
                  <b>2. Manage in Inventory</b>
                  <p>Your purchased miner is available in Inventory for deployment and collection management.</p>
                </div>
              </div>

              <div className="miner-shop-help-step">
                <span><Zap size={18} /></span>
                <div>
                  <b>3. Deploy to a Room</b>
                  <p>Place a miner into a Room to activate it and use its hashrate as part of your setup.</p>
                </div>
              </div>

              <div className="miner-shop-help-step">
                <span><Sparkles size={18} /></span>
                <div>
                  <b>4. Upgrade Your Setup</b>
                  <p>Build matching miner collections and use the available Room and merge mechanics to advance your miners.</p>
                </div>
              </div>
            </div>

            <div className="miner-shop-help-note">
              <strong>Tip</strong>
              <span>Choose miners by their hashrate, tier, and price so your collection fits the way you want to build your network.</span>
            </div>

            <button
              type="button"
              className="miner-shop-help-done"
              onClick={() => setHelpOpen(false)}
            >
              Got it
            </button>
          </section>
        </div>
      ) : null}

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
