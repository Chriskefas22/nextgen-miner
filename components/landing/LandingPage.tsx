import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import NetworkCore from '@/components/landing/NetworkCore';

type BonusStatus = {
  total_slots?: number | string;
  claimed_slots?: number | string;
  remaining_slots?: number | string;
  active?: boolean;
  bonus_miner?: {
    id?: number | string;
    name?: string;
    hashrate?: number | string;
    image_path?: string;
  } | null;
};

type Telemetry = {
  ok?: boolean;
  active_miners?: number | string;
  total_hashrate_hs?: number | string;
  enabled_networks?: number | string;
  enabled_miners?: number | string;
  generated_at?: string;
};

type Miner = {
  id: number;
  name: string;
  base_hashrate: number | string;
  base_price_diamond: number | string;
  image_path: string;
  tier?: string | null;
};

function num(value: number | string | undefined | null, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fmt(value: number | string | undefined | null, fallback = '—') {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : fallback;
}

function fmtHashrate(value: number | string | undefined | null) {
  const n = num(value);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} MH/s`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)} KH/s`;
  return `${n.toLocaleString('en-US')} H/s`;
}

function tierClass(tier: string | null | undefined) {
  return (tier || 'common').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export default async function LandingPage() {
  const supabase = await createClient();

  const [{ data: bonusData, error: bonusError }, { data: telemetryData }, { data: minerData }] =
    await Promise.all([
      supabase.rpc('nextgen_get_registration_bonus_status'),
      supabase.rpc('nextgen_get_landing_telemetry'),
      supabase
        .from('nextgen_miner_catalog')
        .select('id,name,base_hashrate,base_price_diamond,image_path,tier')
        .eq('enabled', true)
        .order('sort_order', { ascending: true })
        .limit(5),
    ]);

  const bonus = (bonusData ?? null) as BonusStatus | null;
  const telemetry = (telemetryData ?? null) as Telemetry | null;
  const miners = (minerData ?? []) as Miner[];

  const totalSlots = Math.max(0, num(bonus?.total_slots, 1000));
  const claimedSlots = Math.min(totalSlots, Math.max(0, num(bonus?.claimed_slots)));
  const remainingSlots = Math.max(
    0,
    num(bonus?.remaining_slots, Math.max(0, totalSlots - claimedSlots)),
  );
  const claimedPercent = totalSlots > 0 ? (claimedSlots / totalSlots) * 100 : 0;

  const bonusMinerName = bonus?.bonus_miner?.name || 'Entry GPU';
  const bonusHashrate = fmtHashrate(bonus?.bonus_miner?.hashrate);
  const bonusImage = bonus?.bonus_miner?.image_path || '/assets/miners/entry-gpu.webp';

  const liveHashrate = num(telemetry?.total_hashrate_hs);
  const activeMiners = Math.max(0, Math.round(num(telemetry?.active_miners)));
  const enabledNetworks = Math.max(0, Math.round(num(telemetry?.enabled_networks)));
  const enabledMinerCatalog = Math.max(0, Math.round(num(telemetry?.enabled_miners)));

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

        <details className="mobile-nav">
          <summary aria-label="Open navigation">☰</summary>
          <nav className="mobile-menu" aria-label="Mobile navigation">
            <a href="#top">Home</a>
            <a href="#about">About</a>
            <a href="#faq">FAQ</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#miners">Miners</a>
            <a href="#referral-program">Referral Program</a>
            <a href="/auth/register">Register</a>
            <a href="/auth/login">Login</a>
          </nav>
        </details>
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
              Power the future with your miners. Build your rig, grow your hashrate
              and manage rewards through a virtual crypto-mining network designed
              around live platform data.
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
            <Image
              src="/assets/landing/nextgen-miner-hero.png"
              alt=""
              fill
              sizes="(max-width: 900px) 88vw, 58vw"
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
          <div className="network-heading">
            <div>
              <div className="eyebrow">
                <span className="live-dot" aria-hidden="true" /> NETWORK CORE
              </div>
              <h2 id="network-title">Global Mining Network</h2>
            </div>
            <div className="network-online"><i /> ONLINE</div>
          </div>

          <div className="network-grid">
            <div className="network-visual">
              <NetworkCore />
            </div>

            <div className="network-status">
              <div className="status-label">PLATFORM STATUS</div>
              <div className="status-main">OPERATIONAL</div>
              <div className="status-meter"><span /></div>

              <div className="status-meta">
                <span>LIVE SYSTEM</span>
                <strong><i /> SYNCED</strong>
              </div>

              <div className="network-metrics">
                <article className="metric-card">
                  <span className="metric-icon">✦</span>
                  <div><small>GLOBAL HASHRATE</small><b>{fmtHashrate(liveHashrate)}</b></div>
                  <em>LIVE</em>
                </article>
                <article className="metric-card">
                  <span className="metric-icon">◎</span>
                  <div><small>ACTIVE MINERS</small><b>{activeMiners.toLocaleString('en-US')}</b></div>
                  <em>LIVE</em>
                </article>
                <article className="metric-card">
                  <span className="metric-icon">◈</span>
                  <div><small>ENABLED NETWORKS</small><b>{enabledNetworks.toLocaleString('en-US')}</b></div>
                  <em>LIVE</em>
                </article>
                <article className="metric-card">
                  <span className="metric-icon">◷</span>
                  <div><small>MINER CATALOG</small><b>{enabledMinerCatalog.toLocaleString('en-US')}</b></div>
                  <em>LIVE</em>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="campaign" aria-labelledby="campaign-title">
        <div className="campaign-copy">
          <div className="eyebrow">✦ REGISTRATION BONUS CAMPAIGN</div>
          <div className="campaign-tag">{bonusMinerName.toUpperCase()}</div>

          <h2 id="campaign-title">
            Get Your <span>{bonusMinerName}</span>
          </h2>
          <h3>Right After Verification!</h3>

          <p>
            Complete your registration and email verification to become eligible
            for the launch allocation. Eligibility and remaining slots are checked
            against the live server-side campaign.
          </p>

          <div className="bonus-specs">
            <div><small>REWARD</small><b>{bonusMinerName}</b><em>{bonusHashrate}</em></div>
            <div><small>ELIGIBILITY</small><b>VERIFIED</b><em>Server checked</em></div>
            <div><small>ALLOCATION</small><b>LIMITED</b><em>{fmt(totalSlots)} total</em></div>
          </div>

          <div className="allocation-bar">
            <div className="allocation-track" aria-label={`${remainingSlots} slots remaining`}>
              <i style={{ width: `${Math.max(0, 100 - claimedPercent)}%` }} />
            </div>
            <div className="allocation-labels">
              <span><strong>{fmt(remainingSlots)}</strong> LEFT</span>
              <span><strong>{fmt(claimedSlots)}</strong> CLAIMED / {fmt(totalSlots)} TOTAL</span>
            </div>
          </div>

          <Link href="/auth/register" className="cta primary">
            Join Now <span aria-hidden="true">→</span>
          </Link>

          {bonusError && (
            <small className="campaign-error">
              Live campaign data is temporarily unavailable; the page remains usable while the service recovers.
            </small>
          )}
        </div>

        <div className="bonus-visual" aria-label={`${bonusMinerName} registration bonus visual`}>
          <div className="bonus-hud">
            <span>{bonusMinerName.toUpperCase()}</span>
            <b>LIMITED ALLOCATION</b>
          </div>

          <div className="gpu-platform">
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
          <div>
            <div className="eyebrow">HOW IT WORKS</div>
            <h2>Start Your Mining Journey</h2>
            <p>A five-step path from account creation to an upgraded mining network and wallet management.</p>
          </div>
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
            <p>Live-enabled miner catalog entries are shown from Supabase and keep the landing page aligned with the shop.</p>
            <Link href="/miners" className="cta primary">View All Miners <span>→</span></Link>
          </div>

          {miners.map((miner) => (
            <article className="miner-showcase-card" key={miner.id}>
              <div className={`tier tier-${tierClass(miner.tier)}`}>{miner.tier || 'Miner'}</div>
              <div className="miner-img">
                <Image
                  src={miner.image_path}
                  alt={miner.name}
                  fill
                  sizes="(max-width: 900px) 42vw, 16vw"
                  loading="lazy"
                />
              </div>
              <div className="miner-info">
                <h3>{miner.name}</h3>
                <b>{fmtHashrate(miner.base_hashrate)}</b>
                <small>{fmt(miner.base_price_diamond)} 💎 · Levels 1–10</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="transparency">
        <div className="section-head">
          <div>
            <div className="eyebrow">SECURE · TRANSPARENT · TRUSTED</div>
            <h2>Built for a Safer Mining Experience</h2>
            <p>Important information is visible before registration. Sensitive actions remain subject to server-side validation.</p>
          </div>
        </div>

        <div className="feature-grid">
          <article className="feature"><div className="icon">◈</div><h3>SSL ENCRYPTED</h3><p>Production access uses HTTPS.</p></article>
          <article className="feature"><div className="icon">◇</div><h3>SERVER-SIDE RULES</h3><p>Wallet and reward actions are validated by backend rules.</p></article>
          <article className="feature"><div className="icon">◎</div><h3>LIVE TELEMETRY</h3><p>Aggregate network figures come from the live database telemetry function.</p></article>
          <article className="feature"><div className="icon">◆</div><h3>PUBLIC POLICIES</h3><p>About, Contact, Privacy, Terms and Disclaimer are available.</p></article>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="section-head">
          <div>
            <div className="eyebrow">FREQUENTLY ASKED QUESTIONS</div>
            <h2>Find Your Answers</h2>
          </div>
        </div>

        <div className="faq-list">
          <details className="faq">
            <summary>Is the platform free to join?</summary>
            <p>Account creation is free. Miner ownership and reward conditions follow the rules shown in the platform.</p>
          </details>
          <details className="faq">
            <summary>How do I get the launch bonus?</summary>
            <p>Register and complete email verification. The server checks the active campaign, identity protection and remaining allocation before assigning the miner.</p>
          </details>
          <details className="faq">
            <summary>How are rewards calculated?</summary>
            <p>Reward values depend on configured platform mining economics, available reward resources and applicable controls.</p>
          </details>
          <details className="faq">
            <summary>Can I upgrade my miner?</summary>
            <p>Yes. Eligible owned miners can progress through their available levels subject to wallet balance and upgrade rules.</p>
          </details>
        </div>
      </section>

      <section className="section" id="referral-program">
        <div className="final">
          <div>
            <div className="eyebrow">ENTER THE NETWORK</div>
            <h2>Build today. Power tomorrow.</h2>
            <p>Read the public information, create your account and start building your virtual mining network.</p>
          </div>
          <Link href="/auth/register" className="cta primary">Create Free Account <span>→</span></Link>
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
