import { PublicPage } from '@/components/public/PublicPage';
import { publicCompliance, siteConfig } from '@/lib/site-config';

export const metadata = {
  title: 'Privacy Policy',
  description: 'Detailed privacy information for NextGen Miner accounts, security, support and platform operations.',
  alternates: { canonical: '/legal/privacy' },
  openGraph: { url: '/legal/privacy' },
};

export default function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="LEGAL · PRIVACY"
      title="Privacy Policy"
      description="How NextGen Miner may process information to operate accounts, security, support and platform functions."
    >
      <section className="public-card public-hero">
        <div className="public-note">
          Effective date: {siteConfig.privacyEffectiveDate}
          {publicCompliance.operatorIdentityReady
            ? ` · Operator: ${siteConfig.legalEntityName} · Jurisdiction: ${siteConfig.jurisdiction}`
            : ' · Final operator identity, jurisdiction and legal address remain a commercial-launch requirement.'}
        </div>

        <h2>1. Information we may process</h2>
        <ul>
          <li>Account data such as email address, username and account identifiers.</li>
          <li>Authentication, verification and session information.</li>
          <li>Miner ownership, level, hashrate and status records.</li>
          <li>Diamond wallet balances and transaction ledger records.</li>
          <li>Deposit, withdrawal, payout and transaction metadata required to operate the service.</li>
          <li>Referral attribution and qualification records.</li>
          <li>Security, anti-abuse, device and verification information where configured.</li>
          <li>Support requests, communications and technical reports submitted by users.</li>
        </ul>

        <h2>2. Why information is used</h2>
        <p>Information may be used to secure accounts, provide miner and wallet functions, enforce ownership and reward rules, review transactions, prevent fraud and abuse, investigate technical issues, respond to support requests, maintain service integrity and comply with applicable obligations.</p>

        <h2>3. Authentication and security</h2>
        <p>Authentication information protects account access. Sensitive operations may require authenticated server-side checks. Never send passwords, recovery codes, seed phrases, private keys or other secrets to support.</p>

        <h2>4. Transactions and financial records</h2>
        <p>Transaction information may be retained for ledger integrity, dispute handling, deposit or withdrawal review and applicable legal or operational requirements.</p>

        <h2>5. Cookies and local storage</h2>
        <p>The website may use cookies, local storage or similar technology for authentication, preferences, security and application functionality. Production cookies should be limited to the purposes actually required by the deployed application.</p>

        <h2>6. Service providers</h2>
        <p>The current platform stack uses Vercel for web hosting/deployment and Supabase for database and authentication services. Optional provider-backed monetization services are not treated as active until they are actually configured and enabled. Provider-specific disclosures should be updated when a new processor becomes active.</p>

        <h2>7. Data sharing and international processing</h2>
        <p>Personal information should only be shared for legitimate operational, security, legal or user-requested purposes. Cross-border processing disclosures must reflect the actual production provider set and applicable law.</p>

        <h2>8. Retention and user requests</h2>
        <p>Information may be retained for account operation, security, transaction integrity, dispute handling, fraud prevention, support and legal obligations. Depending on applicable law, users may have rights to access, correct, delete or restrict processing. Requests can be submitted through the official Support Center.</p>

        <h2>9. Children and eligibility</h2>
        <p>Participation is limited to users aged {siteConfig.minimumAge} or older, or to a higher minimum where applicable law requires it. The platform must not permit underage participation where prohibited.</p>

        <h2>10. Security limitations</h2>
        <p>Reasonable safeguards should be used, but no online system can guarantee absolute security. Users are responsible for protecting credentials and devices.</p>

        <h2>11. Policy changes</h2>
        <p>Material changes to privacy practices will be reflected in this policy together with an updated effective date and change record.</p>
      </section>
    </PublicPage>
  );
}
