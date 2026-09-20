'use client';

import { HelpCircle, Layers, Package, Sparkles, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { MinerCard, type Miner } from '@/components/miner/MinerCard';
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

type ShopMinerRow = {
  catalog_id: number;
  slug: string;
  name: string;
  tier: string;
  base_hashrate: number;
  purchase_price: number;
  image_path: string | null;
  sort_order: number;
  owned_count: number;
  owned: boolean;
  active: boolean;
  deployment_state: 'inventory' | 'deployed';
};

type ShopSnapshot = {
  diamond_balance: number;
  miners: ShopMinerRow[];
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
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number]>('All');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const sb = createClient();
      const result = await sb.rpc('nextgen_shop_snapshot');

      if (result.error) throw result.error;

      const snapshot = result.data as unknown as ShopSnapshot;
      const tierOrder = [
        'STARTER',
        'COMMON',
        'UNCOMMON',
        'RARE',
        'EPIC',
        'LEGENDARY',
        'MYTHIC',
      ];

      const mapped: Miner[] = (snapshot.miners ?? []).map((item) => ({
        catalogId: Number(item.catalog_id),
        slug: item.slug,
        name: item.name,
        tier: item.tier,
        image: imagePath(item.image_path, item.slug),
        baseHashrate: Number(item.base_hashrate),
        purchasePrice: Number(item.purchase_price),
        currentLevel: 1,
        maxLevel: 10,
        currentHashrate: Number(item.base_hashrate),
        ownedCount: Number(item.owned_count ?? 0),
        owned: Boolean(item.owned),
        active: Boolean(item.active),
        deploymentState:
          item.deployment_state === 'deployed'
            ? 'deployed'
            : 'inventory',
      }));

      mapped.sort(
        (a, b) =>
          tierOrder.indexOf(a.tier.toUpperCase()) -
            tierOrder.indexOf(b.tier.toUpperCase()) ||
          a.catalogId - b.catalogId,
      );

      setMiners(mapped);
      setBalance(Number(snapshot.diamond_balance ?? 0));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load miner catalog.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const sync = () => {
      if (!document.hidden) void load();
    };

    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('nextgen:sync', sync as EventListener);

    return () => {
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('nextgen:sync', sync as EventListener);
    };
  }, [load]);

  const filtered = useMemo(
    () =>
      filter === 'All'
        ? miners
        : miners.filter(
            (miner) =>
              miner.tier.toLowerCase() ===
              filter.toLowerCase(),
          ),
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

          <p className="shop-page-subtitle">
            Browse miners and purchase directly from the collection.
          </p>
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
            if (event.target === event.currentTarget) {
              setHelpOpen(false);
            }
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
              aria-label="Close purchase guide"
              onClick={() => setHelpOpen(false)}
            >
              <X size={20} />
            </button>

            <div className="miner-shop-help-icon">
              <HelpCircle size={21} />
            </div>

            <div className="miner-shop-help-kicker">
              MINER GUIDE
            </div>

            <h2 id="miner-shop-help-title">
              How the Miner Works
            </h2>

            <p className="miner-shop-help-intro">
              Miners add hashrate to your network. Buy one from
              the Shop, manage it in Inventory, deploy it to a
              Room, then merge matching miners inside that Room.
            </p>

            <div className="miner-shop-help-steps">
              <div className="miner-shop-help-step">
                <span><Package size={18} /></span>
                <div>
                  <b>1. Buy a Miner</b>
                  <p>
                    Purchase a Level 1 miner using your Diamond
                    balance.
                  </p>
                </div>
              </div>

              <div className="miner-shop-help-step">
                <span><Layers size={18} /></span>
                <div>
                  <b>2. Inventory</b>
                  <p>
                    The purchased miner becomes a real Inventory
                    item immediately.
                  </p>
                </div>
              </div>

              <div className="miner-shop-help-step">
                <span><Zap size={18} /></span>
                <div>
                  <b>3. Deploy to a Room</b>
                  <p>
                    Place the miner in one of the available
                    12-slot Rooms to activate it.
                  </p>
                </div>
              </div>

              <div className="miner-shop-help-step">
                <span><Sparkles size={18} /></span>
                <div>
                  <b>4. Merge & Grow</b>
                  <p>
                    Merge two identical miners at the same level
                    in one Room to create the next level.
                  </p>
                </div>
              </div>
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
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="shop-grid shop-grid-clean">
          {filtered.map((miner) => (
            <MinerCard
              key={miner.catalogId}
              miner={miner}
              diamondBalance={balance}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
