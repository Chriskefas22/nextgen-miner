'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AppShell } from '@/components/layout/AppShell';
import {
  MinerCard,
  Miner,
} from '@/components/miner/MinerCard';

import { createClient } from '@/lib/supabase/client';
import { diamond } from '@/lib/format';

type CatalogRow = {
  id: number;
  slug: string;
  name: string;
  tier: string;
  base_hashrate: number;
  base_price_diamond: number;
  image_path: string;
  enabled: boolean;
  sort_order: number;
};

type LevelRow = {
  miner_id: number;
  level: number;
  hashrate: number;
  upgrade_price_diamond: number;
  cumulative_price_diamond: number;
};

type UserMinerRow = {
  id: number;
  miner_id: number;
  current_level: number;
  total_spent_diamond: number;
  status: string;
};

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

export default function MinersPage() {
  const [miners, setMiners] = useState<Miner[]>([]);
  const [balance, setBalance] =
    useState<number>(0);

  const [filter, setFilter] =
    useState<string>('All');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const loadData = useCallback(async () => {
    const supabase = createClient();

    setError('');

    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        setMiners([]);
        setBalance(0);
        return;
      }

      const [
        catalogResult,
        levelsResult,
        userMinersResult,
        walletResult,
      ] = await Promise.all([
        supabase
          .from('nextgen_miner_catalog')
          .select(
            'id,slug,name,tier,base_hashrate,base_price_diamond,image_path,enabled,sort_order'
          )
          .eq('enabled', true)
          .order('sort_order', {
            ascending: true,
          }),

        supabase
          .from('nextgen_miner_levels')
          .select(
            'miner_id,level,hashrate,upgrade_price_diamond,cumulative_price_diamond'
          )
          .order('miner_id', {
            ascending: true,
          })
          .order('level', {
            ascending: true,
          }),

        supabase
          .from('nextgen_user_miners')
          .select(
            'id,miner_id,current_level,total_spent_diamond,status'
          )
          .eq('user_id', user.id),

        supabase
          .from('nextgen_wallets')
          .select(
            'diamond_balance'
          )
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (catalogResult.error) {
        throw catalogResult.error;
      }

      if (levelsResult.error) {
        throw levelsResult.error;
      }

      if (userMinersResult.error) {
        throw userMinersResult.error;
      }

      if (walletResult.error) {
        throw walletResult.error;
      }

      const catalog =
        (catalogResult.data ??
          []) as CatalogRow[];

      const levels =
        (levelsResult.data ??
          []) as LevelRow[];

      const userMiners =
        (userMinersResult.data ??
          []) as UserMinerRow[];

      setBalance(
        Number(
          walletResult.data?.diamond_balance ??
            0
        )
      );

      const levelsByMiner =
        new Map<number, LevelRow[]>();

      for (const level of levels) {
        const existing =
          levelsByMiner.get(
            level.miner_id
          ) ?? [];

        existing.push(level);

        levelsByMiner.set(
          level.miner_id,
          existing
        );
      }

      const ownedByMiner =
        new Map<
          number,
          UserMinerRow
        >();

      for (const userMiner of userMiners) {
        ownedByMiner.set(
          userMiner.miner_id,
          userMiner
        );
      }

      const mapped: Miner[] =
        catalog.map((item) => {
          const minerLevels =
            levelsByMiner.get(item.id) ??
            [];

          const owned =
            ownedByMiner.get(item.id);

          const currentLevel =
            owned?.current_level ?? 1;

          const currentLevelRow =
            minerLevels.find(
              (level) =>
                Number(level.level) ===
                currentLevel
            ) ??
            minerLevels[0];

          const nextLevelRow =
            minerLevels.find(
              (level) =>
                Number(level.level) ===
                currentLevel + 1
            ) ?? null;

          const maxLevel =
            minerLevels.length > 0
              ? Math.max(
                  ...minerLevels.map(
                    (level) =>
                      Number(level.level)
                  )
                )
              : 10;

          return {
            catalogId: Number(item.id),

            userMinerId:
              owned
                ? Number(owned.id)
                : null,

            slug: item.slug,
            name: item.name,
            tier: item.tier,

            image: item.image_path.startsWith(
              '/'
            )
              ? item.image_path
              : `/${item.image_path}`,

            baseHashrate: Number(
              item.base_hashrate
            ),

            purchasePrice: Number(
              item.base_price_diamond
            ),

            currentLevel,

            maxLevel,

            currentHashrate: Number(
              currentLevelRow?.hashrate ??
                item.base_hashrate
            ),

            nextHashrate:
              nextLevelRow
                ? Number(
                    nextLevelRow.hashrate
                  )
                : null,

            nextUpgradePrice:
              nextLevelRow
                ? Number(
                    nextLevelRow.upgrade_price_diamond
                  )
                : null,

            totalSpent: Number(
              owned?.total_spent_diamond ??
                0
            ),

            owned: Boolean(owned),

            active:
              Boolean(owned) &&
              String(
                owned?.status ?? ''
              ).toLowerCase() === 'active',
          };
        });

      setMiners(mapped);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load miners'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    if (filter === 'All') {
      return miners;
    }

    return miners.filter(
      (miner) =>
        miner.tier === filter
    );
  }, [miners, filter]);

  const activeMiners =
    miners.filter(
      (miner) =>
        miner.owned &&
        miner.active
    ).length;

  const totalHashrate =
    miners.reduce(
      (total, miner) =>
        total +
        (miner.owned &&
        miner.active
          ? miner.currentHashrate
          : 0),
      0
    );

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            SHOP / MINERS
          </div>

          <h1 className="page-title">
            Upgrade Your Mining Power
          </h1>

          <div className="muted">
            12 unique miners · Level 1–10
            progression · database synced
          </div>
        </div>

        <div className="diamond-pill">
          <span>💎</span>
          <b>{diamond(balance)}</b>
        </div>
      </div>

      <div className="hero-banner">
        <div>
          <b>BOOST YOUR POWER</b>
          <br />
          <span>
            Increase hashrate and unlock
            stronger mining output.
          </span>
        </div>

        <span>LEVEL 10 MAX</span>
      </div>

      <div
        className="grid grid-3"
        style={{
          marginTop: 14,
        }}
      >
        <section className="glass stat">
          <label>YOUR HASHRATE</label>

          <b>
            {totalHashrate.toLocaleString(
              'en-US'
            )}{' '}
            H/s
          </b>

          <div className="muted">
            Active miner power
          </div>
        </section>

        <section className="glass stat">
          <label>ACTIVE MINERS</label>

          <b>{activeMiners}</b>

          <div className="muted">
            Currently mining
          </div>
        </section>

        <section className="glass stat">
          <label>WALLET</label>

          <b>{diamond(balance)}</b>

          <div className="muted">
            Available balance
          </div>
        </section>
      </div>

      <div
        className="filters"
        style={{
          margin: '14px 0',
        }}
      >
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            className={`filter ${
              filter === item
                ? 'active'
                : ''
            }`}
            onClick={() =>
              setFilter(item)
            }
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass section">
          <div className="eyebrow">
            DATABASE SYNC
          </div>

          <h2>
            Loading miner catalog…
          </h2>

          <p className="muted">
            Syncing your miners, levels,
            hashrate and wallet balance.
          </p>
        </div>
      ) : error ? (
        <div className="glass section">
          <div className="eyebrow">
            SYNC ERROR
          </div>

          <h2>
            Unable to load miner data
          </h2>

          <p className="muted">
            {error}
          </p>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setLoading(true);
              loadData();
            }}
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass section">
          <div className="eyebrow">
            NO RESULTS
          </div>

          <h2>
            No miners in this tier
          </h2>

          <p className="muted">
            Select another tier to view
            available miners.
          </p>
        </div>
      ) : (
        <div className="shop-grid">
          {filtered.map((miner) => (
            <MinerCard
              key={miner.catalogId}
              miner={miner}
              onChanged={loadData}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
