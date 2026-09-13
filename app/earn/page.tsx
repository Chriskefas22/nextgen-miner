import { AppShell } from '@/components/layout/AppShell';
import Link from 'next/link';
import { MousePointerClick, Link2, Gift, Video, Target, ClipboardCheck } from 'lucide-react';

const revenueActivities = [
  ['PTC', 'View sponsored pages and complete verified sessions. Provider-backed activity can contribute recognized revenue.', '/ptc', MousePointerClick],
  ['Shortlinks', 'Complete shortlink journeys. Recognized provider revenue can feed the platform economy.', '/shortlinks', Link2],
  ['Offers', 'Complete partner offers with provider validation. These are a core monetization activity.', '/offers', Gift],
  ['Surveys', 'Complete supported surveys. Provider-verified revenue can enter the revenue engine.', '/surveys', ClipboardCheck],
] as const;

const utilityActivities = [
  ['Quests', 'Complete objectives and receive Diamond or other platform incentives.', '/quests', Target],
  ['Faucet', 'Claim timed Diamond rewards for engagement. Faucet rewards do not directly fund crypto mining.', '/faucet', Video],
] as const;

export default function Earn(){
  return <AppShell><div className="page-head"><div><div className="eyebrow">EARN HUB</div><h1 className="page-title">Build Your Mining Capacity</h1><div className="muted">Earn 💎 through platform activity, then turn Diamond into miners and H/s. Crypto mining is funded by recognized platform revenue, not by faucet or free rewards.</div></div></div>
    <section className="glass section" style={{marginBottom:14}}><div className="eyebrow">THE NEXTGEN FLOW</div><h2>Activity → 💎 → Miner → H/s → Pool → Crypto</h2><p className="muted">Diamond is an internal utility balance and cannot be withdrawn. Use it to acquire, upgrade and merge miners. Eligible mining rewards settle every 24 hours from a revenue-funded pool with rolling 10-day reward lots.</p></section>
    <div className="eyebrow">REVENUE-BACKED ACTIVITIES</div><div className="earn-grid">{revenueActivities.map(([t,d,h,I])=><Link href={h} key={t} className="glass earn-card"><div className="icon-orb"><I size={18}/></div><h3>{t}</h3><p>{d}</p><div className="trend" style={{marginTop:12}}>Open module →</div></Link>)}</div>
    <div className="eyebrow" style={{marginTop:18}}>DIAMOND / ENGAGEMENT</div><div className="earn-grid">{utilityActivities.map(([t,d,h,I])=><Link href={h} key={t} className="glass earn-card"><div className="icon-orb"><I size={18}/></div><h3>{t}</h3><p>{d}</p><div className="trend" style={{marginTop:12}}>Open module →</div></Link>)}</div>
    <section className="glass section" style={{marginTop:18}}><div className="eyebrow">IMPORTANT</div><p className="muted">Deposits are not automatically mining revenue. Deposit principal remains user funds; only a recognized platform fee or margin can be treated as revenue. There is no guaranteed crypto yield and no artificial pool funding.</p></section>
  </AppShell>
}
