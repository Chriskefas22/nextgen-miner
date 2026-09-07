import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

type BonusStatus = {
  ok?: boolean;
  active?: boolean;
  total_slots?: number;
  claimed_slots?: number;
  remaining_slots?: number;
  bonus_miner?: {
    name?: string;
    hashrate?: number;
    image_path?: string;
  };
};

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('nextgen_get_registration_bonus_status');
  const bonus = (data ?? null) as BonusStatus | null;

  const remaining =
    typeof bonus?.remaining_slots === 'number'
      ? bonus.remaining_slots.toLocaleString('en-US')
      : '—';

  const claimed =
    typeof bonus?.claimed_slots === 'number'
      ? bonus.claimed_slots.toLocaleString('en-US')
      : '—';

  const total =
    typeof bonus?.total_slots === 'number'
      ? bonus.total_slots.toLocaleString('en-US')
      : '—';

  return (
    <main className="ng-landing">
      <style>{`
        .ng-landing{min-height:100vh;overflow:hidden;background:
          radial-gradient(circle at 50% 8%,rgba(36,232,255,.12),transparent 26%),
          radial-gradient(circle at 88% 38%,rgba(139,61,255,.16),transparent 28%),
          linear-gradient(180deg,#020711 0%,#030914 58%,#02050c 100%);
        }
        .ng-landing *{box-sizing:border-box}
        .ng-landing a{color:inherit;text-decoration:none}
        .ng-nav{position:sticky;top:0;z-index:40;display:flex;align-items:center;justify-content:space-between;
          gap:18px;padding:14px clamp(16px,4vw,48px);border-bottom:1px solid rgba(36,139,197,.18);
          background:rgba(2,7,16,.76);backdrop-filter:blur(18px)}
        .ng-brand{display:flex;align-items:center;gap:11px;font-family:Orbitron,sans-serif;font-weight:700;letter-spacing:.08em}
        .ng-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;border:1px solid rgba(36,232,255,.65);
          color:var(--cyan);box-shadow:0 0 24px rgba(36,232,255,.16),inset 0 0 18px rgba(36,232,255,.08)}
        .ng-brand span{color:var(--cyan)}
        .ng-navlinks{display:flex;align-items:center;gap:22px;color:#9bb2c2;font-weight:700;font-size:14px}
        .ng-navlinks a:hover{color:#fff}
        .ng-navactions{display:flex;gap:9px;align-items:center}
        .ng-linkbtn{padding:10px 13px;border:1px solid rgba(40,121,167,.3);border-radius:11px;background:rgba(6,17,29,.7);font-weight:800}
        .ng-primary{background:linear-gradient(135deg,#246aff,#8c36ff);border-color:rgba(133,104,255,.45);box-shadow:0 0 22px rgba(74,80,255,.2)}
        .ng-hero{width:min(1200px,92vw);margin:0 auto;padding:clamp(54px,9vw,110px) 0 72px;display:grid;
          grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr);gap:clamp(30px,7vw,90px);align-items:center}
        .ng-kicker{display:inline-flex;align-items:center;gap:8px;color:var(--cyan);font-size:11px;letter-spacing:.2em;font-weight:800}
        .ng-kicker:before{content:'';width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 12px rgba(53,243,180,.9)}
        .ng-title{font-family:Orbitron,sans-serif;font-size:clamp(38px,6vw,76px);line-height:1.02;margin:16px 0 20px;letter-spacing:-.04em}
        .ng-title em{font-style:normal;background:linear-gradient(90deg,#fff,var(--cyan),#a878ff);-webkit-background-clip:text;background-clip:text;color:transparent}
        .ng-copy{max-width:640px;color:#8faabd;font-size:clamp(17px,2vw,20px);line-height:1.55}
        .ng-actions{display:flex;flex-wrap:wrap;gap:11px;margin-top:28px}
        .ng-cta{display:inline-flex;align-items:center;justify-content:center;padding:13px 18px;border-radius:12px;font-weight:900;border:1px solid rgba(44,134,188,.34)}
        .ng-cta-primary{background:linear-gradient(135deg,#246aff,#8c36ff);box-shadow:0 0 25px rgba(74,80,255,.22)}
        .ng-cta-ghost{background:rgba(6,17,29,.72)}
        .ng-loop{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px;color:#7190a6;font-size:12px;font-weight:800}
        .ng-loop span{padding:7px 9px;border:1px solid rgba(40,121,167,.2);border-radius:999px;background:rgba(6,17,29,.42)}
        .ng-stage{position:relative;min-height:430px;display:grid;place-items:center}
        .ng-core{width:270px;height:270px;position:relative;display:grid;place-items:center}
        .ng-core:before,.ng-core:after{content:'';position:absolute;inset:0;border:1px solid rgba(36,232,255,.18);border-radius:50%;animation:ng-spin 15s linear infinite}
        .ng-core:after{inset:22px;border-color:rgba(139,61,255,.25);animation-duration:9s;animation-direction:reverse}
        .ng-orbit{position:absolute;inset:-34px;border:1px dashed rgba(36,232,255,.22);border-radius:50%;transform:rotateX(68deg);animation:ng-spin 11s linear infinite}
        .ng-orbit:nth-child(2){inset:-8px;transform:rotateY(68deg);animation-duration:8s}
        .ng-orbit:nth-child(3){inset:36px;transform:rotateX(70deg) rotateY(25deg);animation-duration:6s}
        .ng-diamond{width:118px;height:118px;position:relative;transform:rotate(45deg);animation:ng-float 3.5s ease-in-out infinite;
          background:linear-gradient(135deg,rgba(36,232,255,.34),rgba(139,61,255,.2) 48%,rgba(238,60,255,.32));
          border:1px solid rgba(125,239,255,.8);box-shadow:0 0 45px rgba(36,232,255,.32),0 0 90px rgba(139,61,255,.18),inset 0 0 28px rgba(255,255,255,.08)}
        .ng-diamond:before,.ng-diamond:after{content:'';position:absolute;background:rgba(139,239,255,.35)}
        .ng-diamond:before{left:50%;top:0;width:1px;height:100%}
        .ng-diamond:after{top:50%;left:0;width:100%;height:1px}
        .ng-core-label{position:absolute;text-align:center;z-index:3;font-family:Orbitron,sans-serif;text-shadow:0 0 16px rgba(36,232,255,.6)}
        .ng-core-label strong{display:block;color:#fff;font-size:16px}
        .ng-core-label small{display:block;color:var(--cyan);font-size:10px;letter-spacing:.18em;margin-top:5px}
        .ng-status{position:absolute;left:4%;bottom:22px;padding:11px 13px;border:1px solid rgba(53,243,180,.2);border-radius:12px;background:rgba(4,17,27,.82);backdrop-filter:blur(12px)}
        .ng-status b{color:var(--green);font-size:12px}.ng-status small{display:block;color:#718da2;margin-top:3px}
        .ng-bonus{width:min(1200px,92vw);margin:0 auto 70px;padding:22px;border-radius:19px;border:1px solid rgba(139,61,255,.28);
          background:linear-gradient(135deg,rgba(12,23,47,.9),rgba(16,7,37,.82));display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;
          box-shadow:0 20px 55px rgba(0,0,0,.25)}
        .ng-bonus h2{font-family:Orbitron,sans-serif;font-size:18px;margin:5px 0 7px}.ng-bonus p{margin:0;color:#8faabd}
        .ng-counter{text-align:right}.ng-counter strong{display:block;font-family:Orbitron,sans-serif;font-size:31px;color:var(--cyan)}.ng-counter small{color:#7895a9}
        .ng-section{width:min(1200px,92vw);margin:0 auto;padding:0 0 80px}
        .ng-section-head{max-width:650px;margin-bottom:25px}.ng-section-head h2{font-family:Orbitron,sans-serif;font-size:28px;margin:7px 0 9px}.ng-section-head p{color:#819daf;line-height:1.5}
        .ng-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
        .ng-card{padding:20px;border:1px solid rgba(40,121,167,.23);border-radius:17px;background:rgba(5,15,27,.72)}
        .ng-card b{font-family:Orbitron,sans-serif}.ng-card p{color:#7f9bad;line-height:1.5;margin-bottom:0}
        .ng-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;margin-bottom:14px;color:var(--cyan);
          border:1px solid rgba(36,232,255,.25);background:rgba(36,232,255,.06)}
        .ng-footer{border-top:1px solid rgba(36,139,197,.15);padding:24px 4vw;color:#607f94;text-align:center;font-size:12px}
        @keyframes ng-spin{to{transform:rotate(360deg)}}@keyframes ng-float{0%,100%{transform:rotate(45deg) translateY(0)}50%{transform:rotate(45deg) translateY(-12px)}}
        @media(max-width:820px){
          .ng-navlinks{display:none}.ng-hero{grid-template-columns:1fr;padding-top:48px}.ng-stage{min-height:360px;order:-1}
          .ng-core{transform:scale(.84)}.ng-bonus{grid-template-columns:1fr}.ng-counter{text-align:left}.ng-grid{grid-template-columns:1fr}
        }
        @media(max-width:480px){.ng-nav{padding:12px 14px}.ng-brand{font-size:12px}.ng-navactions .ng-linkbtn:first-child{display:none}.ng-title{font-size:38px}.ng-stage{min-height:320px}.ng-core{transform:scale(.72)}}
      `}</style>

      <header className="ng-nav">
        <Link href="/" className="ng-brand" aria-label="NextGen Miner home">
          <div className="ng-mark">N</div>
          <div>NEXTGEN <span>MINER</span></div>
        </Link>

        <nav className="ng-navlinks" aria-label="Primary">
          <a href="#how-it-works">How it works</a>
          <a href="#launch-bonus">Launch bonus</a>
          <Link href="/auth/login">Login</Link>
        </nav>

        <div className="ng-navactions">
          <Link href="/auth/login" className="ng-linkbtn">Login</Link>
          <Link href="/auth/register" className="ng-linkbtn ng-primary">Start Mining</Link>
        </div>
      </header>

      <section className="ng-hero">
        <div>
          <div className="ng-kicker">NEXT-GENERATION MINING NETWORK</div>
          <h1 className="ng-title">Build your rig.<br /><em>Earn. Upgrade. Withdraw.</em></h1>
          <p className="ng-copy">
            Start with a miner, grow your hashrate, unlock stronger rigs and manage your rewards from one futuristic mining command center.
          </p>
          <div className="ng-actions">
            <Link href="/auth/register" className="ng-cta ng-cta-primary">Create free account</Link>
            <Link href="/auth/login" className="ng-cta ng-cta-ghost">Login to dashboard</Link>
          </div>
          <div className="ng-loop" aria-label="Platform flow">
            <span>Register</span><span>→ Earn</span><span>→ Mine</span><span>→ Upgrade</span><span>→ Withdraw</span>
          </div>
        </div>

        <div className="ng-stage" aria-label="NextGen Miner hologram core">
          <div className="ng-core">
            <div className="ng-orbit" />
            <div className="ng-orbit" />
            <div className="ng-orbit" />
            <div className="ng-diamond" />
            <div className="ng-core-label"><strong>60 H/s</strong><small>ONLINE CORE</small></div>
          </div>
          <div className="ng-status"><b>● NETWORK ONLINE</b><small>Mining grid operational</small></div>
        </div>
      </section>

      <section id="launch-bonus" className="ng-bonus">
        <div>
          <div className="ng-kicker">LAUNCH CAMPAIGN</div>
          <h2>First 1,000 verified registrations receive an Entry GPU</h2>
          <p>Slots are assigned by the database when the account email becomes verified. No page visits or client-side counter can consume a slot.</p>
        </div>
        <div className="ng-counter">
          <strong>{remaining} left</strong>
          <small>{claimed} claimed / {total} total</small>
        </div>
      </section>

      <section id="how-it-works" className="ng-section">
        <div className="ng-section-head">
          <div className="ng-kicker">THE LOOP</div>
          <h2>Simple to start. Built to scale.</h2>
          <p>Your account, miner ownership, wallet and rewards are connected to the live platform backend rather than demo balances.</p>
        </div>
        <div className="ng-grid">
          <article className="ng-card"><div className="ng-icon">01</div><b>Register</b><p>Create an account and complete the security verification. Verify your email to activate the registration reward logic.</p></article>
          <article className="ng-card"><div className="ng-icon">02</div><b>Mine & upgrade</b><p>Own miners, build hashrate and use upgrades to move through the available rig tiers.</p></article>
          <article className="ng-card"><div className="ng-icon">03</div><b>Manage rewards</b><p>Track Diamond and supported crypto balances through the wallet and transaction history.</p></article>
        </div>
      </section>

      <footer className="ng-footer">NEXTGEN MINER · Futuristic virtual mining platform</footer>
    </main>
  );
}
