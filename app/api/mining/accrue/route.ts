import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_ASSET = 'USDT'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  let asset = DEFAULT_ASSET

  try {
    const body = await request.json().catch(() => ({}))

    if (
      body &&
      typeof body.asset === 'string' &&
      body.asset.trim().length > 0
    ) {
      asset = body.asset.trim().toUpperCase()
    }
  } catch {
    // Safe default remains USDT.
  }

  // Compatibility route only: the authoritative settlement engine is
  // nextgen_claim_mining(). No reward formula is calculated in the API.
  const { data, error } = await supabase.rpc('nextgen_claim_mining', {
    p_asset: asset,
  })

  if (error) {
    console.error('[MiningSettlement]', error)

    return NextResponse.json(
      { error: error.message || 'MINING_SETTLEMENT_FAILED' },
      { status: error.code === '42501' ? 403 : 400 },
    )
  }

  return NextResponse.json(data)
}
