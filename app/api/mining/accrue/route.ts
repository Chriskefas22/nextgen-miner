import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_ASSET = 'USDT'

export async function POST(request: Request) {
const supabase = await createClient()

const {
data: { user },
} = await supabase.auth.getUser()

if (!user) {
return NextResponse.json(
{ error: 'UNAUTHORIZED' },
{ status: 401 },
)
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
// Keep the safe default asset.
}

const { data, error } = await supabase.rpc(
'nextgen_accrue_mining',
{
p_asset: asset,
},
)

if (error) {
console.error('[MiningAccrue]', error)

return NextResponse.json(
  {
    error: error.message || 'MINING_ACCRUAL_FAILED',
  },
  { status: 400 },
)

}

return NextResponse.json(data)
}
