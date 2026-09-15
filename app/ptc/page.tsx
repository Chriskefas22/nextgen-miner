import { AppShell } from '@/components/layout/AppShell';

export default function PTC() {
  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">PAID TO CLICK</div>
          <h1 className="page-title">PTC Missions</h1>
          <div className="muted">Provider campaigns are not live yet.</div>
        </div>
      </div>

      <section className="glass section">
        <div className="eyebrow">NOT LIVE</div>
        <h2>PTC campaign engine is waiting for verified campaigns.</h2>
        <p className="muted">
          No enabled PTC campaigns are currently published by the server. No fake campaigns,
          countdowns or rewards are shown while the provider/revenue integration is deferred.
        </p>
        <div className="list-row" style={{ marginTop: 12 }}>
          <span className="muted">Server state</span>
          <span className="badge">0 enabled campaigns</span>
        </div>
      </section>
    </AppShell>
  );
}
