import Link from 'next/link';
import { PublicPage } from '@/components/public/PublicPage';
import { publicCompliance, siteConfig } from '@/lib/site-config';

export const metadata = {
  title: 'Contact',
  description: 'Official support and security contact options for NextGen Miner.',
  alternates: { canonical: '/contact' },
  openGraph: { url: '/contact' },
};

function ExternalChannel({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  if (!url) return null;

  return (
    <a className="public-contact" href={url} target="_blank" rel="noreferrer">
      <div>
        <strong>{name}</strong><br />
        <span>{description}</span>
      </div>
      <span>Open →</span>
    </a>
  );
}

export default function ContactPage() {
  return (
    <PublicPage
      eyebrow="SUPPORT & CONTACT"
      title="Contact NextGen Miner"
      description="Use an official support path. Never send passwords, recovery codes, private keys or wallet secrets."
    >
      <section className="public-card public-hero">
        <h2>Support</h2>
        <div className="public-list">
          {siteConfig.supportEmail ? (
            <a className="public-contact" href={`mailto:${siteConfig.supportEmail}`}>
              <div>
                <strong>Support Email</strong><br />
                <span>{siteConfig.supportEmail}</span>
              </div>
              <span>Email →</span>
            </a>
          ) : null}

          <Link className="public-contact" href="/auth/login">
            <div>
              <strong>Support Center</strong><br />
              <span>Sign in to open and track support tickets.</span>
            </div>
            <span>Sign in →</span>
          </Link>

          <ExternalChannel name="Discord" description="Community and support channel." url={siteConfig.discordUrl} />
          <ExternalChannel name="Telegram" description="Official Telegram support/community channel." url={siteConfig.telegramUrl} />
          <ExternalChannel name="X" description="Official public updates and announcements." url={siteConfig.xUrl} />
        </div>

        {!publicCompliance.supportReady ? (
          <div className="public-note">
            The Support Center is available for signed-in users. The official monitored support email has not yet been configured; complete that deployment setting before commercial launch.
          </div>
        ) : null}

        {publicCompliance.operatorIdentityReady ? (
          <div className="public-note">
            Operator: {siteConfig.legalEntityName} · Jurisdiction: {siteConfig.jurisdiction} · Address: {siteConfig.legalAddress}
          </div>
        ) : (
          <div className="public-note">
            The final operator identity, jurisdiction and legal address must be configured from the actual operating entity before commercial launch.
          </div>
        )}

        <h2>Security reports</h2>
        <p>
          Report security issues through the Support Center. Include reproducible steps and relevant
          non-sensitive evidence only. Never include passwords, authentication codes, private keys,
          seed phrases or other credentials.
        </p>

        <h2>Account support</h2>
        <p>
          Signed-in users can use the in-app Support Center for account, miner, wallet and
          transaction questions.
        </p>
      </section>
    </PublicPage>
  );
}
