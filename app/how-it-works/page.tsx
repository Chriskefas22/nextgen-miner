import Link from 'next/link';
import { PublicPage } from '@/components/public/PublicPage';

export const metadata = {
  title: 'How It Works',
  description: 'A complete public guide to registration, verification, miners, rewards, wallet actions and withdrawals on NextGen Miner.',
  alternates: { canonical: '/how-it-works' },
  openGraph: { url: '/how-it-works' },
};

const steps = [
  ['01', 'REGISTER', 'Create an account with accurate information. Account creation itself is free.'],
  ['02', 'VERIFY', 'Complete email verification and any required security or eligibility checks.'],
  ['03', 'CLAIM BONUS', 'When an active campaign applies, the server checks eligibility and remaining allocation before assigning the launch miner.'],
  ['04', 'BUILD & MINE', 'Choose eligible virtual miners, own them through the platform records and build your hashrate.'],
  ['05', 'UPGRADE', 'Progress eligible miners through available levels when the required Diamond balance and server rules are satisfied.'],
  ['06', 'MANAGE WALLET', 'Review Diamond and transaction records, deposits and other wallet functions from the authenticated account area.'],
  ['07', 'WITHDRAW', 'Submit an eligible withdrawal through supported payout routes, subject to current platform rules and review controls.'],
];

export default function HowItWorksPage() {
  return (
    <PublicPage
      eyebrow="HOW NEXTGEN MINER WORKS"
      title="From account creation to an upgraded mining network."
      description="Everything important is explained before you sign in. Private financial and ownership actions remain behind authentication and server-side validation."
    >
      <section className="public-card public-hero">
        <div className="public-note">
          The exact availability of miners, campaigns, networks, rewards and withdrawals can change with the live platform configuration. The authenticated product experience is the source of truth for user-specific actions.
        </div>
        <div className="public-grid">
          {steps.map(([number, title, description]) => (
            <article className="public-info" key={number}>
              <div className="eyebrow">{number}</div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>

        <h2>Understanding the platform economy</h2>
        <p>Diamond (💎) is the platform&apos;s internal economy unit used for miner-related pricing and rewards. Backend configuration controls economic values; public pages should not hard-code changing conversion or reward rules.</p>
        <p>Virtual miner hashrate represents a platform-managed digital state. It should not be interpreted as ownership of physical mining hardware unless a separate written agreement explicitly establishes that.</p>

        <h2>What happens after a deposit?</h2>
        <p>A submitted deposit enters a pending state. Credit is not final merely because a user submits a transaction. The platform&apos;s review process determines whether a pending deposit is approved or rejected, and an approved deposit is then credited according to the active server-side economic rules.</p>

        <h2>What happens when something is unavailable?</h2>
        <p>Maintenance, security controls, unsupported networks, depleted campaigns, insufficient wallet balance or other platform conditions can prevent an action. The UI should show the current server result rather than imply guaranteed availability.</p>

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 18 }}>
          <Link className="public-button-primary" href="/miner-catalog">Explore Miner Catalog →</Link>
          <Link className="public-button" href="/faq">Find an Answer</Link>
          <Link className="public-button" href="/auth/register">Create Free Account</Link>
        </div>
      </section>
    </PublicPage>
  );
}
