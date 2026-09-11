import Link from 'next/link';

type PublicPageProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
};

const links = [
  ['/about', 'About'],
  ['/how-it-works', 'How It Works'],
  ['/miner-catalog', 'Miners'],
  ['/faq', 'Find Answers'],
  ['/referrals', 'Referral Program'],
  ['/legal/privacy', 'Privacy'],
  ['/legal/terms', 'Terms'],
  ['/legal/disclaimer', 'Disclaimer'],
  ['/contact', 'Contact'],
] as const;

export function PublicPage({ eyebrow, title, description, children }: PublicPageProps) {
  return (
    <main className="ng-public">
      <div className="public-wrap">
        <header className="public-nav">
          <Link className="public-brand" href="/">
            NEXTGEN <span>MINER</span>
          </Link>
          <nav className="public-navlinks" aria-label="Public navigation">
            <Link href="/about">About</Link>
            <Link href="/how-it-works">How It Works</Link>
            <Link href="/miner-catalog">Miners</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/referrals">Referral</Link>
            <Link href="/contact">Contact</Link>
          </nav>
          <div className="public-actions">
            <Link className="public-button" href="/auth/login">Login</Link>
            <Link className="public-button-primary" href="/auth/register">Register</Link>
          </div>
          <details className="public-mobile-nav">
            <summary aria-label="Open public navigation">☰</summary>
            <nav aria-label="Mobile public navigation">
              <Link href="/">Home</Link>
              <Link href="/about">About</Link>
              <Link href="/how-it-works">How It Works</Link>
              <Link href="/miner-catalog">Miners</Link>
              <Link href="/faq">Find Answers</Link>
              <Link href="/referrals">Referral Program</Link>
              <Link href="/legal/privacy">Privacy Policy</Link>
              <Link href="/legal/terms">Terms of Service</Link>
              <Link href="/legal/disclaimer">Disclaimer</Link>
              <Link href="/contact">Contact</Link>
              <Link href="/auth/register">Register</Link>
              <Link href="/auth/login">Login</Link>
            </nav>
          </details>
        </header>

        <section className="public-card public-hero">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </section>

        {children}

        <footer className="public-footer">
          <span>© {new Date().getFullYear()} NextGen Miner · Virtual mining &amp; reward platform</span>
          <nav className="public-footer-links" aria-label="Footer navigation">
            {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
          </nav>
        </footer>
      </div>
    </main>
  );
}
