import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

type BonusStatus = { total_slots?: number; claimed_slots?: number; remaining_slots?: number };

const miners = [
  { name: 'Basic CPU', price: '500', rate: '20 H/s', level: 'Lv. 1–10', image: '/assets/miners/basic-cpu.webp' },
  { name: 'Entry GPU', price: '1,000', rate: '60 H/s', level: 'Lv. 1–10', image: '/assets/miners/entry-gpu.webp' },
  { name: 'Mini Rig', price: '2,500', rate: '150 H/s', level: 'Lv. 1–10', image: '/assets/miners/mini-rig.webp' },
  { name: 'Gaming PC', price: '7,500', rate: '450 H/s', level: 'Lv. 1–10', image: '/assets/miners/gaming-pc.webp' },
  { name: 'Performance Rig', price: '15,000', rate: '850 H/s', level: 'Lv. 1–10', image: '/assets/miners/performance-rig.webp' },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('nextgen_get_registration_bonus_status');
  const bonus = (data ?? null) as BonusStatus | null;
  const fmt = (value: unknown) => typeof value === 'number' ? value.toLocaleString('en-US') : '—';

  return (
    <main className="ng-fp">
      <header className="nav">
        <Link className="brand" href="/">
          <div className="logo" aria-hidden="true">N</div>
          <div>NEXTGEN <span>MINER</span></div>
        </Link>
        <nav className="navlinks" aria-label="Primary navigation">
          <a href="#how-it-works">How It Works</a>
          <a href="#miners">Miners</a>
          <a href="#transparency">Features</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="navactions">
          <Link className="navbtn" href="/auth/login">Login</Link>
          <Link className="navbtn primary" href="/auth/register">Register</Link>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-bg" aria-hidden="true">
          <Image
            src="/assets/landing/nextgen-miner-hero.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="hero-image"
          />
        </div>
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-scan" aria-hidden="true" />
        <div className="hero-corner hero-corner-tl" aria-hidden="true" />
        <div className="hero-corner hero-corner-tr" aria-hidden="true" />
        <div className="hero-corner hero-corner-bl" aria-hidden="true" />
        <div className="hero-corner hero-corner-br" aria-hidden="true" />

        <div className="hero-content">
          <div className="hero-copy">
            <div className="eyebrow"><span className="status-pulse" aria-hidden="true" />NEXTGEN MINER NETWORK</div>
            <h1 id="hero-title">Build your rig.<strong>Earn. Upgrade.<br />Withdraw.</strong></h1>
            <p className="hero-desc">
              Power the future with your miners. Build your rig, grow your hashrate and manage rewards through a virtual crypto-mining network designed around live platform data.
            </p>
            <div className="hero-actions">
              <Link href="/auth/register" className="cta primary">Create Free Account <span aria-hidden="true">→</span></Link>
              <Link href="/auth/login" className="cta ghost">Login</Link>
            </div>
            <div className="hero-telemetry" aria-label="Platform status">
              <div className="telemetry"><b><span className="live-dot" aria-hidden="true" />Core Online</b><small>Network ready</small></div>
              <div className="telemetry"><b>Data Connected</b><small>Platform synchronized</small></div>
              <div className="telemetry"><b>Rules Active</b><small>Server-side controls</small></div>
            </div>
          </div>

          <aside className="hash-panel" aria-label="Network status">
            <div className="panel-top"><span>NETWORK CORE</span><span className="panel-live"><i aria-hidden="true" />ONLINE</span></div>
            <div className="core-visual" aria-hidden="true">
              <div className="core-ring ring-a" /><div className="core-ring ring-b" /><div className="core-ring ring-c" /><div className="core-orb" />
              <span className="core-ray ray-a" /><span className="core-ray ray-b" /><span className="core-ray ray-c" /><span className="core-ray ray-d" />
            </div>
            <div className="hash-copy">
              <label>PLATFORM STATUS</label><strong>OPERATIONAL</strong>
              <div className="hash-line" aria-hidden="true"><i /></div>
              <div className="hash-meta"><span>LIVE SYSTEM</span><span>SYNCED</span></div>
            </div>
          </aside>
        </div>

        <div className="hero-statusbar" aria-label="Network telemetry">
          <span><i aria-hidden="true" /> NETWORK ONLINE</span>
          <span>MINER ENGINE READY</span>
          <span>WALLET CONTROLS PROTECTED</span>
          <span>SERVER-SIDE VALIDATION</span>
        </div>
      </section>

      <section className="trust"><div className="trust-grid">
        <div className="trust-item"><b>Secure &amp; Trusted</b><small>HTTPS and authenticated account controls.</small></div>
        <div className="trust-item"><b>Transparent Platform</b><small>Clear rules and server-side reward controls.</small></div>
        <div className="trust-item"><b>Fair &amp; Sustainable</b><small>Reward values depend on platform economics.</small></div>
        <div className="trust-item"><b>No Guaranteed Returns</b><small>Mining rewards are not guaranteed income.</small></div>
      </div></section>

      <section className="section" id="how-it-works">
        <div className="section-head"><div className="eyebrow">HOW IT WORKS</div><h2>Start Your Mining Journey</h2><p>A five-step path from account creation to an upgraded mining network and wallet management.</p></div>
        <div className="steps">
          <article className="step"><div className="n">01</div><h3>REGISTER</h3><p>Create your account in minutes.</p></article>
          <article className="step"><div className="n">02</div><h3>VERIFY</h3><p>Confirm your email and security checks.</p></article>
          <article className="step"><div className="n">03</div><h3>MINE</h3><p>Your miner contributes hashrate to the platform.</p></article>
          <article className="step"><div className="n">04</div><h3>UPGRADE</h3><p>Increase hashrate with stronger miner levels.</p></article>
          <article className="step"><div className="n">05</div><h3>WITHDRAW</h3><p>Manage eligible rewards through your wallet.</p></article>
        </div>
      </section>

      <section className="section" id="miners">
        <div className="miners">
          <div className="miner-intro"><div className="eyebrow">OUR MINERS</div><h2>Choose Your Miner</h2><p>Different miner tiers provide different hashrate and progression paths.</p><Link href="/miners" className="cta primary">View All Miners <span aria-hidden="true">→</span></Link></div>
          {miners.map((miner) => <article className="miner-card" key={miner.name}><div className="miner-img"><img src={miner.image} alt="" loading="lazy" /></div><div className="miner-info"><h3>{miner.name}</h3><b>{miner.rate}</b><small>{miner.price} 💎 · {miner.level}</small></div></article>)}
        </div>
      </section>

      <section className="campaign">
        <div className="campaign-copy"><div className="eyebrow">LAUNCH CAMPAIGN</div><h2>Eligible verified registrations can receive an Entry GPU while campaign allocation remains available.</h2><p>Allocation is decided by the database after email verification. Refreshing the page cannot consume a campaign slot.</p><Link href="/auth/register" className="cta primary">Join Now <span aria-hidden="true">→</span></Link></div>
        <div className="meter"><div className="meter-core" aria-hidden="true"><div className="meter-ring" /><div className="meter-orb" /></div><div className="meter-copy"><span className="meter-label">REMAINING ALLOCATION</span><strong>{fmt(bonus?.remaining_slots)}<em> left</em></strong><small>{fmt(bonus?.claimed_slots)} claimed / {fmt(bonus?.total_slots)} total</small><div className="bar" aria-hidden="true"><i /></div></div></div>
      </section>

      <section className="section" id="transparency">
        <div className="section-head"><div className="eyebrow">SECURE · TRANSPARENT · TRUSTED</div><h2>Built for a Safer Mining Experience</h2><p>Important information is visible before registration. Sensitive actions remain subject to server-side validation.</p></div>
        <div className="feature-grid">
          <article className="feature"><div className="icon">◈</div><h3>SSL ENCRYPTED</h3><p>Production access uses HTTPS.</p></article>
          <article className="feature"><div className="icon">◇</div><h3>SERVER-SIDE RULES</h3><p>Wallet and reward actions are validated by backend rules.</p></article>
          <article className="feature"><div className="icon">◎</div><h3>GLOBAL NETWORK</h3><p>Built to support a scalable virtual mining environment.</p></article>
          <article className="feature"><div className="icon">◆</div><h3>PUBLIC POLICIES</h3><p>About, Contact, Privacy, Terms and Disclaimer are available.</p></article>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="section-head"><div className="eyebrow">FREQUENTLY ASKED QUESTIONS</div><h2>Find Your Answers</h2></div>
        <div className="faq-list">
          <details className="faq"><summary>Is the platform free to join?</summary><p>Account creation is free. Miner ownership and reward conditions follow the rules shown in the platform.</p></details>
          <details className="faq"><summary>How do I get the launch bonus?</summary><p>Successful registration becomes eligible after email verification, subject to the campaign&apos;s server-side allocation rules and remaining slots.</p></details>
          <details className="faq"><summary>How are rewards calculated?</summary><p>Reward values depend on the configured platform mining economics, available reward resources and applicable controls.</p></details>
          <details className="faq"><summary>Can I upgrade my miner?</summary><p>Yes. Eligible owned miners can progress through their available levels subject to wallet balance and upgrade rules.</p></details>
        </div>
      </section>

      <section className="section"><div className="final"><div><div className="eyebrow">ENTER THE NETWORK</div><h2>Build today. Power tomorrow.</h2><p>Read the public information, then create your account and start building your virtual mining network.</p></div><Link href="/auth/register" className="cta primary">Create Free Account <span aria-hidden="true">→</span></Link></div></section>

      <footer className="footer"><div className="footerin"><div>© {new Date().getFullYear()} NextGen Miner · Virtual mining &amp; reward platform</div><nav className="footerlinks" aria-label="Footer navigation">
        <Link href="/about">About</Link><Link href="/faq">FAQ</Link><Link href="/referrals">Referral Program</Link><Link href="/contact">Contact</Link><Link href="/legal/privacy">Privacy Policy</Link><Link href="/legal/terms">Terms of Service</Link><Link href="/legal/disclaimer">Disclaimer</Link>
      </nav></div></footer>
    </main>
  );
}
