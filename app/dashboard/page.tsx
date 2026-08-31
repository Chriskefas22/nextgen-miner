import { AppShell } from '@/components/layout/AppShell';
import { HologramCore } from '@/components/hologram/HologramCore';
import Link from 'next/link';
import {
  Boxes,
  ArrowUp,
  ShoppingCart,
  Droplets,
  Target,
  Users,
  Wallet,
  Gift,
  BarChart3,
  Zap,
  CircleDollarSign,
  Gem,
  Activity,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

const quickActions = [
  ['Buy Miner', '/miners', Boxes, 'cyan'],
  ['Upgrade', '/miners?tab=upgrade', ArrowUp, 'purple'],
  ['Shop', '/shop', ShoppingCart, 'gold'],
  ['Faucet', '/faucet', Droplets, 'cyan'],
  ['Quests', '/quests', Target, 'pink'],
  ['Referral', '/referrals', Users, 'blue'],
] as const;

function MiniChart() {
  return (
    <div className="bp-chart" aria-hidden="true">
      <span /><span /><span /><span /><span /><span /><span /><span /><span />
    </div>
  );
}

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const username = String(
    user?.user_metadata?.username ||
      user?.user_metadata?.full_name ||
      user?.email?.split('@')[0] ||
      'Miner'
  );

  let totalHashrate = 0;
  let activeMiners = 0;
  let diamondBalance = 0;

  if (user) {
    const [{ data: miners }, { data: wallet }] = await Promise.all([
      supabase
        .from('nextgen_user_miners')
        .select('miner_id,current_level,is_active')
        .eq('user_id', user.id),
      supabase
        .from('nextgen_wallets')
        .select('diamond_balance')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const active = (miners ?? []).filter((m) => m.is_active !== false);
    activeMiners = active.length;
    diamondBalance = Number(wallet?.diamond_balance ?? 0);

    if (active.length) {
      const minerIds = active.map((m) => m.miner_id);
      const levels = active.map((m) => Number(m.current_level ?? 1));
      const { data: levelRows } = await supabase
        .from('nextgen_miner_levels')
        .select('miner_id,level,hashrate')
        .in('miner_id', minerIds)
        .in('level', levels);

      totalHashrate = active.reduce((sum, miner) => {
        const row = (levelRows ?? []).find(
          (level) =>
            level.miner_id === miner.miner_id &&
            Number(level.level) === Number(miner.current_level)
        );
        return sum + Number(row?.hashrate ?? 0);
      }, 0);
    }
  }

  return (
    <AppShell>
      <div className="bp-hero-head">
        <div className="bp-hero-copy">
          <div className="eyebrow">COMMAND CENTER</div>
          <h1>Welcome back,<br />{username} ◇</h1>
          <p>Mine smart. Upgrade fast.<br />Build your future.</p>
          <div className="bp-standby"><span /> {activeMiners > 0 ? 'MINING ONLINE' : 'MINING STANDBY'}</div>
        </div>

        <div className="bp-status-stack">
          <div className="bp-status-card"><span>MINING STATUS</span><b>{activeMiners > 0 ? 'ONLINE' : 'STANDBY'}</b><Activity size={20}/></div>
          <div className="bp-status-card"><span>NETWORK</span><b className="online-text">● ONLINE</b><BarChart3 size={20}/></div>
          <div className="bp-status-card"><span>BLOCK HEIGHT</span><b>7,382,945</b></div>
          <div className="bp-status-card"><span>DIFFICULTY</span><b>12.48 T</b></div>
          <div className="bp-status-card"><span>NEXT REWARD</span><b>02:14:58</b></div>
        </div>
      </div>

      <div className="bp-main-scene">
        <section className="bp-holo-wrap">
          <HologramCore />
        </section>

        <aside className="bp-left-metrics glass">
          <div className="bp-metric"><Zap/><span>TOTAL HASHRATE</span><b>{totalHashrate.toLocaleString('en-US')} H/s</b></div>
          <div className="bp-metric"><Boxes/><span>MINERS ACTIVE</span><b>{activeMiners}</b></div>
          <div className="bp-metric"><CircleDollarSign/><span>TOTAL EARNED</span><b>$12.48</b></div>
          <div className="bp-metric"><Gem/><span>N POINT</span><b>{diamondBalance.toLocaleString('en-US')}</b></div>
          <div className="bp-metric"><Activity/><span>TODAY EARNED</span><b>$0.48</b></div>
        </aside>

        <aside className="bp-node-card glass">
          <div className="bp-card-label">NETWORK NODES</div>
          <div className="bp-node-map"><div className="bp-map-grid" /><div className="bp-map-glow" /></div>
          <div className="bp-global"><span>GLOBAL HASHRATE</span><b>418.71 EH/s</b><MiniChart/></div>
        </aside>
      </div>

      <section className="bp-overview glass">
        <div className="bp-section-title">MINING OVERVIEW</div>
        <div className="bp-overview-grid">
          <article><span>DAILY PROFIT</span><b>$0.48</b><em>+12.4%</em><MiniChart/></article>
          <article><span>WEEKLY PROFIT</span><b>$3.52</b><em>+8.7%</em><MiniChart/></article>
          <article><span>MONTHLY PROFIT</span><b>$14.86</b><em>+15.2%</em><MiniChart/></article>
          <article><span>CONTRACT VALUE</span><b>$120.00</b><strong>Active</strong></article>
        </div>
      </section>

      <section className="bp-actions-row">
        <div className="bp-actions glass">
          <div className="bp-section-title">QUICK ACTIONS</div>
          <div className="bp-action-grid">
            {quickActions.map(([label, href, Icon, tone]) => (
              <Link href={href} key={label} className={`bp-action action-${tone}`}>
                <div><Icon size={27}/></div>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>

        <Link href="/membership" className="bp-premium">
          <div>
            <span>PREMIUM MEMBERSHIP</span>
            <p>Boost your hashrate up to</p>
            <b>+300%</b>
            <strong>UPGRADE NOW</strong>
          </div>
          <div className="bp-premium-orb">✦</div>
        </Link>
      </section>

      <section className="bp-footer-strip">
        <span><Gem size={14}/> {diamondBalance.toLocaleString('en-US')} N POINT</span>
        <span><Wallet size={14}/> WALLET READY</span>
        <span><Gift size={14}/> REWARDS ACTIVE</span>
      </section>
    </AppShell>
  );
}
