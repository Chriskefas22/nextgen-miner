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

/**
 * Supabase currently exposes generic result types in this project.
 * Convert the returned value to an unknown array first, then use
 * our local row interfaces for deterministic application mapping.
 */
function asRows<T>(value: unknown): T[] {
  return Array.isArray(value)
    ? (value as unknown as T[])
    : [];
}

/**
 * Normalize image paths from Supabase.
 *
 * Expected database value:
 *   /assets/miners/starter-keyboard.webp
 *
 * Browser URL:
 *   /assets/miners/starter-keyboard.webp
 */
function normalizeMinerImagePath(
  imagePath: string | null | undefined,
  slug: string
): string {
  const fallback =
    `/assets/miners/${slug}.webp`;

  if (!imagePath) {
    return fallback;
  }

  const cleaned =
    String(imagePath)
      .trim()
      .replace(/^\/+/, '');

  if (
    cleaned.startsWith(
      'assets/miners/'
    )
  ) {
    return `/${cleaned}`;
  }

  if (
    cleaned.startsWith(
      'miners/'
    )
  ) {
    return `/assets/${cleaned}`;
  }

  if (
    cleaned.endsWith('.webp')
  ) {
    return `/assets/miners/${cleaned}`;
  }

  return fallback;
}

export default function MinersPage() {
  const [miners, setMiners] =
    useState<Miner[]>([]);

  const [balance, setBalance] =
    useState<number>(0);

  const [filter, setFilter] =
    useState<string>('All');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const loadData = useCallback(
    async () => {
      const supabase =
        createClient();

      setLoading(true);
      setError('');

      try {
        /*
         * --------------------------------------------------
         * 1. CURRENT SESSION
         * --------------------------------------------------
         */
        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        /*
         * --------------------------------------------------
         * 2. LOAD CATALOG + LEVELS
         * --------------------------------------------------
         *
         * Catalog and levels are required to build the Shop.
         */
        const [
          catalogResult,
          levelsResult,
        ] =
          await Promise.all([
            supabase
              .from(
                'nextgen_miner_catalog'
              )
              .select(
                [
                  'id',
                  'slug',
                  'name',
                  'tier',
                  'base_hashrate',
                  'base_price_diamond',
                  'image_path',
                  'enabled',
                  'sort_order',
                ].join(',')
              )
              .eq(
                'enabled',
                true
              )
              .order(
                'sort_order',
                {
                  ascending: true,
                }
              ),

            supabase
              .from(
                'nextgen_miner_levels'
              )
              .select(
                [
                  'miner_id',
                  'level',
                  'hashrate',
                  'upgrade_price_diamond',
                  'cumulative_price_diamond',
                ].join(',')
              )
              .order(
                'miner_id',
                {
                  ascending: true,
                }
              )
              .order(
                'level',
                {
                  ascending: true,
                }
              ),
          ]);

        if (catalogResult.error) {
          throw catalogResult.error;
        }

        if (levelsResult.error) {
          throw levelsResult.error;
        }

        const catalog =
          asRows<CatalogRow>(
            catalogResult.data
          );

        const levels =
          asRows<LevelRow>(
            levelsResult.data
          );

        /*
         * --------------------------------------------------
         * 3. USER-SPECIFIC DATA
         * --------------------------------------------------
         *
         * Shop catalog still works even if no user exists.
         * Wallet/ownership are only loaded for authenticated
         * users.
         */
        let userMiners: UserMinerRow[] =
          [];

        let walletBalance = 0;

        if (user) {
          const [
            userMinersResult,
            walletResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  'nextgen_user_miners'
                )
                .select(
                  [
                    'id',
                    'miner_id',
                    'current_level',
                    'total_spent_diamond',
                    'status',
                  ].join(',')
                )
                .eq(
                  'user_id',
                  user.id
                ),

              supabase
                .from(
                  'nextgen_wallets'
                )
                .select(
                  'diamond_balance'
                )
                .eq(
                  'user_id',
                  user.id
                )
                .maybeSingle(),
            ]);

          if (
            userMinersResult.error
          ) {
            throw userMinersResult.error;
          }

          if (
            walletResult.error
          ) {
            throw walletResult.error;
          }

          userMiners =
            asRows<UserMinerRow>(
              userMinersResult.data
            );

          walletBalance =
            Number(
              walletResult
                .data
                ?.diamond_balance ??
                0
            );
        }

        setBalance(
          walletBalance
        );

        /*
         * --------------------------------------------------
         * 4. GROUP LEVELS BY MINER
         * --------------------------------------------------
         */
        const levelsByMiner =
          new Map<
            number,
            LevelRow[]
          >();

        for (
          const level of levels
        ) {
          const minerId =
            Number(
              level.miner_id
            );

          const existing =
            levelsByMiner.get(
              minerId
            ) ?? [];

          existing.push(level);

          levelsByMiner.set(
            minerId,
            existing
          );
        }

        /*
         * --------------------------------------------------
         * 5. GROUP OWNED MINERS
         * --------------------------------------------------
         */
        const ownedByMiner =
          new Map<
            number,
            UserMinerRow
          >();

        for (
          const userMiner of
            userMiners
        ) {
          ownedByMiner.set(
            Number(
              userMiner.miner_id
            ),
            userMiner
          );
        }

        /*
         * --------------------------------------------------
         * 6. BUILD FINAL MINER OBJECTS
         * --------------------------------------------------
         */
        const mapped: Miner[] =
          catalog.map(
            (item) => {
              const catalogId =
                Number(
                  item.id
                );

              const minerLevels =
                levelsByMiner.get(
                  catalogId
                ) ?? [];

              const owned =
                ownedByMiner.get(
                  catalogId
                );

              const currentLevel =
                owned
                  ? Number(
                      owned.current_level
                    )
                  : 1;

              const currentLevelRow =
                minerLevels.find(
                  (level) =>
                    Number(
                      level.level
                    ) ===
                    currentLevel
                ) ??
                minerLevels[0];

              const nextLevelRow =
                minerLevels.find(
                  (level) =>
                    Number(
                      level.level
                    ) ===
                    currentLevel + 1
                ) ?? null;

              const maxLevel =
                minerLevels.length >
                0
                  ? Math.max(
                      ...minerLevels.map(
                        (level) =>
                          Number(
                            level.level
                          )
                      )
                    )
                  : 10;

              const slug =
                String(
                  item.slug ?? ''
                );

              const isOwned =
                Boolean(
                  owned
                );

              const isActive =
                isOwned &&
                String(
                  owned?.status ??
                    ''
                ).toLowerCase() ===
                  'active';

              return {
                catalogId,

                userMinerId:
                  owned
                    ? Number(
                        owned.id
                      )
                    : null,

                slug,

                name:
                  String(
                    item.name ?? ''
                  ),

                tier:
                  String(
                    item.tier ?? ''
                  ),

                image:
                  normalizeMinerImagePath(
                    item.image_path,
                    slug
                  ),

                baseHashrate:
                  Number(
                    item.base_hashrate ??
                      0
                  ),

                purchasePrice:
                  Number(
                    item.base_price_diamond ??
                      0
                  ),

                currentLevel,

                maxLevel,

                currentHashrate:
                  Number(
                    currentLevelRow
                      ?.hashrate ??
                      item.base_hashrate ??
                      0
                  ),

                nextHashrate:
                  nextLevelRow
                    ? Number(
                        nextLevelRow
                          .hashrate
                      )
                    : null,

                nextUpgradePrice:
                  nextLevelRow
                    ? Number(
                        nextLevelRow
                          .upgrade_price_diamond
                      )
                    : null,

                totalSpent:
                  Number(
                    owned
                      ?.total_spent_diamond ??
                      0
                  ),

                owned:
                  isOwned,

                active:
                  isActive,
              };
            }
          );

        setMiners(mapped);
      } catch (
        err
      ) {
        console.error(
          '[MinersPage] load failed:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load miners'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /*
   * ------------------------------------------------------
   * INITIAL LOAD
   * ------------------------------------------------------
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /*
   * ------------------------------------------------------
   * FILTER
   * ------------------------------------------------------
   */
  const filtered =
    useMemo(() => {
      if (
        filter === 'All'
      ) {
        return miners;
      }

      return miners.filter(
        (miner) =>
          String(
            miner.tier
          ).toLowerCase() ===
          filter.toLowerCase()
      );
    }, [
      miners,
      filter,
    ]);

  /*
   * ------------------------------------------------------
   * ACTIVE MINERS
   * ------------------------------------------------------
   */
  const activeMiners =
    miners.filter(
      (miner) =>
        miner.owned &&
        miner.active
    ).length;

  /*
   * ------------------------------------------------------
   * TOTAL HASHRATE
   * ------------------------------------------------------
   */
  const totalHashrate =
    miners.reduce(
      (
        total,
        miner
      ) => {
        if (
          miner.owned &&
          miner.active
        ) {
          return (
            total +
            Number(
              miner.currentHashrate ??
                0
            )
          );
        }

        return total;
      },
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
          <span aria-hidden="true">
            💎
          </span>

          <b>
            {diamond(balance)}
          </b>
        </div>
      </div>

      <div className="hero-banner">
        <div>
          <b>
            BOOST YOUR POWER
          </b>

          <br />

          <span>
            Increase hashrate and unlock
            stronger mining output.
          </span>
        </div>

        <span>
          LEVEL 10 MAX
        </span>
      </div>

      <div
        className="grid grid-3"
        style={{
          marginTop: 14,
        }}
      >
        <section className="glass stat">
          <label>
            YOUR HASHRATE
          </label>

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
          <label>
            ACTIVE MINERS
          </label>

          <b>
            {activeMiners}
          </b>

          <div className="muted">
            Currently mining
          </div>
        </section>

        <section className="glass stat">
          <label>
            WALLET
          </label>

          <b>
            {diamond(balance)}
          </b>

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
        {FILTERS.map(
          (item) => (
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
          )
        )}
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
            Syncing miner catalog,
            levels and account data.
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
              loadData();
            }}
          >
            Retry
          </button>
        </div>
      ) : miners.length ===
        0 ? (
        <div className="glass section">
          <div className="eyebrow">
            MINER CATALOG
          </div>

          <h2>
            No miners available
          </h2>

          <p className="muted">
            The miner catalog returned
            no enabled miners from
            Supabase.
          </p>
        </div>
      ) : filtered.length ===
        0 ? (
        <div className="glass section">
          <div className="eyebrow">
            NO RESULTS
          </div>

          <h2>
            No miners in this tier
          </h2>

          <p className="muted">
            Select another tier to
            view available miners.
          </p>
        </div>
      ) : (
        <div className="shop-grid">
          {filtered.map(
            (miner) => (
              <MinerCard
                key={
                  miner.catalogId
                }
                miner={miner}
                onChanged={
                  loadData
                }
              />
            )
          )}
        </div>
      )}
    </AppShell>
  );
}
