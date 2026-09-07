import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const planSlug = request.nextUrl.searchParams.get('plan')?.trim().toLowerCase()
  const asset = request.nextUrl.searchParams.get('asset')?.trim().toUpperCase()
  if (!planSlug || !asset) return NextResponse.json({ error: 'INVALID_QUOTE_REQUEST' }, { status: 400 })

  const [{ data: plan, error: planError }, { data: assetRow, error: assetError }, { data: rate, error: rateError }] = await Promise.all([
    supabase.from('nextgen_membership_plans').select('slug,name,price_usd,duration_days').eq('slug', planSlug).eq('enabled', true).maybeSingle(),
    supabase.from('nextgen_supported_crypto_assets').select('asset,display_name,withdrawal_enabled').eq('asset', asset).eq('withdrawal_enabled', true).maybeSingle(),
    supabase.from('nextgen_exchange_rates').select('asset,rate_usd,updated_at').eq('asset', asset).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (planError) return NextResponse.json({ error: planError.message }, { status: 400 })
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 400 })
  if (rateError) return NextResponse.json({ error: rateError.message }, { status: 400 })
  if (!plan) return NextResponse.json({ error: 'MEMBERSHIP_PLAN_NOT_FOUND' }, { status: 404 })
  if (!assetRow) return NextResponse.json({ error: 'ASSET_NOT_SUPPORTED' }, { status: 400 })
  if (!rate || Number(rate.rate_usd) <= 0) return NextResponse.json({ error: 'ASSET_RATE_MISSING' }, { status: 400 })

  const updatedAt = new Date(rate.updated_at).getTime()
  if (Date.now() - updatedAt > 15 * 60 * 1000) return NextResponse.json({ error: 'ASSET_RATE_STALE' }, { status: 400 })

  const cryptoAmount = Number((Number(plan.price_usd) / Number(rate.rate_usd)).toFixed(18))
  return NextResponse.json({
    plan: { slug: plan.slug, name: plan.name, price_usd: Number(plan.price_usd), duration_days: Number(plan.duration_days) },
    asset: assetRow.asset,
    asset_name: assetRow.display_name,
    rate_usd: Number(rate.rate_usd),
    rate_updated_at: rate.updated_at,
    crypto_amount: cryptoAmount,
  })
}
