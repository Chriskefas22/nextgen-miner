import { AppShell } from '@/components/layout/AppShell';

export default function Surveys() {
  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">SURVEYS</div>
          <h1 className="page-title">Survey Rewards</h1>
          <div className="muted">Survey providers are not live yet.</div>
        </div>
      </div>

      <section className="glass section">
        <div className="eyebrow">NOT LIVE</div>
        <h2>No survey provider is connected.</h2>
        <p className="muted">
          Survey provider integrations are intentionally deferred. This page will not display
          fabricated offers or rewards until a verified provider feed is connected.
        </p>
      </section>
    </AppShell>
  );
}
