import { PublicPage } from '@/components/public/PublicPage';

export const metadata = {
  title: 'Privacy Policy',
  description: 'Privacy information for NextGen Miner accounts and platform operations.',
};

export default function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="LEGAL · PRIVACY"
      title="Privacy Policy"
      description="How account, security and platform-operation information is handled."
    >
      <section className="public-card public-hero">
        <div className="public-note">
          This policy describes the platform's current operational handling. Final operator identity,
          legal jurisdiction, retention schedule and any legally required notices should be completed
          against the actual operating entity before commercial launch.
        </div>
        <h2>Information we may process</h2>
        <ul>
          <li>Account information such as email address and username.</li>
          <li>Authentication and session information.</li>
          <li>Miner ownership, upgrades, wallet and transaction records.</li>
          <li>Security, anti-abuse and verification information where configured.</li>
          <li>Support requests and communications submitted by the user.</li>
        </ul>
        <h2>Why it is used</h2>
        <p>
          Information is used to authenticate accounts, provide platform functions,
          enforce ownership and reward rules, detect abuse, maintain transaction integrity,
          process support requests and protect the service.
        </p>
        <h2>Service providers</h2>
        <p>
          The service may use hosting, database, authentication, security and other infrastructure
          providers. Those providers may process information as required to provide their services.
        </p>
        <h2>Security</h2>
        <p>
          Production traffic is served over HTTPS and sensitive operations are designed to use
          authenticated server-side controls. No security system can guarantee absolute security.
        </p>
        <h2>Retention and requests</h2>
        <p>
          Information may be retained for operation, security, dispute handling, transaction
          integrity and applicable legal obligations. Privacy requests should use the official
          contact channel published on the Contact page.
        </p>
        <h2>Updates</h2>
        <p>This page will be updated when the platform's privacy practices materially change.</p>
      </section>
    </PublicPage>
  );
}
