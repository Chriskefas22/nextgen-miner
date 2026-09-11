import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import NetworkCore from '@/components/landing/NetworkCore';

type BonusStatus = {
  total_slots?: number;
  claimed_slots?: number;
  remaining_slots?: number;
  active?: boolean;
  bonus_miner?: {
    name?: string;
    hashrate?: number;
    image_path?: string;
  } | null;
};

const miners = [
  { name: 'Basic CPU', price: '500', rate: '20 H/s', level: 'Lv. 1–10', image: '/assets/miners/basic-cpu.webp' },
  { name: 'Entry GPU', price: '1,000', rate: '60 H/s', level: 'Lv. 1–10', image: '/assets/miners/entry-gpu.webp' },
  { name: 'Mini Rig', price: '2,500', rate: '150 H/s', level: 'Lv. 1–10', image: '/assets/miners/mini-rig.webp' },
  { name: 'Gaming PC', price: '7,500', rate: '450 H/s', level: 'Lv. 1–10', image: '/assets/miners/gaming-pc.webp' },
  { name: 'Performance Rig', price: '15,000', rate: '850 H/s', level: 'Lv. 1–10', image: '/assets/miners/performance-rig.webp' },
];

function fmt(value: number | undefined, fallback = '—') {
  return typeof value === 'number' ? value.toLocaleString('en-US') : fallback;
}

export default async function LandingPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('nextgen_get_registration_bonus_status');
  const bonus = (data ?? null) as BonusStatus | null;

  const total = typeof bonus?.total_slots === 'number' ? bonus.total_slots : 1000;
  const claimed = typeof bonus?.claimed_slots === 'number' ? Math.max(0, bonus.claimed_slots) : 3;
  const remaining =
    typeof bonus?.remaining_slots === 'number'
      ? Math.max(0, bonus.remaining_slots)
      : Math.max(0, total - claimed);
  const claimedPercent = total > 0 ? Math.min(100, Math.max(0, (claimed / total) * 100)) : 0;

  const bonusMinerName = bonus?.bonus_miner?.name || 'Entry GPU';
  const bonusHashrate =
    typeof bonus?.bonus_miner?.hashrate === 'number'
      ? `${bonus.bonus_miner.hashrate.toLocaleString('en-US')} H/s`
      : '60 H/s';
  const bonusImage = bonus?.bonus_miner?.image_path || '/assets/miners/entry-gpu.webp';

  return (
    <main className="ng-fp">
      <header className="nav">
        <Link className="brand" href="/" aria-label="NextGen Miner home">
          <span className="logo">N</span>
          <span>NEXTGEN <span>MINER</span></span>
        </Link>

        <nav className="navlinks" aria-label="Primary navigation">
          <a className="active" href="#top">Home</a>
          <a href="#about">About</a>
          <a href="#faq">FAQ</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#miners">Miners</a>
          <a href="#referral-program">Referral Program</a>
        </nav>

        <div className="navactions">
          <Link className="navbtn primary" href="/auth/register">Register</Link>
          <Link className="navbtn" href="/auth/login">Login</Link>
        </div>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
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
        <div className="hero-vignette" aria-hidden="true" />

        <div className="hero-content">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-pulse" aria-hidden="true" />
              NEXTGEN MINER NETWORK
            </div>

            <h1 id="hero-title">
              Build your rig.
              <strong>Earn. Upgrade.<br />Withdraw.</strong>
            </h1>

            <p className="hero-desc">
              Power the future with your miners. Build your rig, grow your hashrate and manage rewards
              through a virtual crypto-mining network designed around live platform data.
            </p>

            <div className="hero-actions">
              <Link href="/auth/register" className="cta primary">
                Create Free Account <span aria-hidden="true">→</span>
              </Link>
              <Link href="/auth/login" className="cta ghost">Login</Link>
            </div>

            <div className="hero-microcopy">
              <span><i /> Network online</span>
              <span>Server-side rules</span>
              <span>No guaranteed returns</span>
            </div>
          </div>

          <div className="hero-gpu" aria-hidden="true">
            <div className="gpu-aura" />
            <div className="gpu-floor" />
            <Image
              src="/assets/landing/nextgen-miner-hero.png"
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 95vw, 60vw"
              className="hero-gpu-image"
            />
          </div>
        </div>

        <div className="hero-statusbar" aria-label="Platform telemetry">
          <span><i /> NETWORK ONLINE</span>
          <span>MINER ENGINE READY</span>
          <span>WALLET CONTROLS PROTECTED</span>
          <span>SERVER-SIDE VALIDATION</span>
        </div>
      </section>

      <section className="trust" id="about">
        <div className="trust-grid">
          <article className="trust-item">
            <span className="trust-icon">ϟ</span>
            <div><b>Secure &amp; Trusted</b><small>HTTPS and authenticated account controls.</small></div>
          </article>
          <article className="trust-item">
            <span className="trust-icon">◇</span>
            <div><b>Transparent Platform</b><small>Clear rules and server-side reward controls.</small></div>
          </article>
          <article className="trust-item">
            <span className="trust-icon">✓</span>
            <div><b>Fair &amp; Sustainable</b><small>Reward values depend on platform economics.</small></div>
          </article>
          <article className="trust-item">
            <span className="trust-icon">▣</span>
            <div><b>No Guaranteed Returns</b><small>Mining rewards are not guaranteed income.</small></div>
          </article>
        </div>
      </section>

      <section className="network-section" aria-labelledby="network-title">
        <div className="hud-frame">
          <div className="hud-corner hud-tl" />
          <div className="hud-corner hud-tr" />
          <div className="hud-corner hud-bl" />
          <div className="hud-corner hud-br" />

          <div className="network-heading">
            <div>
              <div className="eyebrow"><span className="live-dot" aria-hidden="true" /> NETWORK CORE</div>
              <h2 id="network-title">Global Mining Network</h2>
            </div>
            <div className="network-online"><i /> ONLINE</div>
          </div>

          <div className="network-grid">
            <div className="network-visual">
              <div className="network-globe"><NetworkCore /></div>
              <div className="core-ring ring-a" aria-hidden="true" />
              <div className="core-ring ring-b" aria-hidden="true" />
              <div className="core-ring ring-c" aria-hidden="true" />
            </div>

            <div className="network-status">
              <div className="status-label">PLATFORM STATUS</div>
              <div className="status-main">OPERATIONAL</div>
              <div className="status-meter"><span /></div>
              <div className="status-meta"><span>LIVE SYSTEM</span><strong><i /> SYNCED</strong></div>

              <div className="network-metrics">
                <article><span className="metric-icon">✦</span><div><small>GLOBAL HASHRATE</small><b>2.48 PH/s</b><em>↗ 12.6%</em></div></article>
                <article><span className="metric-icon">◎</span><div><small>ACTIVE MINERS</small><b>12,842</b><em>↗ 8.3%</em></div></article>
                <article><span className="metric-icon">◈</span><div><small>NETWORK NODES</small><b>8 / 8</b><em>↗ 100%</em></div></article>
                <article><span className="metric-icon">◷</span><div><small>SYSTEM UPTIME</small><b>99.97%</b><em>↗ 0.02%</em></div></article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="campaign" aria-labelledby="campaign-title">
        <div className="campaign-copy">
          <div className="eyebrow"><span className="bonus-spark" aria-hidden="true">✦</span> REGISTRATION BONUS CAMPAIGN</div>
          <div className="campaign-tag">{bonusMinerName.toUpperCase()}</div>
          <h2 id="campaign-title">Get Your <span>{bonusMinerName}</span></h2>
          <h3>Right After Verification!</h3>
          <p>
            Complete your registration and email verification to become eligible for the launch allocation.
            The active campaign and remaining slots are checked server-side.
          </p>

          <div className="bonus-specs">
            <div><small>REWARD</small><b>{bonusMinerName}</b><em>{bonusHashrate}</em></div>
            <div><small>ELIGIBILITY</small><b>VERIFIED</b><em>Server checked</em></div>
            <div><small>ALLOCATION</small><b>LIMITED</b><em>{fmt(total)} total</em></div>
          </div>

          <div className="allocation-bar">
            <div className="allocation-track" aria-hidden="true">
              <i style={{ width: `${Math.max(0, Math.min(100, 100 - claimedPercent))}%` }} />
            </div>
            <div className="allocation-labels">
              <span><strong>{fmt(remaining)}</strong> LEFT</span>
              <span><strong>{fmt(claimed)}</strong> CLAIMED / {fmt(total)} TOTAL</span>
            </div>
          </div>

          <Link href="/auth/register" className="cta primary">Join Now <span aria-hidden="true">→</span></Link>
          {error && <small className="campaign-error">Live campaign data temporarily unavailable; safe fallback values are shown.</small>}
        </div>

        <div className="bonus-visual" aria-label={`${bonusMinerName} registration bonus visual`}>
          <div className="bonus-hud">
            <span>{bonusMinerName.toUpperCase()}</span>
            <b>LIMITED ALLOCATION</b>
          </div>
          <div className="gpu-platform">
            <div className="gpu-glow" />
            <Image
              src={bonusImage}
              alt=""
              fill
              sizes="(max-width: 760px) 86vw, 46vw"
              className="entry-gpu-image"
            />
          </div>
          <div className="bonus-orbit orbit-one" aria-hidden="true" />
          <div className="bonus-orbit orbit-two" aria-hidden="true" />
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="section-head">
          <div className="eyebrow">HOW IT WORKS</div>
          <h2>Start Your Mining Journey</h2>
          <p>A five-step path from account creation to an upgraded mining network and wallet management.</p>
        </div>
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
          <div className="miner-intro">
            <div className="eyebrow">OUR MINERS</div>
            <h2>Choose Your Miner</h2>
            <p>Different miner tiers provide different hashrate and progression paths.</p>
            <Link href="/miners" className="cta primary">View All Miners <span aria-hidden="true">→</span></Link>
          </div>

          {miners.map((miner) => (
            <article className="miner-card" key={miner.name}>
              <div className="miner-img">
                <Image src={miner.image} alt="" fill sizes="(max-width: 900px) 45vw, 16vw" loading="lazy" />
              </div>
              <div className="miner-info">
                <h3>{miner.name}</h3>
                <b>{miner.rate}</b>
                <small>{miner.price} 💎 · {miner.level}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="transparency">
        <div className="section-head">
          <div className="eyebrow">SECURE · TRANSPARENT · TRUSTED</div>
          <h2>Built for a Safer Mining Experience</h2>
          <p>Important information is visible before registration. Sensitive actions remain subject to server-side validation.</p>
        </div>
        <div className="feature-grid">
          <article className="feature"><div className="icon">◈</div><h3>SSL ENCRYPTED</h3><p>Production access uses HTTPS.</p></article>
          <article className="feature"><div className="icon">◇</div><h3>SERVER-SIDE RULES</h3><p>Wallet and reward actions are validated by backend rules.</p></article>
          <article className="feature"><div className="icon">◎</div><h3>GLOBAL NETWORK</h3><p>Built to support a scalable virtual mining environment.</p></article>
          <article className="feature"><div className="icon">◆</div><h3>PUBLIC POLICIES</h3><p>About, Contact, Privacy, Terms and Disclaimer are available.</p></article>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="section-head">
          <div className="eyebrow">FREQUENTLY ASKED QUESTIONS</div>
          <h2>Find Your Answers</h2>
        </div>
        <div className="faq-list">
          <details className="faq"><summary>Is the platform free to join?</summary><p>Account creation is free. Miner ownership and reward conditions follow the rules shown in the platform.</p></details>
          <details className="faq"><summary>How do I get the launch bonus?</summary><p>Register and complete email verification. Eligibility is checked against the active server-side campaign and its remaining allocation.</p></details>
          <details className="faq"><summary>How are rewards calculated?</summary><p>Reward values depend on configured platform mining economics, available reward resources and applicable controls.</p></details>
          <details className="faq"><summary>Can I upgrade my miner?</summary><p>Yes. Eligible owned miners can progress through their available levels subject to wallet balance and upgrade rules.</p></details>
        </div>
      </section>

      <section className="section" id="referral-program">
        <div className="final">
          <div>
            <div className="eyebrow">ENTER THE NETWORK</div>
            <h2>Build today. Power tomorrow.</h2>
            <p>Read the public information, create your account and start building your virtual mining network.</p>
          </div>
          <Link href="/auth/register" className="cta primary">Create Free Account <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <footer className="footer">
        <div className="footerin">
          <div>© {new Date().getFullYear()} NextGen Miner · Virtual mining &amp; reward platform</div>
          <nav className="footerlinks" aria-label="Footer navigation">
            <Link href="/about">About</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/referrals">Referral Program</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/legal/privacy">Privacy Policy</Link>
            <Link href="/legal/terms">Terms of Service</Link>
            <Link href="/legal/disclaimer">Disclaimer</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
