import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = await request.json().catch(() => null) as { plan?: unknown; asset?: unknown } | null
  const plan = typeof body?.plan === 'string' ? body.plan.trim().toLowerCase() : ''
  const asset = typeof body?.asset === 'string' ? body.asset.trim().toUpperCase() : ''
  if (!plan || !asset) return NextResponse.json({ error: 'INVALID_PURCHASE_REQUEST' }, { status: 400 })

  const { data, error } = await supabase.rpc('nextgen_purchase_membership', {
    p_plan_slug: plan,
    p_asset: asset,
  })
  if (error) return NextResponse.json({ error: error.message || 'MEMBERSHIP_PURCHASE_FAILED' }, { status: 400 })
  return NextResponse.json(data)
}
