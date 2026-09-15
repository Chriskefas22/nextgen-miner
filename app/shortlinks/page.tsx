import { AppShell } from '@/components/layout/AppShell';

export default function Shortlinks() {
  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">SHORTLINKS</div>
          <h1 className="page-title">Link Missions</h1>
          <div className="muted">Provider-validated completion ledger.</div>
        </div>
      </div>
      <section className="glass section">
        <div className="section-head">
          <div>
            <div className="eyebrow">PROVIDER STATUS</div>
            <h2>Shortlinks are not live</h2>
          </div>
          <span className="badge">NOT LIVE</span>
        </div>
        <p className="muted">
          No verified shortlink provider/campaign is active in production. Rewards are not displayed or promised until a real provider is integrated and its completion ledger is verified server-side.
        </p>
      </section>
    </AppShell>
  );
}
