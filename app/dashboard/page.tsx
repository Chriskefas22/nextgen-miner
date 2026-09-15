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
  rolling_10d_net_revenue_usd?: number | string
  rolling_10d_mining_release_usd?: number | string
  mining_lot_days?: number | string
  mining_allocation_bps?: number | string
  reserve_allocation_bps?: number | string
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
  { label: 'Merge', href: '/merge', icon: Boxes },
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

const pctFromBps = (value: number | string | null | undefined) =>
  `${(Number(value ?? 0) / 100).toFixed(0)}%`

export default async function Dashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

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

  const reserveBps = currentPool?.reserve_allocation_bps ?? 5000
  const miningBps = currentPool?.mining_allocation_bps ?? 2500

  return (
    <AppShell>
      <div className="simple-dashboard">
        <section className="simple-dashboard__hero">
          <div>
            <div className="eyebrow">DASHBOARD</div>
            <h1>Welcome back, {username}</h1>
            <p>Monitor your mining activity, wallet and server-settled rewards in one place.</p>
          </div>
          <div className="simple-status">
            <span className="simple-status__dot" />
            <span>{miningFunded ? 'Mining funded' : 'Awaiting funded pool'}</span>
          </div>
        </section>

        <section className="simple-balance card">
          <div>
            <span className="simple-label">DIAMOND BALANCE</span>
            <strong className="simple-balance__value"><Gem size={23} />{number(data.diamond_balance)}</strong>
            <span className="simple-muted">{Number(data.reserved_diamond) > 0 ? `${number(data.reserved_diamond)} reserved` : 'Internal utility balance • not withdrawable'}</span>
          </div>
          <Link href="/wallet" className="simple-btn simple-btn--primary">Open Wallet</Link>
        </section>

        <section className="simple-grid simple-grid--3">
          <article className="card simple-stat"><span className="simple-label">ACTIVE MINERS</span><strong>{data.active_miners}</strong><span className="simple-muted">Current server state</span></article>
          <article className="card simple-stat"><span className="simple-label">TOTAL HASHRATE</span><strong>{number(data.active_hashrate)} H/s</strong><span className="simple-muted">Weighted active miner power</span></article>
          <article className="card simple-stat"><span className="simple-label">MINING REWARD</span><strong>${money(data.today_mining_reward_usd)}</strong><span className="simple-muted">24h settled in {MINING_ASSET}</span></article>
        </section>

        <section className="simple-grid simple-grid--2">
          <article className="card simple-panel">
            <div className="simple-panel__head"><div><span className="simple-label">MINING CONTROL PLANE</span><h2>Revenue-funded pool</h2></div><Zap size={21} /></div>
            <div className="simple-mining-state">
              <div><span>Rule</span><strong>{data.economic_rule_version}</strong></div>
              <div><span>Settlement</span><strong>24 hours</strong></div>
              <div><span>Reward lots</span><strong>{number(currentPool?.mining_lot_days ?? 10)} days</strong></div>
              <div><span>Pool budget</span><strong>${money(currentPool?.mining_budget_usd)}</strong></div>
              <div><span>Allocated</span><strong>${money(currentPool?.allocated_usd)}</strong></div>
              <div><span>Reserve safety</span><strong>{number(currentPool?.reserve_safety_multiplier)}x</strong></div>
              <div><span>Reserve status</span><strong>{currentPool?.reserve_status ?? 'UNKNOWN'}</strong></div>
            </div>
            <p className="simple-muted">The pool is funded only by recognized platform revenue. Zero recognized revenue means zero newly funded mining rewards.</p>
          </article>

          <article className="card simple-panel">
            <div className="simple-panel__head"><div><span className="simple-label">10-DAY ECONOMIC WINDOW</span><h2>Rolling pool model</h2></div><CircleDollarSign size={21} /></div>
            <div className="simple-mining-state">
              <div><span>Revenue lookback</span><strong>Rolling 10 days</strong></div>
              <div><span>Rolling revenue</span><strong>${money(currentPool?.rolling_10d_net_revenue_usd)}</strong></div>
              <div><span>Rolling mining release</span><strong>${money(currentPool?.rolling_10d_mining_release_usd)}</strong></div>
              <div><span>Distribution</span><strong>Weighted active H/s</strong></div>
              <div><span>Reserve</span><strong>{pctFromBps(reserveBps)} of recognized net revenue</strong></div>
              <div><span>Mining allocation</span><strong>{pctFromBps(miningBps)} of recognized net revenue</strong></div>
              <div><span>Yield</span><strong>No guaranteed yield</strong></div>
            </div>
            <p className="simple-muted">The 10-day window smooths the economic flow; it does not lock users out of claiming eligible settled rewards.</p>
          </article>
        </section>

        <section className="card simple-panel">
          <div className="simple-panel__head"><div><span className="simple-label">DIAMOND → MINER → HASHRATE</span><h2>How your mining capacity grows</h2></div><Gem size={21} /></div>
          <div className="simple-reward-total">
            <strong>Build first. Earn over time.</strong>
            <span>Earn Diamond through supported platform activities, then use Diamond to buy, upgrade or merge miners.</span>
            <span>Miners create platform-managed H/s. Active H/s earns a share of the funded pool over time.</span>
            <span>More active network H/s can reduce reward per H/s when revenue does not grow at the same pace.</span>
            <span>Diamond, free faucet rewards and promotional miner grants do not directly create crypto liabilities.</span>
          </div>
          <Link href="/earn" className="simple-btn simple-btn--secondary">Explore Earning Activities</Link>
        </section>

        <section className="card simple-panel">
          <div className="simple-panel__head"><div><span className="simple-label">MINING LIABILITY</span><h2>Outstanding obligation</h2></div><CircleDollarSign size={21} /></div>
          <div className="simple-reward-total">
            <strong>${money(data.outstanding_mining_liability_usd)}</strong>
            <span>Outstanding mining liability for {MINING_ASSET}.</span>
            <span>Total settled mining value: ${money(data.total_mining_reward_usd)}</span>
            <span>Total mining crypto credited: {compactCrypto(data.total_mining_reward_crypto)} {MINING_ASSET}</span>
          </div>
          <Link href="/wallet" className="simple-btn simple-btn--secondary">Open Wallet</Link>
        </section>

        <section className="card simple-panel">
          <div className="simple-panel__head"><div><span className="simple-label">CRYPTO BALANCES</span><h2>Withdrawable assets</h2></div></div>
          {data.crypto_balances.length === 0 ? <div className="simple-empty">No crypto balance yet.</div> : <div className="simple-activity">{data.crypto_balances.map((item) => <div className="simple-activity__row" key={item.asset}><div><strong>{item.asset}</strong><span>Reserved {compactCrypto(item.reserved_balance)}</span></div><b>{compactCrypto(item.balance)}</b></div>)}</div>}
        </section>

        <section className="card simple-panel">
          <div className="simple-panel__head"><div><span className="simple-label">RECENT SETTLEMENTS</span><h2>Mining settlements</h2></div><History size={21} /></div>
          {data.recent_mining_settlements.length === 0 ? <div className="simple-empty">No mining settlement recorded yet.</div> : <div className="simple-activity">{data.recent_mining_settlements.map((settlement) => <div className="simple-activity__row" key={settlement.reference_id}><div><strong>Settlement #{settlement.reference_id}</strong><span>{settlement.pool_date} · {new Date(settlement.created_at).toLocaleString('en-US')}</span></div><b className="is-positive">+${money(settlement.allocated_usd)} / {compactCrypto(settlement.crypto_amount)} {settlement.asset}</b></div>)}</div>}
        </section>

        <section className="card simple-panel">
          <div className="simple-panel__head"><div><span className="simple-label">QUICK ACCESS</span><h2>What would you like to do?</h2></div></div>
          <div className="simple-actions">{quickActions.map(({ label, href, icon: Icon }) => <Link href={href} key={label} className="simple-action"><span><Icon size={19} /></span><strong>{label}</strong></Link>)}</div>
        </section>

        <section className="card simple-panel">
          <div className="simple-panel__head"><div><span className="simple-label">ENGINE</span><h2>Server source of truth</h2></div></div>
          <div className="simple-reward-total"><strong>{data.engine}</strong><span>Dashboard values are read from the Supabase control plane. No mining formula, pool allocation, timestamp accrual, or reward calculation is performed in the browser.</span></div>
        </section>
      </div>
    </AppShell>
  )
}
