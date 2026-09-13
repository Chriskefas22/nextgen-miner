'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { MinerCard, Miner } from '@/components/miner/MinerCard'
import { createClient } from '@/lib/supabase/client'
import { diamond } from '@/lib/format'
import { accrueMining } from '@/lib/mining/accrue'

type CatalogRow = {
  id: number
  slug: string
  name: string
  tier: string
  base_hashrate: number
  base_price_diamond: number
  image_path: string
  enabled: boolean
  sort_order: number
}

type LevelRow = {
  miner_id: number
  level: number
  hashrate: number
  upgrade_price_diamond: number
  cumulative_price_diamond: number
}

type UserMinerRow = {
  id: number
  miner_id: number
  current_level: number
  total_spent_diamond: number
  status: string
  recharge_expires_at: string | null
  is_merged?: boolean
}

type Benefits = {
  active: boolean
  slug: string
  name: string
  expires_at?: string
  mining_factor: number
}

type MergeCandidate = {
  minerId: number
  minerName: string
  tier: string
  level: number
  ids: number[]
  nextHashrate: number | null
  fee: number
}

const FILTERS = ['All', 'Starter', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const
const MERGE_FEES: Record<number, number> = {
  1: 25, 2: 50, 3: 100, 4: 200, 5: 400, 6: 800, 7: 1600, 8: 3200, 9: 6400,
}

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function normalizeMinerImagePath(imagePath: string | null | undefined, slug: string) {
  if (!imagePath) return `/assets/miners/${slug}.webp`
  const cleaned = String(imagePath).trim().replace(/^\/+/, '')
  if (cleaned.startsWith('assets/miners/')) return `/${cleaned}`
  if (cleaned.startsWith('miners/')) return `/assets/${cleaned}`
  if (cleaned.endsWith('.webp')) return `/assets/miners/${cleaned}`
  return `/assets/miners/${slug}.webp`
}

export default function MinersPage() {
  const [miners, setMiners] = useState<Miner[]>([])
  const [userMiners, setUserMiners] = useState<UserMinerRow[]>([])
  const [catalog, setCatalog] = useState<CatalogRow[]>([])
  const [levels, setLevels] = useState<LevelRow[]>([])
  const [balance, setBalance] = useState(0)
  const [filter, setFilter] = useState<string>('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [benefits, setBenefits] = useState<Benefits | null>(null)
  const [rechargeExpires, setRechargeExpires] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  const loadData = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const [catalogResult, levelsResult] = await Promise.all([
        supabase
          .from('nextgen_miner_catalog')
          .select('id,slug,name,tier,base_hashrate,base_price_diamond,image_path,enabled,sort_order')
          .eq('enabled', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('nextgen_miner_levels')
          .select('miner_id,level,hashrate,upgrade_price_diamond,cumulative_price_diamond')
          .order('miner_id', { ascending: true })
          .order('level', { ascending: true }),
      ])

      if (catalogResult.error) throw catalogResult.error
      if (levelsResult.error) throw levelsResult.error

      const nextCatalog = asRows<CatalogRow>(catalogResult.data)
      const nextLevels = asRows<LevelRow>(levelsResult.data)

      let nextUserMiners: UserMinerRow[] = []
      let walletBalance = 0

      if (user) {
        const [userMinersResult, walletResult, benefitResult] = await Promise.all([
          supabase
            .from('nextgen_user_miners')
            .select('id,miner_id,current_level,total_spent_diamond,status,recharge_expires_at,is_merged')
            .eq('user_id', user.id)
            .eq('is_merged', false)
            .order('activated_at', { ascending: true }),
          supabase.from('nextgen_wallets').select('diamond_balance').eq('user_id', user.id).maybeSingle(),
          supabase.rpc('nextgen_membership_benefits'),
        ])

        if (userMinersResult.error) throw userMinersResult.error
        if (walletResult.error) throw walletResult.error

        nextUserMiners = asRows<UserMinerRow>(userMinersResult.data)
        walletBalance = Number(walletResult.data?.diamond_balance ?? 0)
        if (!benefitResult.error) setBenefits((benefitResult.data ?? null) as Benefits | null)
      }

      setCatalog(nextCatalog)
      setLevels(nextLevels)
      setUserMiners(nextUserMiners)
      setBalance(walletBalance)

      const latestExpiry = nextUserMiners
        .map((m) => m.recharge_expires_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null
      setRechargeExpires(latestExpiry)

      const levelsByMiner = new Map<number, LevelRow[]>()
      for (const level of nextLevels) {
        const arr = levelsByMiner.get(Number(level.miner_id)) ?? []
        arr.push(level)
        levelsByMiner.set(Number(level.miner_id), arr)
      }

      const ownedByMiner = new Map<number, UserMinerRow[]>()
      for (const row of nextUserMiners) {
        const arr = ownedByMiner.get(Number(row.miner_id)) ?? []
        arr.push(row)
        ownedByMiner.set(Number(row.miner_id), arr)
      }

      const mapped: Miner[] = nextCatalog.map((item) => {
        const catalogId = Number(item.id)
        const minerLevels = levelsByMiner.get(catalogId) ?? []
        const owned = ownedByMiner.get(catalogId) ?? []
        const primary = owned[0] ?? null
        const currentLevel = primary ? Number(primary.current_level) : 1
        const currentLevelRow = minerLevels.find((l) => Number(l.level) === currentLevel) ?? minerLevels[0]
        const nextLevelRow = minerLevels.find((l) => Number(l.level) === currentLevel + 1) ?? null

        return {
          catalogId,
          userMinerId: primary ? Number(primary.id) : null,
          ownedCount: owned.length,
          slug: String(item.slug ?? ''),
          name: String(item.name ?? ''),
          tier: String(item.tier ?? ''),
          image: normalizeMinerImagePath(item.image_path, String(item.slug ?? '')),
          baseHashrate: Number(item.base_hashrate ?? 0),
          purchasePrice: Number(item.base_price_diamond ?? 0),
          currentLevel,
          maxLevel: minerLevels.length ? Math.max(...minerLevels.map((l) => Number(l.level))) : 10,
          currentHashrate: Number(currentLevelRow?.hashrate ?? item.base_hashrate ?? 0),
          nextHashrate: nextLevelRow ? Number(nextLevelRow.hashrate) : null,
          nextUpgradePrice: nextLevelRow ? Number(nextLevelRow.upgrade_price_diamond) : null,
          totalSpent: owned.reduce((sum, row) => sum + Number(row.total_spent_diamond ?? 0), 0),
          owned: owned.length > 0,
          active: owned.some((row) => String(row.status).toLowerCase() === 'active'),
        }
      })

      const tierOrder = ['STARTER', 'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC']
      setMiners(mapped.sort((a, b) => {
        const ai = tierOrder.indexOf(a.tier.toUpperCase())
        const bi = tierOrder.indexOf(b.tier.toUpperCase())
        return (ai - bi) || (a.catalogId - b.catalogId)
      }))
    } catch (err) {
      console.error('[MinersPage]', err)
      setError(err instanceof Error ? err.message : 'Unable to load miner data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      try { await accrueMining('USDT') } catch (err) { console.error('[MinersMiningAccrual]', err) }
      if (!cancelled) await loadData()
    }
    void sync()
    return () => { cancelled = true }
  }, [loadData])

  const filtered = useMemo(
    () => filter === 'All' ? miners : miners.filter((m) => m.tier.toLowerCase() === filter.toLowerCase()),
    [miners, filter],
  )

  const mergeCandidates = useMemo<MergeCandidate[]>(() => {
    const grouped = new Map<string, { minerId: number; level: number; ids: number[] }>()
    for (const row of userMiners) {
      if (row.is_merged || row.status === 'merged') continue
      const key = `${row.miner_id}:${row.current_level}`
      const current = grouped.get(key) ?? { minerId: row.miner_id, level: row.current_level, ids: [] }
      current.ids.push(Number(row.id))
      grouped.set(key, current)
    }

    return [...grouped.values()]
      .filter((group) => group.ids.length >= 2 && group.level < 10)
      .map((group) => {
        const item = catalog.find((c) => Number(c.id) === group.minerId)
        const next = levels.find((l) => Number(l.miner_id) === group.minerId && Number(l.level) === group.level + 1)
        return {
          minerId: group.minerId,
          minerName: item?.name ?? `Miner #${group.minerId}`,
          tier: item?.tier ?? '',
          level: group.level,
          ids: group.ids,
          nextHashrate: next ? Number(next.hashrate) : null,
          fee: MERGE_FEES[group.level] ?? 0,
        }
      })
  }, [userMiners, catalog, levels])

  const activeCount = userMiners.filter((m) => m.status === 'active').length
  const totalHashrate = userMiners
    .filter((m) => m.status === 'active')
    .reduce((sum, row) => {
      const level = levels.find((l) => Number(l.miner_id) === Number(row.miner_id) && Number(l.level) === Number(row.current_level))
      return sum + Number(level?.hashrate ?? 0)
    }, 0)

  const expired = !rechargeExpires || new Date(rechargeExpires).getTime() <= Date.now()

  const doRecharge = async () => {
    setBusy(true)
    setActionMessage('')
    try {
      const res = await fetch('/api/mining/recharge', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(json.error ?? 'Recharge gagal.'))
      setActionMessage(json.premium ? 'Premium aktif: hashrate tidak memerlukan recharge 24 jam.' : 'Hashrate berhasil diaktifkan selama 24 jam.')
      await loadData()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Recharge gagal.')
    } finally {
      setBusy(false)
    }
  }

  const doMerge = async (candidate: MergeCandidate) => {
    setBusy(true)
    setActionMessage('')
    try {
      const supabase = createClient()
      const result = await supabase.rpc('nextgen_merge_miners', {
        p_first_user_miner_id: candidate.ids[0],
        p_second_user_miner_id: candidate.ids[1],
      })
      if (result.error) throw result.error
      setActionMessage(`${candidate.minerName} berhasil di-merge → Level ${candidate.level + 1} ✓`)
      await loadData()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Merge gagal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">SHOP / MINERS</div>
          <h1 className="page-title">Choose Your Mining Rig</h1>
          <div className="muted">12 miner families • Level 1–10 • Revenue-funded mining • Server-side economics.</div>
        </div>
        <div className="diamond-pill"><span aria-hidden="true">💎</span><b>{diamond(balance)}</b></div>
      </div>

      <div className="hero-banner">
        <div><b>NEXTGEN MINER CATALOG</b><br /><span>Starter Keyboard → Basic CPU → Entry GPU → Nuclear Reactor</span></div>
        <span>12 FAMILIES · 10 LEVELS</span>
      </div>

      <div className="glass section" style={{ marginTop: 14 }}>
        <div className="eyebrow">HASHRATE STATUS</div>
        <div className="list-row"><span className="muted">Mining status</span><b>{benefits?.active ? 'PREMIUM • AUTO ACTIVE' : expired ? 'PAUSED' : 'ACTIVE'}</b></div>
        <div className="list-row"><span className="muted">Recharge</span><b>{benefits?.active ? 'Not required' : rechargeExpires ? new Date(rechargeExpires).toLocaleString('id-ID') : 'Not active'}</b></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <button type="button" className="btn btn-primary" disabled={busy || benefits?.active || (!expired && Boolean(rechargeExpires))} onClick={() => void doRecharge()}>
            {benefits?.active ? 'Premium Hashrate Active' : expired ? 'Aktifkan Hashrate' : 'Hashrate Aktif'}
          </button>
        </div>
        {actionMessage ? <div className="muted" style={{ marginTop: 10 }}>{actionMessage}</div> : null}
      </div>

      <div className="grid grid-3" style={{ marginTop: 14 }}>
        <section className="glass stat"><label>YOUR HASHRATE</label><b>{totalHashrate.toLocaleString('en-US')} H/s</b><div className="muted">All non-merged active miners</div></section>
        <section className="glass stat"><label>ACTIVE MINERS</label><b>{activeCount}</b><div className="muted">All active instances</div></section>
        <section className="glass stat"><label>WALLET</label><b>{diamond(balance)}</b><div className="muted">Available Diamond</div></section>
      </div>

      {mergeCandidates.length > 0 ? (
        <section className="glass section" style={{ marginTop: 14 }}>
          <div className="eyebrow">MERGE CENTER</div>
          <h2>Merge two identical miners into the next level</h2>
          <p className="muted">Requires 2 unmerged miners from the same family and level. The fee is paid in Diamond and the two inputs become one next-level miner.</p>
          <div className="grid grid-2">
            {mergeCandidates.map((candidate) => (
              <div className="glass" key={`${candidate.minerId}-${candidate.level}`} style={{ padding: 14 }}>
                <div className="list-row"><span className="muted">Miner</span><b>{candidate.minerName}</b></div>
                <div className="list-row"><span className="muted">Current</span><b>Lv {candidate.level} · {candidate.ids.length} copies</b></div>
                <div className="list-row"><span className="muted">Result</span><b>Lv {candidate.level + 1} · {candidate.nextHashrate ?? 0} H/s</b></div>
                <div className="list-row"><span className="muted">Merge fee</span><b>💎 {candidate.fee.toLocaleString('en-US')}</b></div>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void doMerge(candidate)}>
                  Merge Pair
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="filters" style={{ margin: '14px 0' }}>
        {FILTERS.map((item) => <button key={item} type="button" className={`filter ${filter === item ? 'active' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}
      </div>

      {loading ? (
        <div className="glass section"><div className="eyebrow">DATABASE SYNC</div><h2>Loading miner catalog…</h2><p className="muted">Syncing all 12 families, levels and account ownership.</p></div>
      ) : error ? (
        <div className="glass section"><div className="eyebrow">SYNC ERROR</div><h2>Unable to load miner data</h2><p className="muted">{error}</p><button type="button" className="btn btn-primary" onClick={() => void loadData()}>Retry</button></div>
      ) : (
        <div className="shop-grid">{filtered.map((miner) => <MinerCard key={miner.catalogId} miner={miner} onChanged={loadData} />)}</div>
      )}
    </AppShell>
  )
}
