import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SplineHero from './SplineHero';

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
          radial-gradient(circle at 12% 0%,rgba(36,232,255,.12),transparent 35%),
          radial-gradient(circle at 88% 8%,rgba(139,61,255,.16),transparent 35%),
          linear-gradient(180deg,#020711 0%,#03101a 38%,#02060d 100%);color:#f2fbff}
        .ng-landing *{box-sizing:border-box}.ng-landing a{text-decoration:none;color:inherit}
        
        /* ⚡ ANIMASI UNTUK FIRST IMPRESSION (FADE IN UP) */
        .ng-animate-fade {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        .ng-nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:14px;
          padding:12px clamp(12px,4vw,44px);border-bottom:1px solid rgba(36,139,197,.18);background:rgba(2,7,16,.86);backdrop-filter:blur(18px)}
        .ng-brand{display:flex;align-items:center;gap:10px;font:700 14px Orbitron,system-ui;letter-spacing:.09em}
        .ng-mark{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;color:#24e8ff;border:1px solid rgba(36,232,255,.7);
          box-shadow:0 0 24px rgba(36,232,255,.15),inset 0 0 16px rgba(36,232,255,.07)} .ng-brand span{color:#24e8ff}
        .ng-nav-links{display:flex;gap:22px;color:#8faabd;font-size:13px;font-weight:700}.ng-nav-links a:hover{color:#fff}
        .ng-nav-actions{display:flex;gap:8px}.ng-nav-btn,.ng-cta{display:inline-flex;align-items:center;justify-content:center;border-radius:12px;font-weight:900}
        .ng-nav-btn{padding:10px 13px;border:1px solid rgba(44,134,188,.28);background:rgba(6,17,29,.72);font-size:12px}
        
        /* TOMBOL NEON UTAMA DENGAN EFEK GLOW BERDENYUT */
        .ng-primary,.ng-cta-primary{
          background:linear-gradient(135deg,#246aff,#8c36ff);
          border-color:rgba(145,116,255,.48);
          box-shadow:0 0 28px rgba(74,80,255,0.4);
          transition: all 0.3s ease;
        }
        .ng-cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 38px rgba(36, 232, 255, 0.6);
          filter: brightness(1.1);
        }
        
        .ng-shell{width:min(1180px,92vw);margin:auto}
        .ng-hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(300px,.92fr);gap:clamp(28px,6vw,76px);align-items:center;padding:clamp(54px,8vw,100px) 0 60px}
        .ng-kicker{display:inline-flex;align-items:center;gap:8px;color:#24e8ff;font-size:10px;letter-spacing:.20em;font-weight:900}
        .ng-kicker:before{content:"";width:7px;height:7px;border-radius:50%;background:#35f3b4;box-shadow:0 0 12px rgba(53,243,180,.85)}
        .ng-hero h1{margin:13px 0 18px;font:700 clamp(40px,6vw,65px)/1.05 Orbitron,system-ui;letter-spacing:-.03em}
        .ng-hero h1 em{font-style:normal;background:linear-gradient(95deg,#fff,#24e8ff 43%,#b07bff);-webkit-background-clip:text;background-clip:text;color:transparent}
        .ng-copy{max-width:670px;color:#8faabd;font-size:clamp(16px,2vw,19px);line-height:1.65}
        
        .ng-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.ng-cta{padding:15px 22px;border:1px solid rgba(44,134,188,.28);font-size:14px}.ng-cta-ghost{background:rgba(6,17,29,.76); border-color: rgba(36,232,255,0.2)}
        .ng-cta-ghost:hover{border-color: rgba(36,232,255,0.6); background: rgba(36,232,255,0.05)}
        
        .ng-steps{display:flex;flex-wrap:wrap;gap:7px;margin-top:30px;color:#7390a5;font-size:11px;font-weight:800}.ng-steps span{padding:7px 12px;border:1px solid rgba(40,121,167,.2);background:rgba(5,16,28,.5);border-radius:99px}
        .ng-stage{position:relative;width:100%;display:block}
        
        .ng-status{position:absolute;left:50%;bottom:15px;transform:translateX(-50%);padding:10px 16px;border-radius:13px;background:rgba(4,17,27,0.85);backdrop-filter:blur(8px);border:1px solid rgba(53,243,180,.30);white-space:nowrap;z-index:10;box-shadow:0 8px 20px rgba(0,0,0,0.5)}
        .ng-status b{display:block;color:#35f3b4;font-size:11px;letter-spacing:0.05em}.ng-status small{display:block;margin-top:3px;color:#718da2}
        
        .ng-bonus{margin-bottom:68px;padding:23px;border-radius:20px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;border:1px solid rgba(139,61,255,.30);
          background:linear-gradient(135deg,rgba(12,23,47,.94),rgba(16,7,37,.86));box-shadow:0 20px 58px rgba(0,0,0,.28)}
        .ng-bonus h2{margin:5px 0 7px;font:700 19px Orbitron}.ng-bonus p{margin:0;color:#8faabd;line-height:1.5}.ng-counter{text-align:right}.ng-counter strong{display:block;color:#24e8ff;font:700 32px Orbitron}.ng-counter small{color:#7895a9}
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @media(max-width:900px){
          .ng-nav-links{display:none}
          .ng-hero{grid-template-columns:1fr; text-align:center; padding-top:40px; gap:40px;}
          .ng-actions{justify-content:center;}
          .ng-steps{justify-content:center;}
          .ng-status{bottom:-15px;}
        }
      `}</style>

      {/* --- BAGIAN NAVIGASI --- */}
      <nav className="ng-nav">
        <div className="ng-brand">
          <div className="ng-mark">⚡</div>
          <div>CRYPTO<span>MINING</span></div>
        </div>
        <div className="ng-nav-links">
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="ng-nav-actions">
          <Link href="/login" className="ng-nav-btn">Log In</Link>
          <Link href="/register" className="ng-nav-btn ng-primary">Sign Up</Link>
        </div>
      </nav>

      <div className="ng-shell">
        {/* --- HERO SECTION --- */}
        <section className="ng-hero">
          {/* Animasi teks masuk secara halus */}
          <div className="ng-animate-fade">
            <div className="ng-kicker">NEXT-GEN FAUCET SYSTEM</div>
            <h1>Futuristic <em>Crypto Mining</em></h1>
            <p className="ng-copy">
              Klaim reward kripto Anda dengan sistem distribusi faucet berkecepatan tinggi. 
              Visualisasi megacity masa depan yang super ringan, responsif, dan instan di semua jenis perangkat.
            </p>
            <div className="ng-actions">
              <Link href="/register" className="ng-cta ng-cta-primary">Start Claim Faucet</Link>
              <a href="#features" className="ng-cta ng-cta-ghost">Learn More</a>
            </div>
            <div className="ng-steps">
              <span>1. Sign Up</span>
              <span>2. Secure Wallet</span>
              <span>3. Earn Rewards</span>
            </div>
          </div>

          {/* KANAN: AREA BINGKAI FOTO KOTA NEON BERANIMASI */}
          <div className="ng-stage className='ng-animate-fade' style={{ animationDelay: '0.2s' }}">
            <SplineHero />
            
            <div className="ng-status">
              <b>MINING NETWORK ACTIVE</b>
              <small>Latency: Stable • Load: Nominal</small>
            </div>
          </div>
        </section>

        {/* --- REGISTRATION BONUS BANNER --- */}
        {bonus && (
          <div className="ng-bonus ng-animate-fade" style={{ animationDelay: '0.4s' }}>
            <div>
              <h2>Early Bird Registration Bonus!</h2>
              <p>Dapatkan bonus kecepatan klaim untuk pendaftar awal selama kuota masih tersedia.</p>
            </div>
            <div className="ng-counter">
              <strong>{fmt(bonus.remaining_slots)}</strong>
              <small>Slots Left / {fmt(bonus.total_slots)} Total</small>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
