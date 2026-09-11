import Link from 'next/link';
import { PublicPage } from '@/components/public/PublicPage';

export const metadata = { title: 'About NextGen Miner', description: 'A detailed overview of the NextGen Miner virtual mining platform, its economy, controls and user journey.' };

export default function AboutPage() {
  return <PublicPage eyebrow="ABOUT THE PLATFORM" title="A virtual mining platform built around clear rules." description="Learn what NextGen Miner is, what the platform records, how the main systems connect and what users should understand before participating.">
    <section className="public-card public-hero">
      <h2>What NextGen Miner is</h2>
      <p>NextGen Miner is a virtual mining and reward platform. Users can create an account, complete verification, receive an eligible launch bonus when a campaign applies, acquire virtual miners, progress through miner levels and manage eligible rewards through the account wallet.</p>
      <p>The platform uses server-side controls and database state for sensitive ownership, reward, wallet and campaign decisions. Public pages explain the product before registration; authenticated pages handle user-specific actions.</p>
      <h2>How the main systems connect</h2>
      <div className="public-grid">
        <article className="public-info"><h3>Identity &amp; access</h3><p>Authentication determines access to account-specific features. Verification can also affect campaign eligibility and security controls.</p></article>
        <article className="public-info"><h3>Miner catalog</h3><p>Enabled miner definitions and level progression come from the platform database. The public catalog is visible without sign-in.</p></article>
        <article className="public-info"><h3>Wallet &amp; ledger</h3><p>Diamond and transaction records are managed by backend rules. Browser values are not treated as authoritative financial credits.</p></article>
      </div>
      <h2>Virtual miners and Diamond</h2>
      <p>Virtual miners are digital records inside the platform with configured hashrate, price, tier and levels. Diamond (💎) is the internal economy unit used for miner-related pricing and rewards.</p>
      <h2>Campaigns and promotional allocations</h2>
      <p>Launch campaigns such as the Entry GPU allocation are limited promotions governed by server-side campaign state. Remaining slots are checked against the database.</p>
      <h2>Rewards and expectations</h2>
      <p>Mining and referral rewards are not guaranteed income, profit or investment returns. Outcomes can depend on platform economics, available reward resources, eligibility rules and operational controls.</p>
      <h2>Security and integrity</h2>
      <p>Sensitive operations are intended to be validated server-side. Users should protect passwords and authentication factors, avoid sharing wallet secrets and report suspected vulnerabilities through official support.</p>
      <h2>Before you participate</h2>
      <p>Review the <Link href="/how-it-works">How It Works</Link> guide, <Link href="/miner-catalog">Miner Catalog</Link>, <Link href="/faq">FAQ</Link>, <Link href="/legal/terms">Terms of Service</Link>, <Link href="/legal/privacy">Privacy Policy</Link> and <Link href="/legal/disclaimer">Disclaimer</Link>. Operator identity, jurisdiction and formal business disclosures must be completed against the actual operating entity before commercial launch.</p>
    </section>
  </PublicPage>;
}
