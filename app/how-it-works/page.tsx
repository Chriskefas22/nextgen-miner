import Link from 'next/link';
import { PublicPage } from '@/components/public/PublicPage';

export const metadata = {
  title: 'How It Works',
  description: 'How Diamond, miners, hashrate, revenue-funded pools, rolling 10-day reward lots and crypto settlements work on NextGen Miner.',
  alternates: { canonical: '/how-it-works' },
  openGraph: { url: '/how-it-works' },
};

const steps = [
  ['01', 'REGISTER', 'Create an account with accurate information. Account creation itself is free.'],
  ['02', 'VERIFY', 'Complete email verification and any required security or eligibility checks.'],
  ['03', 'CLAIM BONUS', 'When an active campaign applies, the server checks eligibility and remaining allocation before assigning the launch miner.'],
  ['04', 'EARN DIAMOND', 'Complete supported earning activities such as offers, surveys, PTC and shortlinks to receive Diamond. Faucet rewards are engagement rewards, not crypto-funding revenue.'],
  ['05', 'BUILD HASHRATE', 'Diamond is an internal utility balance. It cannot be withdrawn as cash or crypto. Use it to buy, upgrade and merge miners that build your platform-managed H/s.'],
  ['06', 'MINE FROM THE POOL', 'Active weighted hashrate participates in a revenue-funded mining pool. More network H/s can reduce reward per H/s when revenue does not grow at the same pace.'],
  ['07', 'SETTLE & CLAIM', 'Mining settles every 24 hours. Rolling 10-day reward lots spread recognized mining allocation over time, while users can claim eligible settled crypto rewards without waiting 10 days.'],
  ['08', 'WITHDRAW', 'Eligible crypto can be withdrawn through supported payout routes, subject to current platform rules, balances, limits and review controls.'],
];

export default function HowItWorksPage() {
  return (
    <PublicPage
      eyebrow="HOW NEXTGEN MINER WORKS"
      title="Build mining capacity first. Earn crypto from the platform economy over time."
      description="NEXTGEN MINER connects user activity, Diamond utility, virtual miner hashrate and a revenue-funded pool. The exact live values are controlled server-side."
    >
      <section className="public-card public-hero">
        <div className="public-note">
          The authenticated product experience and server-side economic engine are the source of truth for user-specific rewards, balances, campaigns and withdrawals.
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

        <h2>How the NEXTGEN MINER economy flows</h2>
        <p>Monetization activities such as PTC, offers, surveys, shortlinks, memberships and other provider-backed activities can create recognized platform revenue. Deposits are different: the deposit principal remains user funds; only an actually recognized platform fee or margin can count as revenue.</p>
        <p>Recognized net revenue is allocated under the active economic rule: 50% mining, 30% reserve, 10% donation and 10% owner/platform. Mining uses funded pool capacity only. There is no guaranteed crypto yield and no artificial or fake pool funding.</p>
        <p>Diamond (💎) is an internal utility denomination. It is not a withdrawable asset. Diamond is used to acquire, upgrade and merge virtual miners; those miners create platform-managed hashrate rather than ownership of physical hardware.</p>

        <h2>Rolling 10-day reward model</h2>
        <p>The mining engine uses 24-hour settlement with rolling 10-day reward lots. The 10-day window is an economic smoothing and release mechanism, not a 10-day claim lock. Eligible settled crypto can be claimed when available.</p>
        <p>Reward distribution is based on weighted active hashrate, including the configured efficiency and energy state. As active network hashrate grows, reward per H/s can fall when pool revenue does not grow proportionally. As recognized revenue grows, the funded pool can grow as well.</p>
        <p>Reserve health is monitored against outstanding mining liability. The reserve safety multiplier can protect the mining budget when coverage weakens. A zero-revenue period produces zero newly funded mining rewards rather than creating an unfunded promise.</p>

        <h2>What does not fund crypto mining?</h2>
        <p>Faucet rewards, registration bonuses and free promotional miner grants are Diamond or utility incentives. They do not by themselves create crypto revenue or a mining liability. This separation keeps internal rewards distinct from actual monetization revenue.</p>

        <h2>What happens after a deposit?</h2>
        <p>A submitted deposit enters a pending state. Approval is a separate server-side review event. Deposit principal is not treated as mining revenue. Any platform fee or margin must be recognized separately before it can participate in the economic allocation.</p>

        <h2>No fixed return promise</h2>
        <p>NEXTGEN MINER does not promise a fixed amount of crypto per H/s. Pool size, recognized revenue, active weighted hashrate, reserve protection and asset rates can change. NEXTGEN MINER uses the principles of a dynamic pool without copying another platform's complete economic design.</p>

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 18 }}>
          <Link className="public-button-primary" href="/miner-catalog">Explore Miner Catalog →</Link>
          <Link className="public-button" href="/earn">Explore Ways to Earn</Link>
          <Link className="public-button" href="/faq">Find an Answer</Link>
          <Link className="public-button" href="/auth/register">Create Free Account</Link>
        </div>
      </section>
    </PublicPage>
  );
}
