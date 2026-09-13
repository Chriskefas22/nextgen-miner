import { AppShell } from '@/components/layout/AppShell';
import { LockKeyhole, Clock3, ShieldCheck } from 'lucide-react';

const plannedProviders = [
  {
    name: 'AdGem',
    status: 'STANDBY',
    detail: 'Server-side callback integration is ready. Offers remain hidden until the provider is configured and enabled by the platform.',
  },
  {
    name: 'CPX Research',
    status: 'PLANNED',
    detail: 'Provider integration is not configured yet.',
  },
  {
    name: 'BitLabs',
    status: 'PLANNED',
    detail: 'Provider integration is not configured yet.',
  },
] as const;

export default function Offers() {
  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">OFFERWALL</div>
          <h1 className="page-title">Offers &amp; Surveys</h1>
          <div className="muted">
            Rewards are credited only after an authenticated provider callback passes server-side validation.
          </div>
        </div>
      </div>

      <section className="glass section" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div className="icon-orb"><ShieldCheck size={18} /></div>
          <div>
            <div className="eyebrow">REVENUE SAFETY</div>
            <h2 style={{ fontFamily: 'Orbitron', fontSize: 15, marginBottom: 8 }}>
              Offerwall is not live yet
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              The platform stays fail-closed until a provider is configured, an offer catalog is synced, and a signed conversion callback is verified.
              Unverified activity cannot create Diamond or mining revenue.
            </p>
          </div>
        </div>
      </section>

      <div className="eyebrow">PROVIDER STATUS</div>
      <div className="grid grid-3">
        {plannedProviders.map((provider) => (
          <section className="glass section" key={provider.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <span className={`badge ${provider.status === 'STANDBY' ? 'amber' : ''}`}>
                {provider.status}
              </span>
              {provider.status === 'STANDBY' ? <Clock3 size={16} /> : <LockKeyhole size={16} />}
            </div>
            <h2 style={{ fontFamily: 'Orbitron', fontSize: 14, marginTop: 12 }}>{provider.name}</h2>
            <p className="muted">{provider.detail}</p>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled>
              Offers unavailable
            </button>
          </section>
        ))}
      </div>

      <section className="glass section" style={{ marginTop: 18 }}>
        <div className="eyebrow">HOW ACTIVATION WORKS</div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Provider credentials → offer catalog → signed callback test → reconciliation check → provider enablement → live offers.
          Each step is server-side and must pass validation before the next one can proceed.
        </p>
      </section>
    </AppShell>
  );
}
