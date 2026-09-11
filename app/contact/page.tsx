import { PublicPage } from '@/components/public/PublicPage';
import { siteConfig } from '@/lib/site-config';

export const metadata = {
  title: 'Contact',
  description: 'Official support and security contact options for NextGen Miner.',
  alternates: { canonical: '/contact' },
  openGraph: { url: '/contact' },
};

function Channel({ name, description, url }: { name: string; description: string; url: string }) {
  if (!url) {
    return (
      <div className="public-contact">
        <div><strong>{name}</strong><br /><span>{description}</span></div>
        <small>Official link not configured</small>
      </div>
    );
  }
  return (
    <a className="public-contact" href={url} target="_blank" rel="noreferrer">
      <div><strong>{name}</strong><br /><span>{description}</span></div>
      <span>Open →</span>
    </a>
  );
}

export default function ContactPage() {
  return (
    <PublicPage
      eyebrow="SUPPORT & CONTACT"
      title="Contact NextGen Miner"
      description="Use an official channel for support. Never send passwords, recovery codes, private keys or wallet secrets."
    >
      <section className="public-card public-hero">
        <h2>Official channels</h2>
        <div className="public-list">
          <Channel name="Discord" description="Community and support channel." url={siteConfig.discordUrl} />
          <Channel name="Telegram" description="Official Telegram support/community channel." url={siteConfig.telegramUrl} />
          <Channel name="X" description="Official public updates and announcements." url={siteConfig.xUrl} />
          {siteConfig.supportEmail ? (
            <a className="public-contact" href={`mailto:${siteConfig.supportEmail}`}>
              <div><strong>Support Email</strong><br /><span>{siteConfig.supportEmail}</span></div>
              <span>Email →</span>
            </a>
          ) : (
            <div className="public-contact">
              <div><strong>Support Email</strong><br /><span>Monitored support address.</span></div>
              <small>Not configured</small>
            </div>
          )}
        </div>
        <h2>Security reports</h2>
        <p>When reporting a security issue, include reproducible steps and relevant non-sensitive evidence. Do not include passwords, authentication codes, private keys, seed phrases or other credentials.</p>
        <h2>Account support</h2>
        <p>Signed-in users can also use the in-app Support Center for account, miner, wallet and transaction questions.</p>
      </section>
    </PublicPage>
  );
}
