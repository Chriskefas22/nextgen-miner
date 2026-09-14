import { AppShell } from '@/components/layout/AppShell';
import { EconomicDashboardRefresh } from '@/components/admin/EconomicDashboardRefresh';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function num(value: unknown, digits = 2) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function pct(value: unknown, digits = 1) {
  return `${num(value, digits)}%`;
}

function badge(status: string) {
  if (status === 'HEALTHY' || status === 'PASS') return 'badge green';
  if (status === 'TARGET' || status === 'WARN') return 'badge gold';
  if (status === 'FLOOR') return 'badge gold';
  return 'badge';
}

export default async function AdminEconomicDashboard() {
  const supabase = await createClient();
  const [{ data, error }, { data: auditData, error: auditError }] = await Promise.all([
    supabase.rpc('nextgen_owner_economic_dashboard_snapshot', { p_asset: 'USDT' }),
    supabase.rpc('nextgen_economic_liability_audit'),
  ]);

  const snapshot = (data ?? {}) as Record<string, any>;
  const audit = (auditData ?? {}) as Record<string, any>;
  const revenue = snapshot.recognized_revenue ?? {};
  const reserve = snapshot.reserve ?? {};
  const liability = snapshot.liability ?? {};
  const mining = snapshot.mining ?? {};
  const capacity = snapshot.capacity ?? {};
  const guard = snapshot.guard ?? {};
  const allocation = snapshot.allocation ?? {};
  const recon = snapshot.reconciliation ?? {};
  const auditLiability = audit.liability ?? {};
  const auditPools = audit.pools ?? {};
  const auditRevenue = audit.revenue ?? {};
  const auditWithdrawals = audit.withdrawals ?? {};
  const status = String(guard.status ?? 'UNAVAILABLE');

  return (
    <AppShell>
      <EconomicDashboardRefresh intervalMs={60000} />
      <div className="page-head">
        <div>
          <div className="eyebrow">OWNER CONTROL · ECONOMIC CAPACITY</div>
          <h1 className="page-title">Economic Control Center</h1>
          <div className="muted">Live production view of recognized revenue, reserve, mining release, weighted capacity, liability, and the CP12 capacity guard.</div>
        </div>
        <div className={badge(status)}>{status}</div>
      </div>

      {error ? (
        <section className="glass section">
          <div className="eyebrow">CONTROL PLANE</div>
          <h2>Unavailable</h2>
          <p className="muted">The owner-only economic dashboard snapshot could not be loaded. The RPC is protected at the database layer.</p>
        </section>
      ) : (
        <>
          <div className="grid grid-4">
            <div className="glass stat"><label>Recognized revenue · today</label><b>${num(revenue.today_usd, 2)}</b></div>
            <div className="glass stat"><label>Reserve balance</label><b>${num(reserve.balance_usd, 2)}</b></div>
            <div className="glass stat"><label>Outstanding liability</label><b>${num(liability.outstanding_usd, 8)}</b></div>
            <div className="glass stat"><label>Rolling 10D mining release</label><b>${num(mining.rolling_10d_release_usd, 8)}</b></div>
          </div>

          <div className="grid grid-4" style={{ marginTop: 14 }}>
            <div className="glass stat"><label>Weighted hashrate</label><b>{num(capacity.weighted_hash, 2)} H/s</b></div>
            <div className="glass stat"><label>Reward / 1,000 weighted H/s</label><b>${num(capacity.reward_usd_per_1000_weighted_hash, 4)}</b></div>
            <div className="glass stat"><label>Capacity utilization</label><b>{pct(capacity.capacity_utilization_percent)}</b></div>
            <div className="glass stat"><label>Expansion gate</label><b>{guard.expansion_allowed ? 'ALLOWED' : 'BLOCKED'}</b></div>
          </div>

          <div className="grid grid-4" style={{ marginTop: 14 }}>
            <div className="glass stat"><label>Recognized revenue · rolling 10D</label><b>${num(revenue.rolling_10d_usd, 2)}</b></div>
            <div className="glass stat"><label>Recognized revenue · rolling 30D</label><b>${num(revenue.rolling_30d_usd, 2)}</b></div>
            <div className="glass stat"><label>Current daily mining release</label><b>${num(mining.current_daily_release_usd, 8)}</b></div>
            <div className="glass stat"><label>Mining budget</label><b>${num(mining.mining_budget_usd, 8)}</b></div>
          </div>

          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <section className="glass section">
              <div className="eyebrow">FUNDED CAPACITY</div>
              <h2>Capacity guard</h2>
              <div className="list-row"><span>Guard status</span><b>{status}</b></div>
              <div className="list-row"><span>Weighted H/s</span><b>{num(capacity.weighted_hash, 2)}</b></div>
              <div className="list-row"><span>Target-safe weighted H/s</span><b>{num(capacity.target_safe_weighted_hash, 2)}</b></div>
              <div className="list-row"><span>Healthy-safe weighted H/s</span><b>{num(capacity.healthy_safe_weighted_hash, 2)}</b></div>
              <div className="list-row"><span>New weighted H/s headroom</span><b>{num(capacity.new_weighted_hash_headroom, 2)}</b></div>
              <p className="muted" style={{ marginTop: 12 }}>{String(guard.reason ?? 'No guard reason available.')}</p>
            </section>

            <section className="glass section">
              <div className="eyebrow">RESERVE + LIABILITY</div>
              <h2>Safety envelope</h2>
              <div className="list-row"><span>Reserve coverage</span><b>{num(reserve.coverage_ratio, 3)}×</b></div>
              <div className="list-row"><span>Reserve status</span><b>{String(reserve.status ?? 'UNKNOWN')}</b></div>
              <div className="list-row"><span>Reserve in · 10D</span><b>${num(reserve.in_10d_usd, 2)}</b></div>
              <div className="list-row"><span>Reserve out · 10D</span><b>${num(reserve.out_10d_usd, 2)}</b></div>
              <div className="list-row"><span>Open liability rows</span><b>{num(liability.open_rows, 0)}</b></div>
            </section>
          </div>

          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <section className="glass section">
              <div className="eyebrow">10-DAY REVENUE LOT</div>
              <h2>Release schedule</h2>
              <div className="list-row"><span>Rolling 10D release</span><b>${num(mining.rolling_10d_release_usd, 8)}</b></div>
              <div className="list-row"><span>Current daily release</span><b>${num(mining.current_daily_release_usd, 8)}</b></div>
              <div className="list-row"><span>Active lot end</span><b>{String(mining.active_lot_end ?? '—')}</b></div>
              <div className="list-row"><span>Mining allocation</span><b>{num(Number(allocation.mining_bps) / 100, 1)}%</b></div>
              <div className="list-row"><span>Mining lot</span><b>{num(allocation.mining_lot_days, 0)} days</b></div>
            </section>

            <section className="glass section">
              <div className="eyebrow">LOCKED ECONOMIC RULE</div>
              <h2>CP12 allocation</h2>
              <div className="list-row"><span>Reserve</span><b>{num(Number(allocation.reserve_bps) / 100, 1)}%</b></div>
              <div className="list-row"><span>Mining</span><b>{num(Number(allocation.mining_bps) / 100, 1)}%</b></div>
              <div className="list-row"><span>Donation</span><b>{num(Number(allocation.donation_bps) / 100, 1)}%</b></div>
              <div className="list-row"><span>Owner / operating</span><b>{num(Number(allocation.owner_operating_bps) / 100, 1)}%</b></div>
              <div className="list-row"><span>Rule version</span><b>{String(snapshot.economic_rule_version ?? 'economic_v1_2_cp12')}</b></div>
            </section>
          </div>

          <section className="glass section" style={{ marginTop: 14 }}>
            <div className="eyebrow">ECONOMIC INTEGRITY</div>
            <h2>Reconciliation + liability audit</h2>
            <div className="grid grid-4" style={{ marginTop: 12 }}>
              <div className="glass stat"><label>Last reconciliation</label><b>{recon.last_run_ok ? 'PASS' : 'CHECK'}</b></div>
              <div className="glass stat"><label>Liability diff</label><b>${num(recon.liability_diff_usd, 8)}</b></div>
              <div className="glass stat"><label>Revenue integrity errors</label><b>{num(auditRevenue.invalid_rows, 0)}</b></div>
              <div className="glass stat"><label>Pool mismatch rows</label><b>{num(auditPools.allocation_payout_mismatch_rows, 0)}</b></div>
            </div>
            <div className="grid grid-4" style={{ marginTop: 12 }}>
              <div className="glass stat"><label>Reward liability</label><b>${num(auditLiability.reward_usd, 8)}</b></div>
              <div className="glass stat"><label>Released liability</label><b>${num(auditLiability.released_usd, 8)}</b></div>
              <div className="glass stat"><label>Pending withdrawal errors</label><b>{num(auditWithdrawals.invalid_pending_reservations, 0)}</b></div>
              <div className="glass stat"><label>Audit status</label><b>{String(audit.status ?? (auditError ? 'UNAVAILABLE' : 'PASS'))}</b></div>
            </div>
          </section>

          <section className="glass section" style={{ marginTop: 14 }}>
            <div className="eyebrow">LIVE STATE</div>
            <h2>Current production envelope</h2>
            <p className="muted">As of {String(snapshot.as_of ?? '—')}. Data is sourced from the production economic ledger and CP12 capacity engine. The browser refreshes this server snapshot every 60 seconds while this page remains open.</p>
            <div className="list-row"><span>Prepared pool</span><b>{String(snapshot.pool?.pool_date ?? '—')}</b></div>
            <div className="list-row"><span>Prepared at</span><b>{String(snapshot.pool?.prepared_at ?? '—')}</b></div>
            <div className="list-row"><span>Production mining engine</span><b>economic_capacity_guard_cp12</b></div>
          </section>
        </>
      )}
    </AppShell>
  );
}
