import Link from 'next/link';
import { PublicPage } from '@/components/public/PublicPage';

export const metadata = {
  title: 'About NextGen Miner',
  description: 'How NextGen Miner works and the principles behind the platform.',
};

export default function AboutPage() {
  return (
    <PublicPage
      eyebrow="ABOUT THE PLATFORM"
      title="A virtual mining platform built around clear rules."
      description="NextGen Miner combines virtual miners, hashrate progression, wallet management and server-side platform controls."
    >
      <section className="public-card public-hero">
        <h2>How it works</h2>
        <p>
          Users create an account, verify access, acquire eligible virtual miners,
          progress through miner levels and manage eligible rewards through the platform wallet.
        </p>
        <div className="public-grid">
          <article className="public-info"><h3>Virtual miners</h3><p>Miner ownership and progression are recorded by the platform backend.</p></article>
          <article className="public-info"><h3>Server-side rules</h3><p>Sensitive wallet, reward and ownership operations are validated outside the browser.</p></article>
          <article className="public-info"><h3>Database campaigns</h3><p>Launch allocations are controlled by database state rather than page refreshes or client counters.</p></article>
        </div>
        <h2>Rewards and risk</h2>
        <p>
          Mining rewards are not guaranteed income or guaranteed investment returns.
          Reward values can depend on configured platform economics, available reward resources,
          campaign conditions and applicable risk controls.
        </p>
        <h2>Transparency</h2>
        <p>
          NextGen Miner publishes its public product information and policies so visitors can
          review the platform before registration. Operator identity, jurisdiction and official
          business details should be completed before commercial launch rather than invented.
        </p>
        <p>
          Read the <Link href="/legal/terms" style={{ color: 'var(--public-cyan)' }}>Terms of Service</Link>,
          <Link href="/legal/privacy" style={{ color: 'var(--public-cyan)', marginLeft: 5 }}>Privacy Policy</Link> and
          <Link href="/legal/disclaimer" style={{ color: 'var(--public-cyan)', marginLeft: 5 }}>Disclaimer</Link>.
        </p>
      </section>
    </PublicPage>
  );
}
