'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Boxes } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';

type Miner = {
  id: number;
  miner_id: number;
  name: string;
  tier: string;
  current_level: number;
  hashrate: number;
  next_hashrate: number | null;
  image_path: string | null;
};

type FeeRow = {
  from_level: number | string;
  to_level: number | string;
  fee_diamond: number | string;
};

type Candidate = {
  minerId: number;
  minerName: string;
  tier: string;
  level: number;
  nextHashrate: number | null;
  fee: number;
  ids: number[];
};

function imagePath(path: string | null, name: string) {
  if (!path) return `/assets/miners/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.webp`;
  const cleaned = path.replace(/^\/+/, '');
  if (cleaned.startsWith('assets/')) return `/${cleaned}`;
  return `/assets/${cleaned}`;
}

export default function MergePage() {
  const [miners, setMiners] = useState<Miner[]>([]);
  const [fees, setFees] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    setMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage('Please sign in to use Merge Center.');
      setLoading(false);
      return;
    }

    const [minersResult, feesResult] = await Promise.all([
      supabase
        .from('nextgen_user_miners')
        .select('id,miner_id,current_level,is_merged,status')
        .eq('user_id', user.id)
        .eq('is_merged', false)
        .order('activated_at', { ascending: true }),
      supabase.rpc('nextgen_merge_fee_snapshot'),
    ]);

    if (minersResult.error) {
      setMessage(minersResult.error.message);
      setLoading(false);
      return;
    }

    if (feesResult.error) {
      setMessage(feesResult.error.message);
      setLoading(false);
      return;
    }

    const userRows = Array.isArray(minersResult.data) ? minersResult.data : [];
    const [{ data: catalogData }, { data: levelData }] = await Promise.all([
      supabase
        .from('nextgen_miner_catalog')
        .select('id,name,tier,image_path')
        .eq('enabled', true),
      supabase
        .from('nextgen_miner_levels')
        .select('miner_id,level,hashrate')
        .order('miner_id')
        .order('level'),
    ]);

    const catalog = new Map<number, { name: string; tier: string; image_path: string | null }>();
    for (const row of Array.isArray(catalogData) ? catalogData : []) {
      catalog.set(Number(row.id), {
        name: String(row.name ?? `Miner #${row.id}`),
        tier: String(row.tier ?? ''),
        image_path: row.image_path ? String(row.image_path) : null,
      });
    }

    const levels = new Map<string, { hashrate: number }>();
    for (const row of Array.isArray(levelData) ? levelData : []) {
      levels.set(`${Number(row.miner_id)}:${Number(row.level)}`, { hashrate: Number(row.hashrate ?? 0) });
    }

    const feeMap: Record<number, number> = {};
    for (const row of (Array.isArray(feesResult.data) ? feesResult.data : []) as FeeRow[]) {
      feeMap[Number(row.from_level)] = Number(row.fee_diamond);
    }

    setFees(feeMap);
    setMiners(
      userRows.map((row) => {
        const minerId = Number(row.miner_id);
        const level = Number(row.current_level);
        const cat = catalog.get(minerId);
        return {
          id: Number(row.id),
          miner_id: minerId,
          name: cat?.name ?? `Miner #${minerId}`,
          tier: cat?.tier ?? '',
          current_level: level,
          hashrate: Number(levels.get(`${minerId}:${level}`)?.hashrate ?? 0),
          next_hashrate: levels.get(`${minerId}:${level + 1}`)?.hashrate ?? null,
          image_path: cat?.image_path ?? null,
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const candidates = useMemo<Candidate[]>(() => {
    const groups = new Map<string, Candidate>();
    for (const miner of miners) {
      if (miner.current_level >= 10) continue;
      const key = `${miner.miner_id}:${miner.current_level}`;
      const current = groups.get(key) ?? {
        minerId: miner.miner_id,
        minerName: miner.name,
        tier: miner.tier,
        level: miner.current_level,
        nextHashrate: miner.next_hashrate,
        fee: fees[miner.current_level] ?? 0,
        ids: [],
      };
      current.ids.push(miner.id);
      groups.set(key, current);
    }
    return [...groups.values()].filter((candidate) => candidate.ids.length >= 2);
  }, [miners, fees]);

  const merge = async (candidate: Candidate) => {
    if (candidate.ids.length < 2 || busy) return;
    setBusy(true);
    setMessage('');

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('nextgen_merge_miners', {
        p_first_user_miner_id: candidate.ids[0],
        p_second_user_miner_id: candidate.ids[1],
      });
      if (error) throw error;
      setMessage(`${candidate.minerName} merged to Level ${candidate.level + 1} ✓`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Merge failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">MINER MANAGEMENT</div>
          <h1 className="page-title">Merge Center</h1>
          <div className="muted">Combine two identical miners at the same level. The database decides the fee and validates the capacity guard.</div>
        </div>
      </div>

      {message ? <div className="glass section" style={{ marginBottom: 14 }}>{message}</div> : null}

      {loading ? (
        <div className="glass section">SYNCING MERGE ENGINE…</div>
      ) : candidates.length === 0 ? (
        <section className="glass section">
          <div className="eyebrow">NO VALID PAIRS</div>
          <h2>Merge becomes available when you own two identical miners at the same level.</h2>
          <p className="muted">Level 10 miners cannot be merged further.</p>
        </section>
      ) : (
        <div className="grid grid-2">
          {candidates.map((candidate) => (
            <section className="glass section" key={`${candidate.minerId}:${candidate.level}`}>
              <div className="section-head">
                <div>
                  <div className="eyebrow">{candidate.tier}</div>
                  <h2>{candidate.minerName}</h2>
                </div>
                <Boxes size={24} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginTop: 14 }}>
                <div>
                  <div className="muted">CURRENT</div>
                  <b>LEVEL {candidate.level}</b>
                </div>
                <ArrowRight size={20} />
                <div>
                  <div className="muted">NEXT</div>
                  <b>LEVEL {candidate.level + 1}</b>
                </div>
              </div>

              <div className="list-row" style={{ marginTop: 14 }}>
                <span className="muted">Next hashrate</span>
                <b>{candidate.nextHashrate ?? 0} H/s</b>
              </div>
              <div className="list-row">
                <span className="muted">Merge fee</span>
                <b>💎 {candidate.fee}</b>
              </div>
              <div className="list-row">
                <span className="muted">Copies ready</span>
                <b>{candidate.ids.length}</b>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 14, width: '100%' }}
                disabled={busy}
                onClick={() => void merge(candidate)}
              >
                {busy ? 'SYNCING…' : `MERGE FOR ${candidate.fee} DIAMOND`}
              </button>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
