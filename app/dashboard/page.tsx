import { AppShell } from '@/components/layout/AppShell';
import { HologramCore } from '@/components/hologram/HologramCore';
import { WalletPanel } from '@/components/wallet/WalletPanel';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

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

  if (user) {
    const { data: miners } = await supabase
      .from('nextgen_user_miners')
      .select('miner_id,current_level,is_active')
      .eq('user_id', user.id);

    const active = (miners ?? []).filter(
      (miner) => miner.is_active !== false
    );

    activeMiners = active.length;

    if (active.length) {
      const minerIds = active.map((miner) => miner.miner_id);
      const levels = active.map((miner) =>
        Number(miner.current_level ?? 1)
      );

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
      <div className="page-head">
        <div>
          <div className="eyebrow">COMMAND CENTER</div>

          <h1 className="page-title">
            Welcome back, {username} ◈
          </h1>

          <div className="muted">
            Mine smart. Upgrade fast. Build your future.
          </div>
        </div>

        <div
          className={`status-pill ${
            activeMiners > 0 ? 'online' : ''
          }`}
        >
          ● {activeMiners > 0 ? 'MINING ONLINE' : 'MINING STANDBY'}
        </div>
      </div>

      <div className="grid grid-2">
        <section className="glass">
          <HologramCore />
        </section>

        <section className="hero-side">
          <div className="glass stat">
            <label>Total Hashrate</label>
            <b>
              {totalHashrate.toLocaleString('en-US')} H/s
            </b>
            <div className="muted">
              From active miners
            </div>
          </div>

          <div className="glass stat">
            <label>Mining Status</label>

            <b style={{ color: 'var(--green)' }}>
              {activeMiners > 0 ? 'ONLINE' : 'STANDBY'}
            </b>

            <div className="muted">
              Based on your active miners
            </div>
          </div>

          <div className="glass stat">
            <label>Mining Power</label>

            <b>
              {totalHashrate.toLocaleString('en-US')} H/s
            </b>

            <div className="muted">
              Calculated from current miner levels
            </div>
          </div>

          <div className="glass stat">
            <label>Active Miners</label>

            <b>{activeMiners}</b>

            <div className="muted">
              Owned and active
            </div>
          </div>

          <div
            className="glass quick"
            style={{ gridColumn: '1 / -1' }}
          >
            <div className="eyebrow">
              QUICK ACCESS
            </div>

            <div className="quick-links">
              <Link href="/miners">Miners</Link>
              <Link href="/faucet">Faucet</Link>
              <Link href="/quests">Quests</Link>
              <Link href="/ptc">PTC</Link>
              <Link href="/shortlinks">Shortlinks</Link>
              <Link href="/wallet">Wallet</Link>
            </div>
          </div>
        </section>
      </div>

      <div style={{ marginTop: 14 }}>
        <WalletPanel />
      </div>

      <div
        className="grid grid-3"
        style={{ marginTop: 14 }}
      >
        <section className="glass section">
          <div className="section-head">
            <div>
              <div className="eyebrow">
                YOUR NETWORK
              </div>

              <h2>Mining pulse</h2>
            </div>
          </div>

          <div className="list-row">
            <span className="muted">
              Your active miners
            </span>

            <b>{activeMiners}</b>
          </div>

          <div className="list-row">
            <span className="muted">
              Your hashrate
            </span>

            <b>
              {totalHashrate.toLocaleString('en-US')} H/s
            </b>
          </div>

          <div className="list-row">
            <span className="muted">
              Account
            </span>

            <b>
              {user ? 'CONNECTED' : 'GUEST'}
            </b>
          </div>
        </section>

        <section className="glass section">
          <div className="eyebrow">
            UPGRADE
          </div>

          <h2 className="section-title">
            Power your miners
          </h2>

          <p className="muted">
            Every miner scales through Level 10
            with rising power and upgrade cost.
          </p>

          <Link
            className="btn btn-primary"
            href="/miners"
          >
            Open Shop
          </Link>
        </section>

        <section className="glass section">
          <div className="eyebrow">
            SECURITY
          </div>

          <h2 className="section-title">
            Protected session
          </h2>

          <div className="list-row">
            <span className="muted">
              Turnstile
            </span>

            <span className="badge green">
              READY
            </span>
          </div>

          <div className="list-row">
            <span className="muted">
              Wallet actions
            </span>

            <span className="badge green">
              SERVER-SIDE
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
