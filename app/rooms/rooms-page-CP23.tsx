'use client';

import Link from 'next/link';
import { ArrowRight, Activity, Boxes, Gauge, GitMerge, PackageOpen, Zap } from 'lucide-react';
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

type Group = {
  room: number;
  name: string;
  workers: Row[];
  capacity: number;
  hashrate: number;
};

const imagePath = (path: string | null, slug: string) => {
  if (!path) return `/assets/miners/${slug}.webp`;
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('assets/')) return `/${clean}`;
  if (clean.startsWith('miners/')) return `/assets/${clean}`;
  return `/assets/${clean}`;
};

function statusLabel(status: string) {
  const normalized = status.toLowerCase();
  return normalized === 'active' ? 'LIVE' : normalized === 'merged' ? 'MERGED' : 'PAUSED';
}

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

      setRows((minersResult.data ?? []).map((raw) => {
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
      }));
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
      return [{ room: 1, name: 'Starter Rack', workers: [], capacity, hashrate: 0 }];
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

  const totalMiners = rows.filter((row) => !row.is_merged).length;
  const activeCount = rows.filter((row) => row.status.toLowerCase() === 'active' && !row.is_merged).length;
  const totalHashrate = rows
    .filter((row) => row.status.toLowerCase() === 'active' && !row.is_merged)
    .reduce((sum, row) => sum + row.hashrate, 0);

  const mergeReadyPairs = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of rows) {
      if (row.is_merged || row.current_level >= 10) continue;
      const key = `${row.miner_id}:${row.current_level}`;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    return [...grouped.values()].reduce((sum, count) => sum + Math.floor(count / 2), 0);
  }, [rows]);

  return (
    <AppShell>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroGlow} />
          <div className={styles.liveHeader}>
            <div className={styles.heroCopy}>
              <div className={styles.kicker}>MINING HOME / RACK GRID</div>
              <h1 className={styles.title}>Compute Bays</h1>
              <p className={styles.muted}>
                A live physical-style workspace for your owned miners. Every bay is linked to the same miner record used by Mine, Merge, recharge and the server settlement engine.
              </p>
            </div>
            <div className={styles.heroActions}>
              <Link href="/miners" className={styles.ghost}><PackageOpen size={15} /> Shop Miners</Link>
              <Link href="/merge" className={styles.link}><GitMerge size={14} /> Merge Center <ArrowRight size={13} /></Link>
            </div>
          </div>

          <div className={styles.heroStats}>
            <div><span>OWNED MINERS</span><b>{totalMiners}</b></div>
            <div><span>ACTIVE</span><b>{activeCount}</b></div>
            <div><span>HASHRATE</span><b>{totalHashrate.toLocaleString('en-US')} H/s</b></div>
            <div><span>MERGE READY</span><b>{mergeReadyPairs} pair{mergeReadyPairs === 1 ? '' : 's'}</b></div>
          </div>
        </section>

        {message ? <section className={styles.section}><div className={styles.muted}>{message}</div></section> : null}

        {loading ? (
          <section className={styles.section}>
            <div className={styles.kicker}>DATABASE SYNC</div>
            <h2>SYNCING RACK GRID…</h2>
            <div className={styles.syncLine}><span /></div>
          </section>
        ) : (
          groups.map((group) => {
            const occupied = group.workers.length;
            const active = group.workers.filter((row) => row.status.toLowerCase() === 'active').length;
            const loadPct = Math.min(100, (occupied / group.capacity) * 100);

            return (
              <section className={styles.section} key={group.room}>
                <div className={styles.sectionHead}>
                  <div>
                    <div className={styles.kicker}>ROOM {String(group.room).padStart(2, '0')}</div>
                    <h2>{group.name}</h2>
                    <div className={styles.roomSub}>{occupied}/{group.capacity} bays occupied · {group.hashrate.toLocaleString('en-US')} H/s installed</div>
                  </div>
                  <Link href="/merge" className={styles.link}><GitMerge size={14} /> Merge Center <ArrowRight size={13} /></Link>
                </div>

                <div className={styles.roomStrip}>
                  <div className={styles.stripLabel}>RACK UTILIZATION</div>
                  <div className={styles.meter}><span style={{ width: `${loadPct}%` }} /></div>
                  <div className={styles.stripValue}>{Math.round(loadPct)}%</div>
                  <div className={styles.stripLive}><Activity size={13} /> {active} LIVE</div>
                </div>

                <div className={styles.rackFrame}>
                  <div className={styles.rackHeader}>
                    <span>12-BAY COMPUTE RACK</span>
                    <span><Zap size={12} /> SERVER LINKED</span>
                  </div>
                  <div className={styles.rackGrid} aria-label={`${group.name} rack slots`}>
                    {Array.from({ length: group.capacity }).map((_, index) => {
                      const worker = group.workers[index];
                      const live = worker?.status.toLowerCase() === 'active';
                      return (
                        <div key={index} className={`${styles.slot} ${worker ? styles.occupied : styles.empty}`}>
                          <div className={styles.slotBay}>BAY {String(index + 1).padStart(2, '0')}</div>
                          {worker ? (
                            <>
                              <img className={styles.slotImage} src={imagePath(worker.image_path, worker.slug)} alt="" />
                              <div className={styles.slotShade} />
                              <div className={styles.slotContent}>
                                <span className={`${styles.state} ${live ? styles.stateLive : styles.statePaused}`}>{live ? 'LIVE' : 'PAUSED'}</span>
                                <b>{worker.name}</b>
                                <small>LV {worker.current_level} · {worker.hashrate.toLocaleString('en-US')} H/s</small>
                              </div>
                            </>
                          ) : (
                            <div className={styles.emptyBay}>
                              <Boxes size={19} />
                              <b>AVAILABLE</b>
                              <small>Install a miner</small>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.roomMeta}>
                  <div><span>MINERS</span><b>{occupied}/{group.capacity}</b></div>
                  <div><span>ACTIVE</span><b>{active}</b></div>
                  <div><span>HASHRATE</span><b>{group.workers.filter((row) => row.status.toLowerCase() === 'active').reduce((sum, row) => sum + row.hashrate, 0).toLocaleString('en-US')} H/s</b></div>
                  <div><span>ENGINE</span><b><Gauge size={12} /> Server</b></div>
                </div>

                {group.workers.length ? (
                  <div className={styles.activityGrid}>
                    {group.workers.map((row) => (
                      <article className={styles.activity} key={row.id}>
                        <img src={imagePath(row.image_path, row.slug)} alt="" />
                        <div className={styles.activityCopy}>
                          <div className={styles.activityTop}><b>{row.name}</b><span className={row.status.toLowerCase() === 'active' ? styles.liveText : styles.pausedText}>{statusLabel(row.status)}</span></div>
                          <span>{row.tier} · Level {row.current_level}</span>
                          <span>{row.hashrate.toLocaleString('en-US')} H/s · Record #{row.id}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyNote}>No miners in this rack yet. Activate one from Mine, then return here to manage its bay and merge compatible copies.</div>
                )}
              </section>
            );
          })
        )}

        <section className={styles.grid3}>
          <div className={styles.infoCard}><div className={styles.kicker}>RACK</div><b>Physical-style workspace</b><div className={styles.muted}>Every occupied bay is backed by the same owned-miner record.</div></div>
          <div className={styles.infoCard}><div className={styles.kicker}>MERGE</div><b>{mergeReadyPairs} pair{mergeReadyPairs === 1 ? '' : 's'} ready</b><div className={styles.muted}>Two identical miners at the same level can become one next-level miner.</div></div>
          <div className={styles.infoCard}><div className={styles.kicker}>FLOW</div><b>Mine → Recharge → Rack → Merge</b><div className={styles.muted}>Economic capacity remains server-enforced and is shared with purchases and rewards.</div></div>
        </section>
      </div>
    </AppShell>
  );
}
