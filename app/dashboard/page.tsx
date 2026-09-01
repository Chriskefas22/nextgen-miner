import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  Droplets,
  Gem,
  History,
  ShoppingCart,
  Target,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';

const quickActions = [
  { label: 'Miners', href: '/miners', icon: Boxes },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'Deposit', href: '/wallet', icon: ArrowDownToLine },
  { label: 'Withdraw', href: '/wallet', icon: ArrowUpRight },
  { label: 'Faucet', href: '/faucet', icon: Droplets },
  { label: 'Quests', href: '/quests', icon: Target },
  { label: 'Referrals', href: '/referrals', icon: Users },
  { label: 'Shop', href: '/miners', icon: ShoppingCart },
] as const;

type MinerRow = {
  miner_id: number;
  current_level: number;
  status: string;
};

type LevelRow = {
  miner_id: number;
  level: number;
  hashrate: number | string;
};

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const username = String(
    user?.user_metadata?.username ||
      user?.user_metadata?.full_name ||
      user?.email?.split('@')[0] ||
      'Miner'
  );

  let diamondBalance = 0;
  let reservedDiamond = 0;
  let activeMiners = 0;
  let totalHashrate = 0;
  let totalRewards = 0;
  let todayRewards = 0;

  let recentTransactions: Array<{
    tx_type: string;
    diamond_delta: number | string;
    created_at: string;
  }> = [];

  if (user) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      { data: wallet },
      { data: miners },
      { data: rewards },
      { data: todayRewardRows },
      { data: transactions },
    ] = await Promise.all([
      supabase
        .from('nextgen_wallets')
        .select('diamond_balance,reserved_diamond')
        .eq('user_id', user.id)
        .maybeSingle(),

      supabase
        .from('nextgen_user_miners')
        .select('miner_id,current_level,status')
        .eq('user_id', user.id),

      supabase
        .from('nextgen_reward_ledger')
        .select('amount_diamond')
        .eq('user_id', user.id)
        .eq('status', 'posted'),

      supabase
        .from('nextgen_reward_ledger')
        .select('amount_diamond')
        .eq('user_id', user.id)
        .eq('status', 'posted')
        .gte('created_at', startOfToday.toISOString()),

      supabase
        .from('nextgen_transactions')
        .select('tx_type,diamond_delta,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    diamondBalance = Number(wallet?.diamond_balance ?? 0);
    reservedDiamond = Number(wallet?.reserved_diamond ?? 0);

    totalRewards = (rewards ?? []).reduce(
      (sum, row) => sum + Number(row.amount_diamond ?? 0),
      0
    );

    todayRewards = (todayRewardRows ?? []).reduce(
      (sum, row) => sum + Number(row.amount_diamond ?? 0),
      0
    );

    recentTransactions = (transactions ?? []).map((row) => ({
      tx_type: String(row.tx_type ?? 'activity'),
      diamond_delta: Number(row.diamond_delta ?? 0),
      created_at: String(row.created_at),
    }));

    const active = ((miners ?? []) as MinerRow[]).filter(
      (miner) => miner.status === 'active'
    );

    activeMiners = active.length;

    if (active.length) {
      const minerIds = active.map((miner) => miner.miner_id);
      const levels = active.map((miner) => Number(miner.current_level));

      const { data: levelRows } = await supabase
        .from('nextgen_miner_levels')
        .select('miner_id,level,hashrate')
        .in('miner_id', minerIds)
        .in('level', levels);

      totalHashrate = active.reduce((sum, miner) => {
        const row = ((levelRows ?? []) as LevelRow[]).find(
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
      <div className="simple-dashboard">
        <section className="simple-dashboard__hero">
          <div>
            <div className="eyebrow">DASHBOARD</div>
            <h1>Welcome back, {username}</h1>
            <p>
              Monitor your mining activity, wallet and rewards in one place.
            </p>
          </div>

          <div className="simple-status">
            <span className="simple-status__dot" />
            <span>
              {activeMiners > 0 ? 'Mining active' : 'Mining standby'}
            </span>
          </div>
        </section>

        <section className="simple-balance card">
          <div>
            <span className="simple-label">DIAMOND BALANCE</span>
            <strong className="simple-balance__value">
              <Gem size={23} />
              {diamondBalance.toLocaleString('en-US')}
            </strong>
            <span className="simple-muted">
              {reservedDiamond > 0
                ? `${reservedDiamond.toLocaleString('en-US')} reserved`
                : 'Available for use'}
            </span>
          </div>

          <Link href="/wallet" className="simple-btn simple-btn--primary">
            Open Wallet
          </Link>
        </section>

        <section className="simple-grid simple-grid--3">
          <article className="card simple-stat">
            <span className="simple-label">ACTIVE MINERS</span>
            <strong>{activeMiners}</strong>
            <span className="simple-muted">Currently online</span>
          </article>

          <article className="card simple-stat">
            <span className="simple-label">TOTAL HASHRATE</span>
            <strong>{totalHashrate.toLocaleString('en-US')} H/s</strong>
            <span className="simple-muted">From active miners</span>
          </article>

          <article className="card simple-stat">
            <span className="simple-label">TODAY REWARDS</span>
            <strong>{todayRewards.toLocaleString('en-US')} 💎</strong>
            <span className="simple-muted">Posted rewards</span>
          </article>
        </section>

        <section className="simple-grid simple-grid--2">
          <article className="card simple-panel">
            <div className="simple-panel__head">
              <div>
                <span className="simple-label">MINING</span>
                <h2>Your mining status</h2>
              </div>
              <Zap size={21} />
            </div>

            <div className="simple-mining-state">
              <div>
                <span>Status</span>
                <strong>{activeMiners > 0 ? 'ACTIVE' : 'STANDBY'}</strong>
              </div>
              <div>
                <span>Hashrate</span>
                <strong>{totalHashrate.toLocaleString('en-US')} H/s</strong>
              </div>
            </div>

            <Link href="/miners" className="simple-btn simple-btn--secondary">
              Manage Miners
            </Link>
          </article>

          <article className="card simple-panel">
            <div className="simple-panel__head">
              <div>
                <span className="simple-label">REWARDS</span>
                <h2>Total rewards</h2>
              </div>
              <CircleDollarSign size={21} />
            </div>

            <div className="simple-reward-total">
              <strong>{totalRewards.toLocaleString('en-US')} 💎</strong>
              <span>Posted rewards recorded in your account</span>
            </div>

            <Link href="/earn" className="simple-btn simple-btn--secondary">
              Open Earn
            </Link>
          </article>
        </section>

        <section className="card simple-panel">
          <div className="simple-panel__head">
            <div>
              <span className="simple-label">QUICK ACCESS</span>
              <h2>What would you like to do?</h2>
            </div>
          </div>

          <div className="simple-actions">
            {quickActions.map(({ label, href, icon: Icon }) => (
              <Link href={href} key={label} className="simple-action">
                <span>
                  <Icon size={19} />
                </span>
                <strong>{label}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="card simple-panel">
          <div className="simple-panel__head">
            <div>
              <span className="simple-label">RECENT ACTIVITY</span>
              <h2>Latest transactions</h2>
            </div>
            <History size={21} />
          </div>

          {recentTransactions.length === 0 ? (
            <div className="simple-empty">
              No transactions recorded yet.
            </div>
          ) : (
            <div className="simple-activity">
              {recentTransactions.map((tx, index) => (
                <div
                  className="simple-activity__row"
                  key={`${tx.created_at}-${index}`}
                >
                  <div>
                    <strong>{tx.tx_type.replaceAll('_', ' ')}</strong>
                    <span>
                      {new Date(tx.created_at).toLocaleString('en-US')}
                    </span>
                  </div>

                  <b
                    className={
                      Number(tx.diamond_delta) >= 0
                        ? 'is-positive'
                        : 'is-negative'
                    }
                  >
                    {Number(tx.diamond_delta) >= 0 ? '+' : ''}
                    {Number(tx.diamond_delta).toLocaleString('en-US')} 💎
                  </b>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
