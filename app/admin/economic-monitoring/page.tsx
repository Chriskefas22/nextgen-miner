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

function money(value: unknown, digits = 2) {
  return `$${num(value, digits)}`;
}

function badge(status: string) {
  if (status === 'HEALTHY' || status === 'PASS' || status === 'INFO') return 'badge green';
  if (status === 'TARGET' || status === 'WARN' || status === 'FLOOR') return 'badge gold';
  return 'badge';
}

function severityBadge(status: string) {
  if (status === 'CRITICAL') return 'badge';
  if (status === 'WARN') return 'badge gold';
  return 'badge green';
}

export default async function EconomicMonitoringPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('nextgen_owner_economic_monitoring_dashboard', { p_asset: 'USDT' });
  const snapshot = (data ?? {}) as Record<string, any>;

  const guard = snapshot.guard ?? {};
  const providers = snapshot.provider_reconciliation ?? {};
  const aging = snapshot.revenue_aging ?? {};
  const reserveLiability = snapshot.reserve_liability ?? {};
  const maturity = snapshot.lot_maturity ?? {};
  const reconciliation = snapshot.reconciliation ?? {};
  const anomalies = Array.isArray(snapshot.open_anomalies) ? snapshot.open_anomalies : [];
  const alerts = Array.isArray(snapshot.open_alerts) ? snapshot.open_alerts : [];
  const transitions = Array.isArray(snapshot.guard_transitions) ? snapshot.guard_transitions : [];
  const runs = Array.isArray(snapshot.recent_monitoring_runs) ? snapshot.recent_monitoring_runs : [];
  const providerRows = Array.isArray(providers.providers) ? providers.providers : [];
  const status = String(guard.status ?? 'UNAVAILABLE');

  return (
    <AppShell>
      <EconomicDashboardRefresh intervalMs={60000} />

      <div className="page-head">
        <div>
          <div className="eyebrow">OWNER CONTROL · ECONOMIC MONITORING</div>
          <h1 className="page-title">Economic Monitoring & Reconciliation</h1>
          <div className="muted">15-minute anomaly worker, provider reconciliation, revenue aging, reserve/liability drift, lot maturity, and capacity-guard history.</div>
        </div>
        <div className={badge(status)}>{status}</div>
      </div>

      {error ? (
        <section className="glass section">
          <div className="eyebrow">CONTROL PLANE</div>
          <h2>Monitoring unavailable</h2>
          <p className="muted">The owner-only monitoring dashboard could not be loaded.</p>
        </section>
      ) : (
        <>
          <div className="grid grid-4">
            <div className="glass stat"><label>Open anomalies</label><b>{num(anomalies.length, 0)}</b></div>
            <div className="glass stat"><label>Open alerts</label><b>{num(alerts.length, 0)}</b></div>
            <div className="glass stat"><label>Monitoring severity</label><b>{String(runs[0]?.severity ?? 'INFO')}</b></div>
            <div className="glass stat"><label>Guard transition count</label><b>{num(guard.transition_count, 0)}</b></div>
          </div>

          <div className="grid grid-4" style={{ marginTop: 14 }}>
            <div className="glass stat"><label>Pending / unreconciled ≤24h</label><b>{money(aging.pending_0_24h_usd)}</b></div>
            <div className="glass stat"><label>Pending / unreconciled 24–72h</label><b>{money(aging.pending_24_72h_usd)}</b></div>
            <div className="glass stat"><label>Stale >72h</label><b>{money(aging.stale_72h_plus_usd)}</b></div>
            <div className="glass stat"><label>Invalid revenue rows</label><b>{num(aging.invalid_revenue_rows, 0)}</b></div>
          </div>

          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <section className="glass section">
              <div className="eyebrow">ANOMALY CONTROL</div>
              <h2>Active findings</h2>
              {anomalies.length === 0 ? (
                <p className="muted">No open economic anomalies detected.</p>
              ) : (
                anomalies.slice(0, 12).map((item: any) => (
                  <div className="list-row" key={String(item.fingerprint)}>
                    <span>{String(item.title ?? item.anomaly_code)}</span>
                    <b className={severityBadge(String(item.severity ?? 'INFO'))}>{String(item.severity ?? 'INFO')}</b>
                  </div>
                ))
              )}
            </section>

            <section className="glass section">
              <div className="eyebrow">ALERTS</div>
              <h2>Operator alerts</h2>
              {alerts.length === 0 ? (
                <p className="muted">Alert queue is clear.</p>
              ) : (
                alerts.slice(0, 12).map((item: any) => (
                  <div className="list-row" key={String(item.alert_key)}>
                    <span>{String(item.title ?? item.alert_key)}</span>
                    <b className={severityBadge(String(item.severity ?? 'WARN'))}>{String(item.status ?? 'OPEN')}</b>
                  </div>
                ))
              )}
            </section>
          </div>

          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <section className="glass section">
              <div className="eyebrow">PROVIDER RECONCILIATION</div>
              <h2>Revenue integrity</h2>
              <div className="list-row"><span>Configured providers</span><b>{num(providers.provider_count, 0)}</b></div>
              <div className="list-row"><span>Enabled providers</span><b>{num(providers.enabled_provider_count, 0)}</b></div>
              <div className="list-row"><span>Orphaned provider completions</span><b>{num(providers.orphaned_posted_completions, 0)}</b></div>
              <div className="list-row"><span>Unmatched settled revenue</span><b>{num(providers.unmatched_settled_revenue, 0)}</b></div>
              <div style={{ marginTop: 12 }}>
                {providerRows.length === 0 ? <p className="muted">No provider revenue events recorded.</p> : providerRows.slice(0, 8).map((p: any) => (
                  <div className="list-row" key={String(p.provider_key)}>
                    <span>{String(p.provider_key)}</span>
                    <b>{money(p.recoverable_net_revenue_usd, 4)}</b>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass section">
              <div className="eyebrow">REVENUE AGING</div>
              <h2>Recoverability queue</h2>
              <div className="list-row"><span>0–24h events</span><b>{num(aging.pending_0_24h_count, 0)}</b></div>
              <div className="list-row"><span>24–72h events</span><b>{num(aging.pending_24_72h_count, 0)}</b></div>
              <div className="list-row"><span>72h+ events</span><b>{num(aging.pending_72h_plus_count, 0)}</b></div>
              <div className="list-row"><span>Stale recovery events</span><b>{num(aging.stale_72h_plus_count, 0)}</b></div>
              <p className="muted" style={{ marginTop: 12 }}>Only revenue that passes the platform recognition/recoverability state is allowed to fund the mining engine.</p>
            </section>
          </div>

          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <section className="glass section">
              <div className="eyebrow">RESERVE / LIABILITY DRIFT</div>
              <h2>Safety reconciliation</h2>
              <div className="list-row"><span>Reserve balance</span><b>{money(reserveLiability.reserve_balance_usd, 8)}</b></div>
              <div className="list-row"><span>Open mining liability</span><b>{money(reserveLiability.open_liability_usd, 8)}</b></div>
              <div className="list-row"><span>Reserve coverage</span><b>{num(reserveLiability.reserve_coverage_ratio, 3)}×</b></div>
              <div className="list-row"><span>Reserve vs pool drift</span><b>{money(reserveLiability.reserve_pool_drift_usd, 8)}</b></div>
              <div className="list-row"><span>Liability vs pool drift</span><b>{money(reserveLiability.liability_pool_drift_usd, 8)}</b></div>
              <div className="list-row"><span>Reserve below liability</span><b>{reserveLiability.reserve_below_liability ? 'YES' : 'NO'}</b></div>
            </section>

            <section className="glass section">
              <div className="eyebrow">LOT MATURITY</div>
              <h2>Rolling 10-day release</h2>
              <div className="list-row"><span>Active lots</span><b>{num(maturity.active_lots, 0)}</b></div>
              <div className="list-row"><span>Funded active lots</span><b>{num(maturity.active_funded_lots, 0)}</b></div>
              <div className="list-row"><span>Matured lots</span><b>{num(maturity.matured_lots, 0)}</b></div>
              <div className="list-row"><span>Active daily release</span><b>{money(maturity.active_daily_release_usd, 8)}</b></div>
              <div className="list-row"><span>Nearest active end</span><b>{String(maturity.nearest_active_end ?? '—')}</b></div>
              <div className="list-row"><span>Latest active lot maturity</span><b>{num(maturity.maturity_percent, 1)}%</b></div>
            </section>
          </div>

          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <section className="glass section">
              <div className="eyebrow">GUARD TRANSITION HISTORY</div>
              <h2>Capacity state changes</h2>
              {transitions.length === 0 ? <p className="muted">No guard transition has been recorded.</p> : transitions.slice(0, 12).map((t: any) => (
                <div className="list-row" key={String(t.id)}>
                  <span>{String(t.from_status ?? 'START')} → {String(t.to_status)}</span>
                  <b>{String(t.transition_type)}</b>
                </div>
              ))}
            </section>

            <section className="glass section">
              <div className="eyebrow">RECONCILIATION</div>
              <h2>Latest integrity state</h2>
              <div className="list-row"><span>Last reconciliation</span><b>{reconciliation.last_run_ok ? 'PASS' : 'CHECK'}</b></div>
              <div className="list-row"><span>Liability diff</span><b>{money(reconciliation.liability_diff_usd, 8)}</b></div>
              <div className="list-row"><span>Pool violations</span><b>{num(reconciliation.pool_violation_count, 0)}</b></div>
              <div className="list-row"><span>Crypto violations</span><b>{num(reconciliation.crypto_violation_count, 0)}</b></div>
              <div className="list-row"><span>Negative balances</span><b>{num(reconciliation.negative_balance_count, 0)}</b></div>
              <div className="list-row"><span>Reserved over balance</span><b>{num(reconciliation.reserved_over_balance_count, 0)}</b></div>
            </section>
          </div>

          <section className="glass section" style={{ marginTop: 14 }}>
            <div className="eyebrow">MONITORING RUN HISTORY</div>
            <h2>Recent worker runs</h2>
            {runs.length === 0 ? <p className="muted">No monitoring run history yet.</p> : runs.slice(0, 12).map((run: any) => (
              <div className="list-row" key={String(run.id)}>
                <span>{String(run.run_at)} · anomalies {num(run.anomaly_count, 0)} · alerts {num(run.alert_count, 0)}</span>
                <b className={badge(String(run.severity ?? 'INFO'))}>{String(run.severity ?? 'INFO')}</b>
              </div>
            ))}
            <p className="muted" style={{ marginTop: 12 }}>The monitoring worker is scheduled every 15 minutes. Alerts are persisted in the admin alert queue; no external email/Slack delivery is claimed unless a channel is explicitly configured.</p>
          </section>
        </>
      )}
    </AppShell>
  );
}
