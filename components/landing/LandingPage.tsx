import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SplineHero from './SplineHero'; // Mengimpor manajer 3D pintar kita

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
        
        /* Modifikasi style di bagian stage agar pas dengan frame 3D baru kita */
        .ng-stage{position:relative;width:100%;min-height:380px;display:block}

        .ng-status{position:absolute;left:50%;bottom:-5px;transform:translateX(-50%);padding:10px 13px;border-radius:13px;background:rgba(4,17,27,.92);border:1px solid rgba(53,243,180,.20);white-space:nowrap;z-index:10}
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
        
        @media(max-width:900px){.ng-nav-links{display:none}.ng-hero{grid-template-columns:1fr; text-align:center; padding-top:40px;}.ng-actions{justify-content:center;}.ng-steps{justify-content:center;}}
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
          <div>
            <div className="ng-kicker">NEXT-GEN FAUCET SYSTEM</div>
            <h1>Futuristic <em>Crypto Mining</em></h1>
            <p className="ng-copy">
              Klaim reward kripto Anda dengan sistem mining berkecepatan tinggi. 
              Visual megacity masa depan langsung di perangkat Anda tanpa membebani performa.
            </p>
            <div className="ng-actions">
              <Link href="/register" className="ng-cta ng-cta-primary">Start Claim Faucet</Link>
              <a href="#features" className="ng-cta ng-cta-ghost">Learn More</a>
            </div>
            <div className="ng-steps">
              <span>1. Sign Up</span>
              <span>2. View Cyber City</span>
              <span>3. Earn Rewards</span>
            </div>
          </div>

          {/* ⚡ KANAN: AREA VISUAL YANG KITA UBAH MENJADI HYBRID 3D */}
          <div className="ng-stage">
            <SplineHero />
            
            {/* Status box bawaan dari kode Anda tetap kita pertahankan */}
            <div className="ng-status">
              <b>MINING CORE ACTIVE</b>
              <small>System load: Nominal</small>
            </div>
          </div>
        </section>

        {/* --- REGISTRATION BONUS BANNER --- */}
        {bonus && (
          <div className="ng-bonus">
            <div>
              <h2>Early Bird Registration Bonus!</h2>
              <p>Dapatkan bonus kecepatan mining untuk pendaftar awal selama kuota masih tersedia.</p>
            </div>
            <div className="ng-counter">
              <strong>{fmt(bonus.remaining_slots)}</strong>
              <small>Slots Left / {fmt(bonus.total_slots)} Total</small>
            </div>
          </div>
        )}

        {/* Kode Anda terpotong di bagian bawah media query, jadi struktur dasar ditutup rapi di bawah ini */}
      </div>
    </main>
  );
}
