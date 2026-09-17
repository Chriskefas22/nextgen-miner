
'use client';

import Link from 'next/link';
import { ArrowRight, Boxes, Gauge, GitMerge, PackageOpen } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import styles from './RoomsPage.module.css';

type UserMinerRow = {
  id: number;
  miner_id: number;
  current_level: number;
  status: string;
  is_merged: boolean;
  recharge_expires_at: string | null;
};

type CatalogRow = {
  id: number;
  name: string;
  tier: string;
  image_path: string | null;
  slug: string;
};

type LevelRow = {
  miner_id: number;
  level: number;
  hashrate: number;
};

type Row = UserMinerRow & {
  name: string;
  tier: string;
  image_path: string | null;
  slug: string;
  hashrate: number;
};

type Group = { room: number; name: string; workers: Row[]; capacity: number; hashrate: number };

const imagePath = (path: string | null, slug: string) => {
  if (!path) return `/assets/miners/${slug}.webp`;
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('assets/')) return `/${clean}`;
  if (clean.startsWith('miners/')) return `/assets/${clean}`;
  return `/assets/${clean}`;
};

export default function RoomsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        setMessage('Please sign in to view your mining rooms.');
        return;
      }

      const [minersResult, catalogResult, levelsResult] = await Promise.all([
        sb.from('nextgen_user_miners')
          .select('id,miner_id,current_level,status,is_merged,recharge_expires_at')
          .eq('user_id', user.id)
          .eq('is_merged', false)
          .order('activated_at', { ascending: true }),
        sb.from('nextgen_miner_catalog')
          .select('id,name,tier,image_path,slug')
          .eq('enabled', true),
        sb.from('nextgen_miner_levels')
          .select('miner_id,level,hashrate'),
      ]);

      if (minersResult.error) throw minersResult.error;
      if (catalogResult.error) throw catalogResult.error;
      if (levelsResult.error) throw levelsResult.error;

      const catalog = new Map<number, CatalogRow>(
        (catalogResult.data ?? []).map((x) => [Number(x.id), x as CatalogRow]),
      );
      const levels = new Map<string, number>(
        (levelsResult.data ?? []).map((x) => [
          `${Number((x as LevelRow).miner_id)}:${Number((x as LevelRow).level)}`,
          Number((x as LevelRow).hashrate ?? 0),
        ]),
      );

      const nextRows: Row[] = (minersResult.data ?? []).map((raw) => {
        const item = raw as UserMinerRow;
        const cat = catalog.get(Number(item.miner_id));
        return {
          ...item,
          id: Number(item.id),
          miner_id: Number(item.miner_id),
          current_level: Number(item.current_level),
          status: String(item.status),
          is_merged: Boolean(item.is_merged),
          recharge_expires_at: item.recharge_expires_at ? String(item.recharge_expires_at) : null,
          name: cat?.name ?? `Miner #${item.miner_id}`,
          tier: cat?.tier ?? '',
          image_path: cat?.image_path ? String(cat.image_path) : null,
          slug: cat?.slug ?? 'miner',
          hashrate: levels.get(`${Number(item.miner_id)}:${Number(item.current_level)}`) ?? 0,
        };
      });

      setRows(nextRows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load mining rooms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo<Group[]>(() => {
    const capacity = 12;
    const source = rows.filter((row) => !row.is_merged);
    const result: Group[] = [];

    if (!source.length) {
      result.push({ room: 1, name: 'Starter Rack', workers: [], capacity, hashrate: 0 });
      return result;
    }

    for (let offset = 0; offset < source.length; offset += capacity) {
      const workers = source.slice(offset, offset + capacity);
      result.push({
        room: result.length + 1,
        name: result.length === 0 ? 'Starter Rack' : `Mining Rack ${result.length + 1}`,
        workers,
        capacity,
        hashrate: workers.reduce((sum, row) => sum + row.hashrate, 0),
      });
    }

    return result;
  }, [rows]);

  const totalHashrate = rows
    .filter((row) => row.status.toLowerCase() === 'active' && !row.is_merged)
    .reduce((sum, row) => sum + row.hashrate, 0);
  const activeCount = rows.filter((row) => row.status.toLowerCase() === 'active' && !row.is_merged).length;

  return (
    <AppShell>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.liveHeader}>
            <div>
              <div className={styles.kicker}>MINING HOME / RACK GRID</div>
              <h1 className={styles.title}>Compute Bays</h1>
              <div className={styles.muted}>
                Your rack is the physical-style workspace for active miners. Merge operations happen from compatible miners inside this workspace.
              </div>
              <div className={styles.badgeLine}>
                <span className={styles.dot} />
                {activeCount} active miners · {totalHashrate.toLocaleString('en-US')} H/s
              </div>
            </div>
            <Link href="/miners" className={styles.ghost}>
              <PackageOpen size={15} /> Shop Miners
            </Link>
          </div>
        </section>

        {message ? <section className={styles.section}><div className={styles.muted}>{message}</div></section> : null}

        {loading ? (
          <section className={styles.section}>
            <div className={styles.muted}>SYNCING RACK GRID…</div>
          </section>
        ) : (
          groups.map((group) => {
            const loadPct = Math.min(100, (group.workers.length / group.capacity) * 100);
            return (
              <section className={styles.section} key={group.room}>
                <div className={styles.sectionHead}>
                  <div>
                    <div className={styles.kicker}>ROOM {String(group.room).padStart(2, '0')}</div>
                    <h2>{group.name}</h2>
                  </div>
                  <Link href="/merge" className={styles.link}>
                    <GitMerge size={14} /> Merge Center <ArrowRight size={13} />
                  </Link>
                </div>

                <div className={styles.roomVisual}>
                  <div className={styles.roomTunnel} aria-label={`${group.name} rack slots`}>
                    {Array.from({ length: group.capacity }).map((_, index) => (
                      <div key={index} className={`${styles.slot} ${index >= group.workers.length ? styles.empty : ''}`}>
                        {index < group.workers.length ? 'W' : '·'}
                      </div>
                    ))}
                  </div>

                  <div className={styles.roomMeta}>
                    <div><span>MINERS</span><b>{group.workers.length}/{group.capacity}</b></div>
                    <div><span>ACTIVE</span><b>{group.workers.filter((row) => row.status.toLowerCase() === 'active').length}</b></div>
                    <div><span>HASHRATE</span><b>{group.workers.filter((row) => row.status.toLowerCase() === 'active').reduce((sum, row) => sum + row.hashrate, 0).toLocaleString('en-US')} H/s</b></div>
                    <div><span>ENGINE</span><b><Gauge size={12} style={{ verticalAlign: 'middle' }} /> Server</b></div>
                  </div>
                </div>

                {group.workers.length ? (
                  <div className={styles.activityGrid}>
                    {group.workers.map((row) => (
                      <article className={styles.activity} key={row.id}>
                        <img src={imagePath(row.image_path, row.slug)} alt="" />
                        <b>{row.name}</b>
                        <span>{row.tier} · Level {row.current_level}</span>
                        <span>{row.hashrate.toLocaleString('en-US')} H/s · {row.status.toUpperCase()}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>No miners in this rack yet. Activate a miner from Mine, then return here to manage the rack and merge compatible units.</div>
                )}
              </section>
            );
          })
        )}

        <section className={styles.grid3}>
          <div className={styles.section}><div className={styles.kicker}>RACK</div><div className={styles.muted} style={{ marginTop: 8 }}>Organize owned miners into visual rooms. Capacity is only workspace organization; economic capacity remains server-enforced.</div></div>
          <div className={styles.section}><div className={styles.kicker}>MERGE</div><div className={styles.muted} style={{ marginTop: 8 }}>Use Merge Center for two compatible miners at the same level.</div></div>
          <div className={styles.section}><div className={styles.kicker}>FLOW</div><div className={styles.muted} style={{ marginTop: 8 }}>Mine → Activate → Rack → Upgrade → Merge → efficient H/s.</div></div>
        </section>
      </div>
    </AppShell>
  );
}
