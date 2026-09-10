import { PublicPage } from '@/components/public/PublicPage';

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms governing use of the NextGen Miner platform.',
};

export default function TermsPage() {
  return (
    <PublicPage
      eyebrow="LEGAL · TERMS"
      title="Terms of Service"
      description="Rules for account use, virtual miners, rewards, withdrawals and platform security."
    >
      <section className="public-card public-hero">
        <div className="public-note">
          These operational terms should be reviewed against the final operating entity,
          jurisdiction and applicable law before commercial launch.
        </div>
        <h2>1. Account</h2>
        <p>
          Users must provide accurate account information, protect their credentials and maintain
          only accounts permitted by the platform. Sharing credentials or attempting to bypass
          security controls is prohibited.
        </p>
        <h2>2. Virtual miners</h2>
        <p>
          Miner ownership, levels, hashrate and status are platform-managed digital records.
          The platform may change, suspend or retire features according to its published rules.
        </p>
        <h2>3. Rewards</h2>
        <p>
          Reward values are controlled by server-side platform economics and available resources.
          Browser values or estimates are not final credits. Rewards are not guaranteed returns.
        </p>
        <h2>4. Deposits and withdrawals</h2>
        <p>
          Deposits remain pending until reviewed by the platform's applicable process.
          Withdrawals are subject to the current minimum withdrawal, qualifying top-up requirements,
          supported payout methods and review controls.
        </p>
        <h2>5. Prohibited activity</h2>
        <p>
          Fraud, bots, duplicate-account abuse, manipulation of callbacks, exploitation of bugs,
          unauthorized access and attempts to manipulate rewards or financial records are prohibited.
        </p>
        <h2>6. Suspension and reversal</h2>
        <p>
          The platform may reject, suspend or reverse activity when required to protect users,
          platform integrity or security, subject to applicable law and the final operating policy.
        </p>
        <h2>7. Changes</h2>
        <p>
          Features, economic parameters, supported assets and operational rules may change.
          Continued use after an updated policy is published constitutes acceptance where permitted by law.
        </p>
      </section>
    </PublicPage>
  );
}
