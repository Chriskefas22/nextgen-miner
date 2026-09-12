import Link from 'next/link'
import { redirect } from 'next/navigation'
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
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'

const MINING_ASSET = 'USDT'

type MiningPool = {
  pool_date: string
  mining_budget_usd: number | string
  allocated_usd: number | string
  reserve_balance_usd: number | string
  reserve_coverage_ratio: number | string
  reserve_safety_multiplier: number | string
  reserve_status: string
  baseline_total_hashrate: number | string
  baseline_total_weight: number | string
  prepared_at: string
} | null

type MiningSettlement = {
  reference_id: number
  pool_date: string
  asset: string
  allocated_usd: number | string
  crypto_amount: number | string
  created_at: string
}

type CryptoBalance = {
  asset: string
  balance: number | string
  reserved_balance: number | string
}

type MiningDashboardSnapshot = {
  engine: string
  economic_rule_version: string
  asset: string
  today_utc: string
  diamond_balance: number | string
  reserved_diamond: number | string
  active_miners: number
  active_hashrate: number | string
  today_mining_reward_usd: number | string
  total_mining_reward_usd: number | string
  total_mining_reward_crypto: number | string
  outstanding_mining_liability_usd: number | string
  current_pool: MiningPool
  previous_pool: MiningPool
  crypto_balances: CryptoBalance[]
  recent_mining_settlements: MiningSettlement[]
}

const quickActions = [
  { label: 'Miners', href: '/miners', icon: Boxes },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'Deposit', href: '/wallet', icon: ArrowDownToLine },
  { label: 'Withdraw', href: '/wallet', icon: ArrowUpRight },
  { label: 'Faucet', href: '/faucet', icon: Droplets },
  { label: 'Quests', href: '/quests', icon: Target },
  { label: 'Referrals', href: '/referrals', icon: Users },
  { label: 'Shop', href: '/miners', icon: ShoppingCart },
] as const

const money = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })

const number = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })

const compactCrypto = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString('en-US', {
    maximumFractionDigits: 8,
  })

export default async function Dashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Settlement is server-authoritative. This compatibility call only asks
  // Supabase to settle the previous 24h period when eligible; the API/page
  // never calculates rewards locally.
  const { error: settlementError } = await supabase.rpc(
    'nextgen_claim_mining',
    { p_asset: MINING_ASSET },
  )

  if (settlementError && settlementError.code !== 'P0001') {
    console.error('[DashboardMiningSettlement]', settlementError)
  }

  const { data: snapshot, error: snapshotError } = await supabase.rpc(
    'nextgen_mining_dashboard_snapshot',
    { p_asset: MINING_ASSET },
  )

  if (snapshotError || !snapshot) {
    console.error('[DashboardMiningSnapshot]', snapshotError)
    redirect('/dashboard?error=mining_snapshot')
  }

  const data = snapshot as MiningDashboardSnapshot
  const username = String(
    user.user_metadata?.username ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'Miner',
  )

  const currentPool = data.current_pool
  const miningFunded =
    Number(currentPool?.mining_budget_usd ?? 0) > 0 &&
    Number(currentPool?.baseline_total_weight ?? 0) > 0

  return (
    <AppShell>
      <div className="simple-dashboard">
        <section className="simple-dashboard__hero">
          <div>
            <div className="eyebrow">DASHBOARD</div>
            <h1>Welcome back, {username}</h1>
            <p>
              Monitor your mining activity, wallet and server-settled rewards
              in one place.
            </p>
          </div>

          <div className="simple-status">
            <span className="simple-status__dot" />
            <span>
              {miningFunded ? 'Mining funded' : 'Awaiting funded pool'}
            </span>
          </div>
        </section>

        <section className="simple-balance card">
          <div>
            <span className="simple-label">DIAMOND BALANCE</span>
            <strong className="simple-balance__value">
              <Gem size={23} />
              {number(data.diamond_balance)}
            </strong>
            <span className="simple-muted">
              {Number(data.reserved_diamond) > 0
                ? `${number(data.reserved_diamond)} reserved`
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
            <strong>{data.active_miners}</strong>
            <span className="simple-muted">Current server state</span>
          </article>

          <article className="card simple-stat">
            <span className="simple-label">TOTAL HASHRATE</span>
            <strong>{number(data.active_hashrate)} H/s</strong>
            <span className="simple-muted">Active miners only</span>
          </article>

          <article className="card simple-stat">
            <span className="simple-label">MINING REWARD</span>
            <strong>${money(data.today_mining_reward_usd)}</strong>
            <span className="simple-muted">
              Settled in {MINING_ASSET}
            </span>
          </article>
        </section>

        <section className="simple-grid simple-grid--2">
          <article className="card simple-panel">
            <div className="simple-panel__head">
              <div>
                <span className="simple-label">MINING CONTROL PLANE</span>
                <h2>Authoritative pool status</h2>
              </div>
              <Zap size={21} />
            </div>

            <div className="simple-mining-state">
              <div>
                <span>Rule</span>
                <strong>{data.economic_rule_version}</strong>
              </div>
              <div>
                <span>Pool budget</span>
                <strong>${money(currentPool?.mining_budget_usd)}</strong>
              </div>
              <div>
                <span>Allocated</span>
                <strong>${money(currentPool?.allocated_usd)}</strong>
              </div>
              <div>
                <span>Reserve safety</span>
                <strong>
                  {number(currentPool?.reserve_safety_multiplier)}x
                </strong>
              </div>
              <div>
                <span>Reserve status</span>
                <strong>{currentPool?.reserve_status ?? 'UNKNOWN'}</strong>
              </div>
            </div>

            <Link
              href="/miners"
              className="simple-btn simple-btn--secondary"
            >
              Manage Miners
            </Link>
          </article>

          <article className="card simple-panel">
            <div className="simple-panel__head">
              <div>
                <span className="simple-label">MINING LIABILITY</span>
                <h2>Outstanding obligation</h2>
              </div>
              <CircleDollarSign size={21} />
            </div>

            <div className="simple-reward-total">
              <strong>
                ${money(data.outstanding_mining_liability_usd)}
              </strong>
              <span>
                Immutable mining liability still outstanding for {MINING_ASSET}.
              </span>
              <span>
                Total settled mining value: $
                {money(data.total_mining_reward_usd)}
              </span>
              <span>
                Total mining crypto credited: {compactCrypto(data.total_mining_reward_crypto)} {MINING_ASSET}
              </span>
            </div>

            <Link href="/wallet" className="simple-btn simple-btn--secondary">
              Open Wallet
            </Link>
          </article>
        </section>

        <section className="card simple-panel">
          <div className="simple-panel__head">
            <div>
              <span className="simple-label">CRYPTO BALANCES</span>
              <h2>Withdrawable assets</h2>
            </div>
          </div>

          {data.crypto_balances.length === 0 ? (
            <div className="simple-empty">No crypto balance yet.</div>
          ) : (
            <div className="simple-activity">
              {data.crypto_balances.map((item) => (
                <div className="simple-activity__row" key={item.asset}>
                  <div>
                    <strong>{item.asset}</strong>
                    <span>
                      Reserved {compactCrypto(item.reserved_balance)}
                    </span>
                  </div>
                  <b>{compactCrypto(item.balance)}</b>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card simple-panel">
          <div className="simple-panel__head">
            <div>
              <span className="simple-label">RECENT SETTLEMENTS</span>
              <h2>Mining settlements</h2>
            </div>
            <History size={21} />
          </div>

          {data.recent_mining_settlements.length === 0 ? (
            <div className="simple-empty">
              No mining settlement recorded yet.
            </div>
          ) : (
            <div className="simple-activity">
              {data.recent_mining_settlements.map((settlement) => (
                <div
                  className="simple-activity__row"
                  key={settlement.reference_id}
                >
                  <div>
                    <strong>
                      Settlement #{settlement.reference_id}
                    </strong>
                    <span>
                      {settlement.pool_date} ·{' '}
                      {new Date(settlement.created_at).toLocaleString('en-US')}
                    </span>
                  </div>
                  <b className="is-positive">
                    +${money(settlement.allocated_usd)} /{' '}
                    {compactCrypto(settlement.crypto_amount)} {settlement.asset}
                  </b>
                </div>
              ))}
            </div>
          )}
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
              <span className="simple-label">ENGINE</span>
              <h2>Server source of truth</h2>
            </div>
          </div>
          <div className="simple-reward-total">
            <strong>{data.engine}</strong>
            <span>
              Dashboard values are read from the Supabase control plane. No
              mining formula, pool allocation, timestamp accrual, or reward
              calculation is performed in the browser.
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
