import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';

function num(value: unknown, digits = 2) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function pct(value: unknown) {
  return `${num(value, 1)}%`;
}

function statusClass(status: string) {
  if (status === 'HEALTHY') return 'badge green';
  if (status === 'TARGET') return 'badge green';
  if (status === 'FLOOR') return 'badge gold';
  return 'badge';
}

export default async function Admin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('nextgen_economic_capacity_snapshot', { p_asset: 'USDT' });
  const snapshot = (data ?? {}) as Record<string, unknown>;

  const status = String(snapshot.status ?? 'UNAVAILABLE');
  const expansionAllowed = Boolean(snapshot.expansion_allowed ?? false);
  const reward = snapshot.reward_usd_per_1000_weighted_hash;
  const weighted = snapshot.weighted_hash;
  const raw = snapshot.raw_hash;
  const recognized = snapshot.recognized_net_revenue_usd_day;
  const rollingRevenue = snapshot.rolling_10d_net_revenue_usd;
  const rollingRelease = snapshot.rolling_10d_mining_release_usd;
  const miningBudget = snapshot.mining_budget_usd;
  const utilization = snapshot.capacity_utilization_percent;
  const coverage = snapshot.reserve_coverage_ratio;
  const rsm = snapshot.reserve_safety_multiplier;
  const liability = snapshot.outstanding_mining_liability_usd;
  const headroom = snapshot.new_weighted_hash_headroom;

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">OWNER CONTROL · ECONOMIC CAPACITY</div>
          <h1 className="page-title">Economic Control Center</h1>
          <div className="muted">
            Authoritative production capacity envelope. New miner/upgrade capacity is blocked below TARGET.
          </div>
        </div>
        <div className={statusClass(status)}>{status}</div>
      </div>

      {error ? (
        <section className="glass section" style={{ marginBottom: 14 }}>
          <div className="eyebrow">CONTROL PLANE</div>
          <h2>Unavailable</h2>
          <p className="muted">The owner-only economic snapshot could not be loaded.</p>
        </section>
      ) : (
        <>
          <div className="grid grid-4">
            <div className="glass stat"><label>Reward / 1,000 weighted H/s</label><b>${num(reward, 4)}</b></div>
            <div className="glass stat"><label>Weighted H/s</label><b>{num(weighted, 2)}</b></div>
            <div className="glass stat"><label>Capacity utilization</label><b>{pct(utilization)}</b></div>
            <div className="glass stat"><label>Expansion</label><b>{expansionAllowed ? 'ALLOWED' : 'BLOCKED'}</b></div>
          </div>

          <div className="grid grid-4" style={{ marginTop: 14 }}>
            <div className="glass stat"><label>Raw H/s</label><b>{num(raw, 2)}</b></div>
            <div className="glass stat"><label>Recognized net revenue / day</label><b>${num(recognized, 2)}</b></div>
            <div className="glass stat"><label>Rolling 10-day revenue</label><b>${num(rollingRevenue, 2)}</b></div>
            <div className="glass stat"><label>Rolling 10-day release</label><b>${num(rollingRelease, 2)}</b></div>
          </div>

          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <section className="glass section">
              <div className="eyebrow">FUNDED CAPACITY</div>
              <h2>10-day release envelope</h2>
              <div className="list-row"><span>Current mining budget</span><b>${num(miningBudget, 8)}</b></div>
              <div className="list-row"><span>Target-safe weighted H/s</span><b>{num(snapshot.target_safe_weighted_hash, 2)}</b></div>
              <div className="list-row"><span>New weighted H/s headroom</span><b>{num(headroom, 2)}</b></div>
              <div className="list-row"><span>Weighted H/s per $1 rolling revenue</span><b>{num(snapshot.weighted_hash_per_revenue_usd, 2)}</b></div>
              <p className="muted" style={{ marginTop: 12 }}>{String(snapshot.reason ?? 'No reason available.')}</p>
            </section>

            <section className="glass section">
              <div className="eyebrow">RESERVE SAFETY</div>
              <h2>RSM and liability</h2>
              <div className="list-row"><span>Reserve coverage</span><b>{num(coverage, 3)}×</b></div>
              <div className="list-row"><span>Reserve safety multiplier</span><b>{num(rsm, 2)}×</b></div>
              <div className="list-row"><span>Outstanding mining liability</span><b>${num(liability, 8)}</b></div>
              <div className="list-row"><span>Economic rule</span><b>{String(snapshot.economic_rule_version ?? 'economic_v1_0')}</b></div>
              <div className="list-row"><span>Prepared pool date</span><b>{String(snapshot.pool_date ?? '—')}</b></div>
            </section>
          </div>

          <section className="glass section" style={{ marginTop: 14 }}>
            <div className="eyebrow">GUARD SEMANTICS</div>
            <h2>What the guard controls</h2>
            <p className="muted">
              50% of recognized net revenue enters a 10-day mining lot. In steady state, approximately 5% becomes the daily release budget before the reserve safety multiplier. Existing funded liabilities are not cancelled or reduced by this guard.
            </p>
            <div className="grid grid-4" style={{ marginTop: 12 }}>
              <div className="glass stat"><label>Healthy floor</label><b>$0.12</b></div>
              <div className="glass stat"><label>Target</label><b>$0.08</b></div>
              <div className="glass stat"><label>Floor</label><b>$0.05</b></div>
              <div className="glass stat"><label>Effective gate</label><b>≥ TARGET</b></div>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
