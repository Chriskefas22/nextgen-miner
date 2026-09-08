import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

type BonusStatus = {
  total_slots?: number;
  claimed_slots?: number;
  remaining_slots?: number;
};

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('nextgen_get_registration_bonus_status');
  const bonus = (data ?? null) as BonusStatus | null;
  const fmt = (v: unknown) => typeof v === 'number' ? v.toLocaleString('en-US') : '—';

  return (
    <main className="ng-landing">
      <style>{`
        .ng-landing{min-height:100vh;overflow:hidden;background:
          radial-gradient(circle at 12% 0%,rgba(36,232,255,.10),transparent 28%),
          radial-gradient(circle at 88% 8%,rgba(139,61,255,.14),transparent 30%),
          linear-gradient(180deg,#020711 0%,#03101a 38%,#02060d 100%);color:#f2fbff}
        .ng-landing *{box-sizing:border-box}.ng-landing a{text-decoration:none;color:inherit}
        .ng-nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:14px;
          padding:12px clamp(12px,4vw,44px);border-bottom:1px solid rgba(36,139,197,.18);background:rgba(2,7,16,.86);backdrop-filter:blur(18px)}
        .ng-brand{display:flex;align-items:center;gap:10px;font:700 14px Orbitron,system-ui;letter-spacing:.09em}
        .ng-mark{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;color:#24e8ff;border:1px solid rgba(36,232,255,.7);
          box-shadow:0 0 24px rgba(36,232,255,.15),inset 0 0 16px rgba(36,232,255,.07)} .ng-brand span{color:#24e8ff}
        .ng-nav-links{display:flex;gap:22px;color:#8faabd;font-size:13px;font-weight:700}.ng-nav-links a:hover{color:#fff}
        .ng-nav-actions{display:flex;gap:8px}.ng-nav-btn,.ng-cta{display:inline-flex;align-items:center;justify-content:center;border-radius:12px;font-weight:900}
        .ng-nav-btn{padding:10px 13px;border:1px solid rgba(44,134,188,.28);background:rgba(6,17,29,.72);font-size:12px}
        .ng-primary,.ng-cta-primary{background:linear-gradient(135deg,#246aff,#8c36ff);border-color:rgba(145,116,255,.48);box-shadow:0 0 28px rgba(74,80,255,.20)}
        .ng-shell{width:min(1180px,92vw);margin:auto}
        .ng-hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(300px,.92fr);gap:clamp(28px,6vw,76px);align-items:center;padding:clamp(54px,8vw,100px) 0 60px}
        .ng-kicker{display:inline-flex;align-items:center;gap:8px;color:#24e8ff;font-size:10px;letter-spacing:.20em;font-weight:900}
        .ng-kicker:before{content:"";width:7px;height:7px;border-radius:50%;background:#35f3b4;box-shadow:0 0 12px rgba(53,243,180,.85)}
        .ng-hero h1{margin:13px 0 18px;font:700 clamp(40px,6vw,75px)/1.02 Orbitron,system-ui;letter-spacing:-.045em}
        .ng-hero h1 em{font-style:normal;background:linear-gradient(95deg,#fff,#24e8ff 43%,#b07bff);-webkit-background-clip:text;background-clip:text;color:transparent}
        .ng-copy{max-width:670px;color:#8faabd;font-size:clamp(16px,2vw,20px);line-height:1.62}
        .ng-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.ng-cta{padding:14px 18px;border:1px solid rgba(44,134,188,.28);font-size:13px}.ng-cta-ghost{background:rgba(6,17,29,.76)}
        .ng-steps{display:flex;flex-wrap:wrap;gap:7px;margin-top:20px;color:#7390a5;font-size:11px;font-weight:800}.ng-steps span{padding:7px 9px;border:1px solid rgba(40,121,167,.2);background:rgba(5,16,28,.5);border-radius:99px}
        .ng-stage{position:relative;min-height:270px;display:grid;place-items:center}.ng-core{position:relative;width:250px;height:250px;display:grid;place-items:center}
        .ng-core:before,.ng-core:after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(36,232,255,.18)}
        .ng-core:before{inset:12px;animation:ng-spin 14s linear infinite}.ng-core:after{inset:31px;border-color:rgba(139,61,255,.25);animation:ng-spin 9s linear reverse infinite}
        .ng-orbit{position:absolute;inset:-5px;border:1px dashed rgba(36,232,255,.24);border-radius:50%;transform:rotateX(68deg);animation:ng-spin 9s linear infinite}
        .ng-orbit.o2{inset:20px;transform:rotateY(67deg);animation-duration:7s}.ng-orbit.o3{inset:47px;transform:rotateX(70deg) rotateY(22deg);animation-duration:5.5s}
        .ng-diamond{position:relative;width:108px;height:108px;transform:rotate(45deg);border:1px solid rgba(151,245,255,.9);
          background:linear-gradient(135deg,rgba(36,232,255,.34),rgba(97,76,255,.20) 48%,rgba(238,60,255,.35));
          box-shadow:0 0 42px rgba(36,232,255,.28),0 0 90px rgba(139,61,255,.18),inset 0 0 28px rgba(255,255,255,.08);animation:ng-float 3.2s ease-in-out infinite}
        .ng-diamond:before,.ng-diamond:after{content:"";position:absolute;background:rgba(143,244,255,.42)}.ng-diamond:before{width:1px;height:100%;left:50%;top:0}.ng-diamond:after{height:1px;width:100%;left:0;top:50%}
        .ng-core-label{position:absolute;text-align:center;z-index:4;font-family:Orbitron;text-shadow:0 0 18px rgba(36,232,255,.68)}.ng-core-label strong{display:block;font-size:16px;color:#fff}.ng-core-label small{display:block;margin-top:5px;font-size:9px;letter-spacing:.18em;color:#24e8ff}
        .ng-status{position:absolute;left:50%;bottom:-5px;transform:translateX(-50%);padding:10px 13px;border-radius:13px;background:rgba(4,17,27,.92);border:1px solid rgba(53,243,180,.20);white-space:nowrap}
        .ng-status b{display:block;color:#35f3b4;font-size:11px}.ng-status small{display:block;margin-top:3px;color:#718da2}
        .ng-bonus{margin-bottom:68px;padding:23px;border-radius:20px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;border:1px solid rgba(139,61,255,.30);
          background:linear-gradient(135deg,rgba(12,23,47,.94),rgba(16,7,37,.86));box-shadow:0 20px 58px rgba(0,0,0,.28)}
        .ng-bonus h2{margin:5px 0 7px;font:700 19px Orbitron}.ng-bonus p{margin:0;color:#8faabd;line-height:1.5}.ng-counter{text-align:right}.ng-counter strong{display:block;color:#24e8ff;font:700 32px Orbitron}.ng-counter small{color:#7895a9}
        .ng-trust{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:74px}.ng-trust-card,.ng-card,.ng-faq,.ng-final{border:1px solid rgba(40,121,167,.22);background:rgba(4,14,25,.72);border-radius:16px}
        .ng-trust-card{padding:15px}.ng-trust-card b{display:block;font:700 12px Orbitron}.ng-trust-card small{display:block;margin-top:5px;color:#7895a9;line-height:1.45}
        .ng-section{padding-bottom:74px}.ng-head{max-width:700px;margin-bottom:23px}.ng-head h2{margin:6px 0 8px;font:700 28px Orbitron}.ng-head p{margin:0;color:#819daf;line-height:1.58}
        .ng-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}.ng-card{padding:19px}.ng-num{width:37px;height:37px;display:grid;place-items:center;border-radius:10px;margin-bottom:13px;color:#24e8ff;font-weight:900;border:1px solid rgba(36,232,255,.24);background:rgba(36,232,255,.05)}
        .ng-card h3{margin:0;font:700 15px Orbitron}.ng-card p{margin:7px 0 0;color:#7f9bad;line-height:1.55}
        .ng-faqs{display:grid;gap:9px}.ng-faq{padding:15px 17px}.ng-faq summary{cursor:pointer;font-weight:900}.ng-faq p{margin:9px 0 0;color:#839fb2;line-height:1.55}
        .ng-final{padding:26px;display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center;margin-bottom:65px;background:linear-gradient(135deg,rgba(13,28,47,.90),rgba(25,10,49,.90))}
        .ng-final h2{margin:5px 0 7px;font:700 23px Orbitron}.ng-final p{margin:0;color:#89a5b8}
        .ng-footer{border-top:1px solid rgba(36,139,197,.15);padding:27px 0 34px;color:#647f93;font-size:11px}.ng-footer-inner{display:flex;justify-content:space-between;gap:18px;align-items:center}.ng-footer-links{display:flex;gap:14px;flex-wrap:wrap}
        @keyframes ng-spin{to{transform:rotate(360deg)}}@keyframes ng-float{0%,100%{transform:rotate(45deg) translateY(0)}50%{transform:rotate(45deg) translateY(-10px)}}
        @media(max-width:900px){.ng-nav-links{display:none}.ng-hero{grid-template-columns:1fr;padding-top:34px;gap:15px}.ng-hero-copy{order:1}.ng-stage{order:2;min-height:205px}.ng-core{transform:scale(.74)}
          .ng-trust{grid-template-columns:repeat(2,1fr)}.ng-grid{grid-template-columns:1fr}.ng-bonus,.ng-final{grid-template-columns:1fr}.ng-counter{text-align:left}.ng-footer-inner{flex-direction:column;align-items:flex-start}}
        @media(max-width:480px){.ng-nav{padding:10px 12px}.ng-brand{font-size:11px}.ng-mark{width:38px;height:38px}.ng-nav-actions .ng-nav-btn:first-child{display:none}
          .ng-hero{width:min(94vw,560px);padding-top:27px}.ng-hero h1{font-size:38px}.ng-copy{font-size:16px}.ng-actions{display:grid;grid-template-columns:1fr}.ng-cta{width:100%}
          .ng-stage{min-height:195px}.ng-core{transform:scale(.65)}.ng-trust{grid-template-columns:1fr}.ng-bonus{padding:19px}.ng-final{padding:21px}.ng-head h2{font-size:24px}}
        @media(prefers-reduced-motion:reduce){.ng-core:before,.ng-core:after,.ng-orbit,.ng-diamond{animation:none}}
      `}</style>

      <header className="ng-nav">
        <Link href="/" className="ng-brand" aria-label="NextGen Miner home"><div className="ng-mark">N</div><div>NEXTGEN <span>MINER</span></div></Link>
        <nav className="ng-nav-links" aria-label="Primary"><a href="#how-it-works">How it works</a><a href="#transparency">Transparency</a><a href="#faq">FAQ</a></nav>
        <div className="ng-nav-actions"><Link href="/auth/login" className="ng-nav-btn">Login</Link><Link href="/auth/register" className="ng-nav-btn ng-primary">Start Mining</Link></div>
      </header>

      <div className="ng-shell">
        <section className="ng-hero">
          <div className="ng-hero-copy">
            <div className="ng-kicker">NEXT-GENERATION VIRTUAL MINING</div>
            <h1>Build your rig.<br /><em>Earn. Upgrade. Withdraw.</em></h1>
            <p className="ng-copy">Build a virtual mining network, grow your hashrate and manage rewards through a platform designed around live account data, server-side controls and clearly published rules.</p>
            <div className="ng-actions"><Link href="/auth/register" className="ng-cta ng-cta-primary">Create free account</Link><Link href="/auth/login" className="ng-cta ng-cta-ghost">Login to dashboard</Link></div>
            <div className="ng-steps"><span>01 Register</span><span>02 Verify</span><span>03 Mine</span><span>04 Upgrade</span><span>05 Withdraw</span></div>
          </div>
          <div className="ng-stage" aria-label="NextGen Miner holographic core">
            <div className="ng-core"><div className="ng-orbit" /><div className="ng-orbit o2" /><div className="ng-orbit o3" /><div className="ng-diamond" /><div className="ng-core-label"><strong>60 H/s</strong><small>ONLINE CORE</small></div></div>
            <div className="ng-status"><b>● NETWORK ONLINE</b><small>Mining grid operational</small></div>
          </div>
        </section>

        <section id="launch-bonus" className="ng-bonus">
          <div><div className="ng-kicker">LAUNCH CAMPAIGN</div><h2>First 1,000 verified registrations receive an Entry GPU</h2><p>Allocation is decided by the database after email verification. Refreshing the page cannot consume a slot.</p></div>
          <div className="ng-counter"><strong>{fmt(bonus?.remaining_slots)} left</strong><small>{fmt(bonus?.claimed_slots)} claimed / {fmt(bonus?.total_slots)} total</small></div>
        </section>

        <section className="ng-trust" id="transparency" aria-label="Trust">
          <article className="ng-trust-card"><b>HTTPS + SECURE ACCESS</b><small>Use the official Vercel production domain over HTTPS with account security controls.</small></article>
          <article className="ng-trust-card"><b>SERVER-SIDE RULES</b><small>Rewards, wallet changes and sensitive actions are controlled by backend rules.</small></article>
          <article className="ng-trust-card"><b>NO GUARANTEED RETURNS</b><small>Rewards depend on platform economics, configured rates and available resources.</small></article>
          <article className="ng-trust-card"><b>PUBLIC POLICIES</b><small>About, Contact, Privacy and Terms are available before registration.</small></article>
        </section>

        <section className="ng-section" id="how-it-works">
          <div className="ng-head"><div className="ng-kicker">THE PLATFORM LOOP</div><h2>Understand the system before you create an account.</h2><p>The landing page answers what the service is, how the reward flow works and where the rules are documented.</p></div>
          <div className="ng-grid">
            <article className="ng-card"><div className="ng-num">01</div><h3>REGISTER & VERIFY</h3><p>Create an account, complete security verification and verify your email. Launch allocation is handled by the backend.</p></article>
            <article className="ng-card"><div className="ng-num">02</div><h3>OWN & UPGRADE</h3><p>Own eligible miners, build hashrate and progress through available levels using configured platform rules.</p></article>
            <article className="ng-card"><div className="ng-num">03</div><h3>TRACK & WITHDRAW</h3><p>Monitor Diamond, supported crypto and transaction history from your wallet. Withdrawals follow validation and settlement rules.</p></article>
          </div>
        </section>

        <section className="ng-section">
          <div className="ng-head"><div className="ng-kicker">TRANSPARENCY BY DESIGN</div><h2>Clear information beats hype.</h2><p>NextGen Miner is a virtual mining and reward service. Reward values are not presented as guaranteed investment income and may depend on platform economics, campaign conditions and risk controls.</p></div>
          <div className="ng-grid">
            <article className="ng-card"><h3>Live platform data</h3><p>Balances, miner ownership and transactions are intended to reflect live backend state rather than demo balances.</p></article>
            <article className="ng-card"><h3>Security controls</h3><p>Authentication, ownership checks and anti-abuse controls protect sensitive account actions.</p></article>
            <article className="ng-card"><h3>Published policies</h3><p>Visitors can review public rules and privacy information before participating.</p></article>
          </div>
        </section>

        <section className="ng-section" id="faq">
          <div className="ng-head"><div className="ng-kicker">FAQ</div><h2>Questions visitors should ask first.</h2></div>
          <div className="ng-faqs">
            <details className="ng-faq"><summary>Is this a guaranteed-profit investment?</summary><p>No. It is presented as a virtual mining and reward service. Rewards can vary and are not guaranteed.</p></details>
            <details className="ng-faq"><summary>How is the launch bonus assigned?</summary><p>The database allocates the campaign reward after email verification, subject to server-side rules and available slots.</p></details>
            <details className="ng-faq"><summary>Can refreshing the page use a launch slot?</summary><p>No. The public counter is display-only; allocation is performed by the backend.</p></details>
            <details className="ng-faq"><summary>Where are the rules and privacy information?</summary><p>Use the About, Contact, Privacy Policy and Terms links in the footer before signing up.</p></details>
          </div>
        </section>

        <section className="ng-final"><div><div className="ng-kicker">READY WHEN YOU ARE</div><h2>Start with the facts. Then start mining.</h2><p>Read the public information, review the rules and create your account.</p></div><Link href="/auth/register" className="ng-cta ng-cta-primary">Start Mining</Link></section>

        <footer className="ng-footer"><div className="ng-footer-inner"><div>© {new Date().getFullYear()} NextGen Miner · Virtual mining & reward platform</div><nav className="ng-footer-links" aria-label="Footer"><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link></nav></div></footer>
      </div>
    </main>
  );
}
