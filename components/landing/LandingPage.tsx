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
      <style jsx global>{`
        .ng-fp {
          --ng-bg: #02050b;
          --ng-panel: rgba(4, 12, 23, 0.76);
          --ng-panel-strong: rgba(6, 18, 31, 0.93);
          --ng-border: rgba(43, 157, 214, 0.28);
          --ng-cyan: #25e8ff;
          --ng-cyan-soft: rgba(37, 232, 255, 0.18);
          --ng-blue: #3286ff;
          --ng-purple: #914cff;
          --ng-purple-soft: rgba(145, 76, 255, 0.16);
          --ng-green: #36f2b4;
          --ng-text: #f3fbff;
          --ng-muted: #8fa9bd;
          --ng-max: 1440px;
          color: var(--ng-text);
          background:
            radial-gradient(circle at 62% 8%, rgba(21, 83, 146, 0.22), transparent 28%),
            radial-gradient(circle at 93% 34%, rgba(111, 39, 168, 0.12), transparent 24%),
            linear-gradient(180deg, #01040a 0%, #020711 50%, #030913 100%);
          min-height: 100vh;
          overflow: clip;
          font-family: Rajdhani, system-ui, sans-serif;
        }

        .ng-fp, .ng-fp * { box-sizing: border-box; }
        .ng-fp a { color: inherit; text-decoration: none; }
        .ng-fp img { max-width: 100%; }

        .ng-fp .nav {
          position: sticky;
          top: 0;
          z-index: 80;
          height: 78px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 28px;
          padding: 0 30px;
          background: rgba(2, 7, 14, 0.82);
          border-bottom: 1px solid rgba(45, 127, 178, 0.24);
          backdrop-filter: blur(18px);
        }

        .ng-fp .brand {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          min-width: max-content;
          font-family: Orbitron, system-ui, sans-serif;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: .07em;
        }

        .ng-fp .logo {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border: 2px solid var(--ng-cyan);
          border-radius: 15px;
          color: var(--ng-cyan);
          background: linear-gradient(180deg, rgba(21, 93, 142, .2), rgba(5, 16, 30, .65));
          box-shadow: 0 0 28px rgba(37, 232, 255, .18), inset 0 0 18px rgba(37, 232, 255, .08);
          font-size: 24px;
        }

        .ng-fp .brand span span { color: var(--ng-cyan); }

        .ng-fp .navlinks {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(12px, 2vw, 30px);
          min-width: 0;
        }

        .ng-fp .navlinks a {
          position: relative;
          padding: 29px 0 25px;
          color: #c5d7e4;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
        }

        .ng-fp .navlinks a:hover,
        .ng-fp .navlinks a.active { color: #fff; }

        .ng-fp .navlinks a.active::after {
          content: "";
          position: absolute;
          left: 0; right: 0; bottom: 14px;
          height: 2px;
          background: linear-gradient(90deg, var(--ng-cyan), #6b84ff);
          box-shadow: 0 0 15px rgba(37, 232, 255, .8);
        }

        .ng-fp .navactions {
          display: flex;
          gap: 10px;
        }

        .ng-fp .navbtn, .ng-fp .cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 15px;
          font-weight: 800;
          border: 1px solid rgba(51, 154, 210, .45);
          transition: transform .2s ease, filter .2s ease, box-shadow .2s ease;
        }

        .ng-fp .navbtn {
          padding: 12px 18px;
          font-size: 13px;
          background: rgba(7, 17, 30, .82);
        }

        .ng-fp .navbtn.primary,
        .ng-fp .cta.primary {
          background: linear-gradient(135deg, #17cfff 0%, #3e7cff 46%, #9747ff 100%);
          border-color: rgba(96, 208, 255, .68);
          box-shadow: 0 10px 35px rgba(52, 118, 255, .21), inset 0 0 22px rgba(255, 255, 255, .09);
        }

        .ng-fp .navbtn:hover, .ng-fp .cta:hover {
          transform: translateY(-2px);
          filter: brightness(1.06);
        }

        .ng-fp .mobile-nav { display: none; }

        .ng-fp .hero {
          position: relative;
          min-height: 640px;
          border-bottom: 1px solid rgba(40, 123, 171, .18);
          isolation: isolate;
        }

        .ng-fp .hero-bg,
        .ng-fp .hero-grid,
        .ng-fp .hero-vignette,
        .ng-fp .hero-scan {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .ng-fp .hero-bg { z-index: -5; overflow: hidden; }
        .ng-fp .hero-image {
          object-fit: cover;
          object-position: 64% center;
          opacity: .62;
          filter: brightness(.7) saturate(1.08) contrast(1.08);
          transform: scale(1.04);
        }

        .ng-fp .hero-grid {
          z-index: -4;
          background:
            linear-gradient(rgba(29, 116, 173, .08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(29, 116, 173, .07) 1px, transparent 1px);
          background-size: 90px 90px;
          mask-image: linear-gradient(90deg, #000 0%, rgba(0,0,0,.8) 60%, transparent 100%);
        }

        .ng-fp .hero-scan {
          z-index: -3;
          background: linear-gradient(180deg, transparent 10%, rgba(37,232,255,.06) 48%, transparent 58%);
          animation: ng-scan 7s linear infinite;
          opacity: .75;
        }

        .ng-fp .hero-vignette {
          z-index: -2;
          background:
            linear-gradient(90deg, rgba(1,4,9,.97) 0%, rgba(1,6,14,.77) 36%, rgba(2,8,14,.18) 68%, rgba(2,6,12,.62) 100%),
            linear-gradient(180deg, rgba(1,6,13,.15), rgba(0,0,0,.36));
        }

        .ng-fp .hero-content {
          width: min(var(--ng-max), calc(100% - 48px));
          min-height: 640px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.02fr) minmax(0, 1fr);
          align-items: center;
          gap: 8px;
          position: relative;
        }

        .ng-fp .hero-copy {
          max-width: 650px;
          padding: 76px 0 105px;
          position: relative;
          z-index: 3;
        }

        .ng-fp .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--ng-cyan);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .21em;
          text-transform: uppercase;
        }

        .ng-fp .status-pulse,
        .ng-fp .live-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: inline-block;
          background: var(--ng-cyan);
          box-shadow: 0 0 14px rgba(37,232,255,.9);
        }

        .ng-fp .hero h1 {
          margin: 20px 0 17px;
          font-family: Orbitron, system-ui, sans-serif;
          font-size: clamp(46px, 5.4vw, 78px);
          line-height: .98;
          letter-spacing: -.04em;
          text-wrap: balance;
        }

        .ng-fp .hero h1 strong {
          display: block;
          font-weight: 800;
          background: linear-gradient(90deg, #ffffff 5%, #dffaff 40%, #19dcff 68%, #b04bff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 28px rgba(37, 202, 255, .08);
        }

        .ng-fp .hero-desc {
          max-width: 610px;
          margin: 0;
          color: #c0d6e7;
          font-size: 19px;
          line-height: 1.48;
        }

        .ng-fp .hero-actions {
          display: flex;
          gap: 13px;
          margin-top: 28px;
          flex-wrap: wrap;
        }

        .ng-fp .cta { min-height: 58px; padding: 0 28px; font-size: 15px; }
        .ng-fp .cta.ghost { background: rgba(2, 12, 22, .62); }
        .ng-fp .hero-microcopy {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          margin-top: 18px;
          color: #7695a9;
          font-size: 12px;
        }

        .ng-fp .hero-microcopy span { display: inline-flex; align-items: center; gap: 6px; }
        .ng-fp .hero-microcopy i { width: 6px; height: 6px; border-radius: 50%; background: var(--ng-green); box-shadow: 0 0 9px rgba(54,242,180,.9); }

        .ng-fp .hero-gpu {
          position: relative;
          height: 570px;
          align-self: end;
          overflow: hidden;
        }

        .ng-fp .hero-gpu::before {
          content: "";
          position: absolute;
          width: 580px;
          height: 420px;
          right: 3%;
          top: 13%;
          background: radial-gradient(circle, rgba(24,202,255,.3), rgba(44,101,255,.12) 36%, transparent 68%);
          filter: blur(24px);
          animation: ng-breathe 5.4s ease-in-out infinite;
        }

        .ng-fp .hero-gpu::after {
          content: "";
          position: absolute;
          left: 7%;
          right: 0;
          bottom: 2%;
          height: 28%;
          background: radial-gradient(ellipse, rgba(37, 232, 255, .18), transparent 65%);
          transform: perspective(400px) rotateX(64deg);
        }

        .ng-fp .hero-gpu-image {
          object-fit: contain;
          object-position: center bottom;
          filter: drop-shadow(0 0 36px rgba(35, 163, 255, .28)) drop-shadow(0 22px 28px rgba(0,0,0,.5));
          transform: translateY(3%);
        }

        .ng-fp .hero-statusbar {
          position: absolute;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          width: min(var(--ng-max), calc(100% - 48px));
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 10px 14px;
          border-top: 1px solid rgba(40, 137, 182, .22);
          border-bottom: 1px solid rgba(40, 137, 182, .14);
          color: #718da4;
          font-size: 10px;
          letter-spacing: .13em;
          text-transform: uppercase;
        }

        .ng-fp .hero-statusbar span { display: inline-flex; align-items: center; gap: 7px; }
        .ng-fp .hero-statusbar i { width: 6px; height: 6px; border-radius: 50%; background: var(--ng-green); box-shadow: 0 0 8px rgba(54,242,180,.8); }

        .ng-fp .trust {
          width: min(var(--ng-max), calc(100% - 48px));
          margin: -8px auto 0;
          position: relative;
          z-index: 5;
        }

        .ng-fp .trust-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          border: 1px solid rgba(46, 129, 174, .22);
          background: rgba(4, 13, 23, .76);
          backdrop-filter: blur(14px);
        }

        .ng-fp .trust-item {
          min-height: 98px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 16px 20px;
          border-right: 1px solid rgba(42, 120, 164, .17);
        }

        .ng-fp .trust-item:last-child { border-right: 0; }
        .ng-fp .trust-icon {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(36, 200, 255, .35);
          border-radius: 12px;
          color: var(--ng-cyan);
          background: rgba(36, 200, 255, .05);
          box-shadow: inset 0 0 18px rgba(36, 200, 255, .05);
          font-size: 18px;
        }

        .ng-fp .trust-item b { display: block; font-family: Orbitron, system-ui, sans-serif; font-size: 12px; margin-bottom: 5px; }
        .ng-fp .trust-item small { color: #8ca6b8; line-height: 1.35; font-size: 11px; }

        .ng-fp .network-section,
        .ng-fp .section,
        .ng-fp .campaign {
          width: min(var(--ng-max), calc(100% - 48px));
          margin: 58px auto 0;
        }

        .ng-fp .hud-frame {
          position: relative;
          padding: 24px;
          border: 1px solid rgba(44, 161, 219, .44);
          background:
            linear-gradient(180deg, rgba(5, 15, 26, .93), rgba(3, 10, 18, .94)),
            radial-gradient(circle at 15% 20%, rgba(18, 191, 255, .08), transparent 36%);
          box-shadow: inset 0 0 40px rgba(34, 179, 255, .04), 0 28px 70px rgba(0,0,0,.28);
          clip-path: polygon(0 18px, 20px 0, calc(100% - 20px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 20px) 100%, 20px 100%, 0 calc(100% - 18px));
        }

        .ng-fp .hud-frame::after {
          content: "";
          position: absolute;
          inset: 9px;
          pointer-events: none;
          border: 1px solid rgba(53, 185, 241, .08);
          clip-path: inherit;
        }

        .ng-fp .network-heading,
        .ng-fp .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
        }

        .ng-fp .network-heading h2,
        .ng-fp .section-head h2 {
          margin: 4px 0 0;
          font-family: Orbitron, system-ui, sans-serif;
          font-size: 22px;
          letter-spacing: .02em;
        }

        .ng-fp .network-online {
          color: var(--ng-green);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .14em;
          padding: 8px 11px;
          border: 1px solid rgba(54, 242, 180, .25);
          border-radius: 999px;
          background: rgba(54, 242, 180, .05);
        }

        .ng-fp .network-online i { display: inline-block; width: 7px; height: 7px; margin-right: 7px; border-radius: 50%; background: var(--ng-green); box-shadow: 0 0 10px rgba(54, 242, 180, .9); }

        .ng-fp .network-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.26fr) minmax(280px, .74fr);
          align-items: stretch;
          gap: 20px;
          margin-top: 18px;
        }

        .ng-fp .network-visual {
          min-height: 455px;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(40, 133, 180, .12);
          background:
            radial-gradient(circle at 45% 44%, rgba(38, 198, 255, .07), transparent 32%),
            linear-gradient(180deg, rgba(5, 16, 28, .2), rgba(1,7,12,.1));
        }

        .ng-fp .network-core-3d { position: relative; width: 100%; height: 455px; }
        .ng-fp .network-core-3d__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display:block; }
        .ng-fp .network-core-3d__aura {
          position: absolute; inset: 9% 12%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(31, 210, 255, .2), transparent 68%);
          filter: blur(18px);
          animation: ng-breathe 5s ease-in-out infinite;
        }
        .ng-fp .network-core-3d__scan {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, transparent 0%, rgba(49, 220, 255, .09) 49%, transparent 54%);
          animation: ng-scan 6s linear infinite;
          pointer-events: none;
        }
        .ng-fp .network-core-3d__reflection {
          position: absolute; left: 13%; right: 13%; bottom: 8%;
          height: 15%;
          background: radial-gradient(ellipse, rgba(44, 218, 255, .2), transparent 70%);
          transform: perspective(260px) rotateX(64deg);
          pointer-events: none;
        }

        .ng-fp .network-status {
          padding: 18px 14px 12px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .ng-fp .status-label {
          color: #7995a8;
          font-size: 10px;
          letter-spacing: .16em;
          font-weight: 700;
        }

        .ng-fp .status-main {
          margin-top: 6px;
          font-family: Orbitron, system-ui, sans-serif;
          font-size: 33px;
          letter-spacing: .01em;
          background: linear-gradient(90deg, var(--ng-cyan), #a5f4ff);
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          text-shadow: 0 0 20px rgba(37, 232, 255, .16);
        }

        .ng-fp .status-meter {
          height: 5px;
          margin: 16px 0 12px;
          border-radius: 999px;
          background: #07111c;
          border: 1px solid rgba(50, 128, 167, .23);
          overflow: hidden;
        }

        .ng-fp .status-meter span {
          display: block;
          width: 74%;
          height: 100%;
          background: linear-gradient(90deg, var(--ng-cyan), #427cff, var(--ng-purple));
          box-shadow: 0 0 16px rgba(57, 155, 255, .55);
          animation: ng-meter 4.5s ease-in-out infinite;
        }

        .ng-fp .status-meta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #6b879b;
          font-size: 10px;
          letter-spacing: .08em;
          margin-bottom: 16px;
        }

        .ng-fp .status-meta strong { color: var(--ng-green); }
        .ng-fp .status-meta i { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--ng-green); box-shadow:0 0 7px rgba(54,242,180,.8); margin-right:5px; }

        .ng-fp .network-metrics { display:grid; gap:8px; }
        .ng-fp .metric-card {
          display:grid;
          grid-template-columns: 42px 1fr auto;
          align-items:center;
          gap:10px;
          padding:11px;
          min-height:66px;
          border:1px solid rgba(42, 129, 176, .26);
          border-radius:12px;
          background: linear-gradient(180deg, rgba(8,24,39,.9), rgba(4,13,23,.92));
          box-shadow: inset 0 0 16px rgba(35, 167, 221, .028);
        }

        .ng-fp .metric-icon {
          width: 38px; height: 38px; display:grid; place-items:center;
          border:1px solid rgba(38, 195, 247, .25);
          border-radius:11px; color:var(--ng-cyan); background:rgba(38,195,247,.04); font-size:17px;
        }

        .ng-fp .metric-card small { display:block; color:#7893a8; font-size:9px; letter-spacing:.11em; }
        .ng-fp .metric-card b { display:block; margin-top:2px; font-family:Orbitron, system-ui, sans-serif; font-size:15px; }
        .ng-fp .metric-card em { color: var(--ng-green); font-size:10px; font-style:normal; }

        .ng-fp .campaign {
          min-height: 390px;
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1.02fr) minmax(0, .98fr);
          gap: 8px;
          overflow: hidden;
          border: 1px solid rgba(117, 63, 255, .7);
          background:
            radial-gradient(circle at 10% 40%, rgba(112, 59, 255, .12), transparent 28%),
            linear-gradient(140deg, rgba(19, 10, 42, .9), rgba(3, 10, 18, .95) 48%, rgba(12, 5, 29, .96));
          clip-path: polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px));
        }

        .ng-fp .campaign::before {
          content: "";
          position:absolute; inset:12px;
          border:1px solid rgba(87, 139, 255, .15);
          clip-path: inherit;
          pointer-events:none;
        }

        .ng-fp .campaign-copy { position:relative; z-index:3; padding: 38px 0 38px 36px; }
        .ng-fp .campaign-tag {
          position:absolute;
          top:22px; right:32px;
          padding:8px 11px;
          border:1px solid rgba(65, 169, 255, .38);
          border-radius:9px;
          color:#a9d8f4;
          font-size:10px; font-weight:800; letter-spacing:.13em;
          background:rgba(4,15,26,.55);
        }

        .ng-fp .campaign h2 {
          margin: 18px 0 0;
          font-family: Orbitron, system-ui, sans-serif;
          font-size: clamp(31px, 3.2vw, 50px);
          line-height: 1.02;
        }

        .ng-fp .campaign h2 span {
          color: transparent;
          background: linear-gradient(90deg, var(--ng-cyan), #76c9ff 45%, #b24dff);
          -webkit-background-clip: text;
          background-clip: text;
        }

        .ng-fp .campaign h3 {
          margin: 4px 0 15px;
          font-size: clamp(18px, 2vw, 26px);
          color:#d7e9f7;
          font-weight:700;
        }

        .ng-fp .campaign p { max-width: 605px; color:#9db8ca; font-size:15px; line-height:1.45; }

        .ng-fp .bonus-specs {
          display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:16px 0;
        }

        .ng-fp .bonus-specs > div {
          min-height:69px; padding:10px 12px;
          border:1px solid rgba(54,139,197,.23);
          border-radius:11px; background:rgba(3,12,21,.65);
        }
        .ng-fp .bonus-specs small { display:block; color:#6f8ca0; font-size:8px; letter-spacing:.1em; }
        .ng-fp .bonus-specs b { display:block; margin-top:4px; font-family:Orbitron, system-ui, sans-serif; font-size:12px; }
        .ng-fp .bonus-specs em { display:block; color:var(--ng-cyan); font-size:10px; font-style:normal; margin-top:2px; }

        .ng-fp .allocation-bar { margin:13px 0 18px; max-width: 620px; }
        .ng-fp .allocation-track { height:11px; border-radius:999px; overflow:hidden; background:#06101b; border:1px solid rgba(48,119,168,.24); }
        .ng-fp .allocation-track i { display:block; height:100%; background:linear-gradient(90deg, var(--ng-cyan), #6c6fff, var(--ng-purple)); box-shadow:0 0 18px rgba(102,100,255,.35); }
        .ng-fp .allocation-labels { display:flex; justify-content:space-between; gap:12px; margin-top:7px; color:#7e98aa; font-size:10px; letter-spacing:.04em; }
        .ng-fp .allocation-labels strong { color:#e7f8ff; font-family:Orbitron, system-ui, sans-serif; }

        .ng-fp .bonus-visual {
          min-height:390px;
          position:relative;
          overflow:hidden;
          display:flex; align-items:center; justify-content:center;
        }

        .ng-fp .bonus-visual::before {
          content:"";
          position:absolute; width:540px; height:400px;
          background:radial-gradient(circle, rgba(36,203,255,.19), rgba(96,63,255,.12) 34%, transparent 69%);
          filter:blur(12px);
          animation:ng-breathe 5.8s ease-in-out infinite;
        }

        .ng-fp .bonus-hud {
          position:absolute; top:20px; right:22px; z-index:4;
          display:flex; flex-direction:column; align-items:flex-end; gap:6px;
          color:#8ab0c5; font-size:10px; letter-spacing:.11em;
        }

        .ng-fp .bonus-hud b {
          color:#a7efff;
          padding:6px 9px;
          border:1px solid rgba(59,174,255,.32);
          border-radius:8px;
          background:rgba(5,13,23,.55);
        }

        .ng-fp .gpu-platform {
          position:absolute;
          width:92%; height:82%; right:0; bottom:3%;
        }

        .ng-fp .gpu-platform::before {
          content:"";
          position:absolute; left:4%; right:1%; bottom:6%;
          height:20%;
          background:radial-gradient(ellipse, rgba(47,214,255,.28), transparent 66%);
          transform:perspective(300px) rotateX(66deg);
        }

        .ng-fp .entry-gpu-image {
          object-fit:contain;
          object-position:center center;
          filter:drop-shadow(0 0 36px rgba(54,165,255,.35)) drop-shadow(0 20px 24px rgba(0,0,0,.55));
        }

        .ng-fp .bonus-orbit {
          position:absolute;
          width:64%; height:28%;
          border:1px solid rgba(42,232,255,.56);
          border-radius:50%;
          transform:rotate(-15deg);
          bottom:13%; right:15%;
          box-shadow:0 0 19px rgba(42,232,255,.13);
          animation:ng-orbit 8s linear infinite;
        }

        .ng-fp .orbit-two {
          width:48%; height:17%;
          right:8%; bottom:19%;
          border-color:rgba(161,76,255,.55);
          animation-duration:10s;
          animation-direction:reverse;
        }

        .ng-fp .section { margin-top: 62px; }
        .ng-fp .section-head { align-items: flex-end; margin-bottom: 18px; }
        .ng-fp .section-head > div { max-width: 780px; }
        .ng-fp .section-head p { max-width: 690px; margin: 7px 0 0; color:#8faabd; font-size:15px; line-height:1.45; }

        .ng-fp .steps {
          display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px;
        }

        .ng-fp .step {
          min-height:156px; padding:18px; border:1px solid rgba(41,122,167,.24);
          border-radius:16px;
          background:linear-gradient(180deg, rgba(6,18,30,.85), rgba(3,10,18,.92));
          position:relative; overflow:hidden;
        }

        .ng-fp .step::after {
          content:""; position:absolute; right:-20px; bottom:-28px; width:100px; height:100px;
          background:radial-gradient(circle, rgba(39,205,255,.10), transparent 65%);
        }

        .ng-fp .step .n {
          color:var(--ng-cyan); font-family:Orbitron, system-ui, sans-serif; font-size:13px; letter-spacing:.1em;
        }
        .ng-fp .step h3 { margin:18px 0 6px; font-family:Orbitron, system-ui, sans-serif; font-size:14px; }
        .ng-fp .step p { margin:0; color:#8faabd; font-size:12px; line-height:1.45; }

        .ng-fp .miners {
          display:grid;
          grid-template-columns: minmax(230px, 1.1fr) repeat(5,minmax(160px,1fr));
          gap:11px;
        }

        .ng-fp .miner-intro {
          padding:18px 10px 18px 2px;
          display:flex; flex-direction:column; justify-content:center;
        }
        .ng-fp .miner-intro h2 { margin:5px 0 8px; font-family:Orbitron, system-ui, sans-serif; font-size:22px; }
        .ng-fp .miner-intro p { color:#8ea8ba; line-height:1.45; font-size:14px; margin:0 0 16px; }
        .ng-fp .miner-intro .cta { align-self:flex-start; min-height:48px; padding:0 18px; }

        .ng-fp .miner-showcase-card {
          position:relative; overflow:hidden; border:1px solid rgba(41,123,167,.27); border-radius:15px;
          background:linear-gradient(180deg, rgba(7,19,31,.86), rgba(3,10,18,.96));
          transition:transform .25s ease, border-color .25s ease, box-shadow .25s ease;
        }
        .ng-fp .miner-showcase-card:hover {
          transform:translateY(-4px);
          border-color:rgba(43,201,249,.45);
          box-shadow:0 17px 34px rgba(0,0,0,.26), 0 0 28px rgba(37,198,255,.06);
        }

        .ng-fp .miner-img {
          position:relative; height:150px;
          background:radial-gradient(circle at 50% 70%, rgba(35,214,255,.14), transparent 55%);
        }
        .ng-fp .miner-img img { object-fit:contain; padding:8px; filter:saturate(1.08) contrast(1.04); }
        .ng-fp .miner-info { padding:12px 13px 14px; }
        .ng-fp .miner-info h3 { margin:0 0 5px; font-family:Orbitron, system-ui, sans-serif; font-size:12px; }
        .ng-fp .miner-info b { display:block; color:var(--ng-cyan); font-family:Orbitron, system-ui, sans-serif; font-size:12px; }
        .ng-fp .miner-info small { display:block; color:#7f9aab; margin-top:4px; font-size:10px; }
        .ng-fp .tier { position:absolute; top:9px; right:9px; padding:5px 7px; border-radius:7px; color:#9adfff; border:1px solid rgba(54,157,212,.27); background:rgba(2,9,16,.62); font-size:8px; letter-spacing:.09em; text-transform:uppercase; }

        .ng-fp .feature-grid {
          display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:11px;
        }

        .ng-fp .feature {
          padding:19px;
          border:1px solid rgba(43,119,163,.25);
          border-radius:15px;
          background:linear-gradient(180deg, rgba(6,18,30,.82), rgba(3,10,18,.9));
        }
        .ng-fp .feature .icon { width:41px; height:41px; display:grid; place-items:center; border-radius:12px; border:1px solid rgba(36,201,254,.28); color:var(--ng-cyan); background:rgba(36,201,254,.04); font-size:17px; }
        .ng-fp .feature h3 { margin:13px 0 5px; font-family:Orbitron, system-ui, sans-serif; font-size:12px; }
        .ng-fp .feature p { margin:0; color:#8aa5b8; font-size:12px; line-height:1.45; }

        .ng-fp .faq-list { display:grid; gap:9px; }
        .ng-fp .faq {
          border:1px solid rgba(44,123,167,.26);
          border-radius:13px;
          background:rgba(5,16,27,.74);
          overflow:hidden;
        }
        .ng-fp .faq summary {
          cursor:pointer; list-style:none; padding:17px 18px; font-weight:800; font-size:14px; position:relative;
        }
        .ng-fp .faq summary::-webkit-details-marker { display:none; }
        .ng-fp .faq summary::after { content:"+"; position:absolute; right:17px; color:var(--ng-cyan); font-size:20px; top:12px; }
        .ng-fp .faq[open] summary::after { content:"−"; }
        .ng-fp .faq p { margin:0; padding:0 18px 18px; color:#8da7b8; line-height:1.48; font-size:13px; }

        .ng-fp .final {
          padding:29px 31px;
          display:flex; justify-content:space-between; align-items:center; gap:20px;
          border:1px solid rgba(59,144,212,.28);
          border-radius:18px;
          background:
            radial-gradient(circle at 20% 60%, rgba(37,232,255,.09), transparent 35%),
            linear-gradient(110deg, rgba(6,24,38,.92), rgba(9,13,31,.92));
          box-shadow: inset 0 0 28px rgba(35,160,218,.035);
        }
        .ng-fp .final h2 { margin:5px 0 6px; font-family:Orbitron, system-ui, sans-serif; font-size:24px; }
        .ng-fp .final p { margin:0; color:#91aabb; font-size:13px; }

        .ng-fp .footer {
          margin-top:64px; border-top:1px solid rgba(40,119,163,.18);
          background:#020711;
        }
        .ng-fp .footerin {
          width:min(var(--ng-max), calc(100% - 48px));
          min-height:86px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; gap:20px;
          color:#738a9a; font-size:11px;
        }
        .ng-fp .footerlinks { display:flex; gap:16px; flex-wrap:wrap; justify-content:flex-end; }
        .ng-fp .footerlinks a:hover { color:#d6f5ff; }

        .ng-fp .campaign-error {
          display:block;
          color:#d0a2ac;
          margin-top:9px;
          font-size:10px;
        }

        @keyframes ng-scan { from { transform:translateY(-105%); } to { transform:translateY(105%); } }
        @keyframes ng-breathe { 0%,100% { opacity:.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.05); } }
        @keyframes ng-meter { 0%,100% { width:70%; } 50% { width:84%; } }
        @keyframes ng-orbit { from { transform:rotate(-15deg) rotate(0deg); } to { transform:rotate(-15deg) rotate(360deg); } }

        @media (max-width: 1180px) {
          .ng-fp .nav { grid-template-columns:auto 1fr auto; gap:15px; padding:0 20px; }
          .ng-fp .navlinks { gap:14px; }
          .ng-fp .navlinks a { font-size:12px; }
          .ng-fp .hero-content { grid-template-columns:1fr 0.95fr; }
          .ng-fp .hero h1 { font-size:clamp(42px, 5.2vw, 62px); }
          .ng-fp .miners { grid-template-columns:repeat(3,minmax(0,1fr)); }
          .ng-fp .miner-intro { grid-column:1 / -1; padding:4px 0 8px; }
        }

        @media (max-width: 900px) {
          .ng-fp .nav { height:70px; grid-template-columns:auto auto; justify-content:space-between; }
          .ng-fp .navlinks, .ng-fp .navactions { display:none; }
          .ng-fp .mobile-nav { display:block; position:relative; }
          .ng-fp .mobile-nav summary {
            list-style:none; cursor:pointer; width:42px; height:42px; display:grid; place-items:center;
            border:1px solid rgba(50,144,194,.28); border-radius:12px; color:var(--ng-cyan); background:rgba(4,16,27,.86);
          }
          .ng-fp .mobile-nav summary::-webkit-details-marker { display:none; }
          .ng-fp .mobile-menu {
            position:absolute; right:0; top:52px; min-width:230px; padding:9px;
            display:grid; gap:4px; border:1px solid rgba(48,136,189,.35); border-radius:14px;
            background:rgba(3,12,21,.97); box-shadow:0 18px 45px rgba(0,0,0,.45); backdrop-filter:blur(18px);
          }
          .ng-fp .mobile-menu a { padding:11px 12px; border-radius:10px; font-size:13px; }
          .ng-fp .mobile-menu a:hover { background:rgba(26,139,201,.12); color:#fff; }

          .ng-fp .hero { min-height:760px; }
          .ng-fp .hero-content { min-height:760px; grid-template-columns:1fr; }
          .ng-fp .hero-copy { padding:66px 0 6px; max-width:700px; }
          .ng-fp .hero-gpu { position:absolute; right:-8%; bottom:4px; width:74%; height:55%; opacity:.72; }
          .ng-fp .hero-vignette { background:linear-gradient(90deg, rgba(1,4,9,.98) 0%, rgba(1,6,14,.87) 58%, rgba(2,8,14,.28) 100%), linear-gradient(180deg, rgba(1,6,13,.15), rgba(0,0,0,.38)); }
          .ng-fp .hero-statusbar { width:calc(100% - 34px); font-size:8px; }
          .ng-fp .trust { width:calc(100% - 28px); }
          .ng-fp .trust-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .ng-fp .trust-item:nth-child(2) { border-right:0; }
          .ng-fp .network-section, .ng-fp .section, .ng-fp .campaign { width:calc(100% - 28px); }
          .ng-fp .network-grid, .ng-fp .campaign { grid-template-columns:1fr; }
          .ng-fp .network-visual, .ng-fp .network-core-3d { min-height:410px; height:410px; }
          .ng-fp .campaign-copy { padding:30px 22px 24px; }
          .ng-fp .bonus-visual { min-height:340px; }
          .ng-fp .steps { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .ng-fp .feature-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .ng-fp .final { flex-direction:column; align-items:flex-start; }
          .ng-fp .footerin { width:calc(100% - 28px); flex-direction:column; justify-content:center; padding:18px 0; align-items:flex-start; }
          .ng-fp .footerlinks { justify-content:flex-start; }
        }

        @media (max-width: 600px) {
          .ng-fp .brand { font-size:13px; gap:9px; }
          .ng-fp .logo { width:42px; height:42px; border-radius:13px; font-size:21px; }
          .ng-fp .hero { min-height:720px; }
          .ng-fp .hero-content { width:calc(100% - 24px); min-height:720px; }
          .ng-fp .hero h1 { margin-top:16px; font-size:42px; line-height:1.02; }
          .ng-fp .hero-desc { font-size:16px; }
          .ng-fp .hero-actions .cta { width:100%; }
          .ng-fp .hero-gpu { right:-12%; width:92%; height:46%; bottom:28px; opacity:.61; }
          .ng-fp .hero-statusbar { display:none; }
          .ng-fp .trust-grid { grid-template-columns:1fr; }
          .ng-fp .trust-item { border-right:0; border-bottom:1px solid rgba(42,120,164,.17); }
          .ng-fp .trust-item:last-child { border-bottom:0; }
          .ng-fp .hud-frame { padding:14px; }
          .ng-fp .network-heading h2, .ng-fp .section-head h2 { font-size:18px; }
          .ng-fp .network-heading { align-items:flex-start; }
          .ng-fp .network-visual, .ng-fp .network-core-3d { height:345px; min-height:345px; }
          .ng-fp .network-status { padding:4px; }
          .ng-fp .status-main { font-size:28px; }
          .ng-fp .bonus-specs { grid-template-columns:1fr; }
          .ng-fp .allocation-labels { font-size:9px; }
          .ng-fp .campaign-tag { top:13px; right:14px; }
          .ng-fp .bonus-visual { min-height:300px; }
          .ng-fp .miners { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .ng-fp .miner-showcase-card { min-width:0; }
          .ng-fp .miner-img { height:128px; }
          .ng-fp .steps { grid-template-columns:1fr; }
          .ng-fp .feature-grid { grid-template-columns:1fr; }
          .ng-fp .section-head { align-items:flex-start; }
          .ng-fp .final { padding:24px 20px; }
          .ng-fp .footerlinks { gap:10px 14px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ng-fp .hero-scan,
          .ng-fp .network-core-3d__scan,
          .ng-fp .network-core-3d__aura,
          .ng-fp .hero-gpu::before,
          .ng-fp .bonus-visual::before,
          .ng-fp .bonus-orbit,
          .ng-fp .status-meter span { animation:none !important; }
        }
      `}</style>

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
