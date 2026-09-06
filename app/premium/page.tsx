'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import styles from './premium.module.css'

type Plan = {
  slug: string
  name: string
  duration_days: number
  price_usd: number
  auto_recharge: boolean
  task_reward_bps: number
  mining_factor: number
  referral_bonus_bps: number
  task_limit_multiplier: number
  upgrade_discount_bps: number
  daily_bonus_diamond: number
  premium_miner_access: boolean
  priority_support: boolean
  early_access: boolean
}

type Benefits = {
  active: boolean
  slug: string
  name: string
  expires_at?: string
  auto_recharge: boolean
  task_reward_multiplier: number
  mining_factor: number
  referral_bonus_multiplier: number
  task_limit_multiplier: number
  upgrade_discount_bps: number
  daily_bonus_diamond: number
  premium_miner_access: boolean
  priority_support: boolean
  early_access: boolean
}

type Asset = { asset: string; display_name: string; withdrawal_enabled: boolean }

type Quote = { crypto_amount: number; rate_usd: number; asset_name: string; plan: { price_usd: number; duration_days: number; name: string } }

const featureText = (plan: Plan) => [
  plan.auto_recharge ? 'Hashrate tidak perlu recharge setiap 24 jam' : '',
  `Bonus task +${plan.task_reward_bps / 100}%`,
  `Mining weight ×${plan.mining_factor.toFixed(2)}`,
  `Referral bonus +${plan.referral_bonus_bps / 100}%`,
  `Batas task ×${plan.task_limit_multiplier.toFixed(2)}`,
  plan.upgrade_discount_bps ? `Diskon upgrade ${plan.upgrade_discount_bps / 100}%` : '',
  plan.daily_bonus_diamond ? `Daily bonus +${plan.daily_bonus_diamond.toLocaleString('en-US')} 💎` : '',
  plan.premium_miner_access ? 'Akses miner Premium' : '',
  plan.priority_support ? 'Priority support' : '',
  plan.early_access ? 'Early access fitur baru' : '',
].filter(Boolean)

export default function PremiumPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [benefits, setBenefits] = useState<Benefits | null>(null)
  const [selectedPlan, setSelectedPlan] = useState('premium')
  const [selectedAsset, setSelectedAsset] = useState('USDT')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    const supabase = createClient()
    setLoading(true)
    const [plansResult, assetsResult, benefitsResult] = await Promise.all([
      supabase.from('nextgen_membership_plans').select('*').eq('enabled', true).order('price_usd'),
      supabase.from('nextgen_supported_crypto_assets').select('asset,display_name,withdrawal_enabled').eq('withdrawal_enabled', true).order('asset'),
      supabase.rpc('nextgen_membership_benefits'),
    ])
    if (!plansResult.error) setPlans((plansResult.data ?? []) as Plan[])
    if (!assetsResult.error) setAssets((assetsResult.data ?? []) as Asset[])
    if (!benefitsResult.error) setBenefits((benefitsResult.data ?? null) as Benefits | null)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const activePlan = useMemo(() => plans.find((p) => p.slug === selectedPlan) ?? plans[0], [plans, selectedPlan])

  useEffect(() => {
    if (!activePlan || !selectedAsset) return
    let cancelled = false
    async function getQuote() {
      setQuote(null)
      const res = await fetch(`/api/membership/quote?plan=${encodeURIComponent(activePlan.slug)}&asset=${encodeURIComponent(selectedAsset)}`)
      const json = await res.json().catch(() => ({}))
      if (!cancelled && res.ok) setQuote(json as Quote)
    }
    void getQuote()
    return () => { cancelled = true }
  }, [activePlan, selectedAsset])

  async function purchase() {
    if (!activePlan || !selectedAsset) return
    setBusy(true); setMessage('')
    const res = await fetch('/api/membership/purchase', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: activePlan.slug, asset: selectedAsset }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const map: Record<string, string> = {
        MEMBERSHIP_ALREADY_ACTIVE: 'Membership masih aktif.',
        INSUFFICIENT_CRYPTO: 'Saldo crypto tidak mencukupi.',
        ASSET_RATE_STALE: 'Rate crypto sedang tidak fresh. Coba lagi setelah rate diperbarui.',
        ASSET_RATE_MISSING: 'Rate crypto belum tersedia.',
      }
      setMessage(map[String(json.error)] ?? String(json.error ?? 'Pembelian gagal.'))
    } else {
      setMessage(`${json.name ?? activePlan.name} aktif sampai ${new Date(json.expires_at).toLocaleString('id-ID')}.`)
      await load()
    }
    setBusy(false)
  }

  async function checkin() {
    setBusy(true); setMessage('')
    const res = await fetch('/api/daily-checkin', { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setMessage(res.ok ? `Daily check-in berhasil: +${Number(json.diamond_awarded ?? 0).toLocaleString('en-US')} 💎.` : (String(json.error ?? 'Check-in gagal.')))
    setBusy(false)
  }

  return <AppShell>
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.kicker}>NEXTGEN MEMBERSHIP</div>
        <h1 className={styles.title}>Premium Membership</h1>
        <p className={styles.copy}>Membership dibuat untuk pengguna yang ingin mining lebih nyaman dan mendapatkan benefit earning tambahan. Reward crypto tetap dibatasi oleh Reward Pool yang berasal dari revenue eligible website.</p>
      </section>

      {benefits?.active ? <section className={styles.status}>
        <strong>{benefits.name} ACTIVE</strong>
        <div className={styles.muted}>Berlaku sampai {benefits.expires_at ? new Date(benefits.expires_at).toLocaleString('id-ID') : '—'} · Mining ×{benefits.mining_factor.toFixed(2)} · Task ×{benefits.task_reward_multiplier.toFixed(2)}</div>
      </section> : null}

      <section className={styles.grid}>
        {plans.map((plan) => <article key={plan.slug} className={`${styles.card} ${benefits?.slug === plan.slug ? styles.cardActive : ''}`}>
          <div className={styles.planName}>{plan.name}</div>
          <div className={styles.price}>${plan.price_usd.toFixed(2)} <small>/ {plan.duration_days} hari</small></div>
          <ul className={styles.features}>{featureText(plan).map((feature) => <li key={feature} className={styles.feature}>✓ {feature}</li>)}</ul>
          <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => setSelectedPlan(plan.slug)}>Pilih {plan.name}</button>
        </article>)}
      </section>

      <section className={styles.status}>
        <strong>Beli Membership dengan Crypto</strong>
        <div className={styles.controls}>
          <div className={styles.field}><label>PLAN</label><select className={styles.input} value={activePlan?.slug ?? ''} onChange={(e) => setSelectedPlan(e.target.value)}>{plans.map((p) => <option key={p.slug} value={p.slug}>{p.name} · ${p.price_usd.toFixed(2)}</option>)}</select></div>
          <div className={styles.field}><label>ASSET</label><select className={styles.input} value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)}>{assets.map((a) => <option key={a.asset} value={a.asset}>{a.asset} · {a.display_name}</option>)}</select></div>
          <button className={`${styles.button} ${styles.primary}`} type="button" disabled={busy || loading || !quote} onClick={() => void purchase()}>Aktifkan Membership</button>
        </div>
        <div className={styles.muted}>
          {quote ? `Harga ${quote.plan.name}: $${quote.plan.price_usd.toFixed(2)} ≈ ${quote.crypto_amount} ${selectedAsset} pada rate $${quote.rate_usd}.` : 'Memuat quote dengan rate server-side…'}
        </div>
        {message ? <div className={styles.muted}>{message}</div> : null}
      </section>

      <section className={styles.status}>
        <strong>Daily Check-in</strong>
        <div className={styles.muted}>Free user memakai check-in sebagai aktivitas ringan untuk recharge hashrate 24 jam. Premium tetap tidak membutuhkan recharge, tetapi check-in tetap memberi bonus Diamond sesuai tier.</div>
        <div style={{marginTop:10}}><button className={`${styles.button} ${styles.secondary}`} type="button" disabled={busy} onClick={() => void checkin()}>Daily Check-in</button></div>
      </section>
    </div>
  </AppShell>
}
