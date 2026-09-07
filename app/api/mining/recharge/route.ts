import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await supabase.rpc('nextgen_recharge_hashrate')
  if (error) return NextResponse.json({ error: error.message || 'RECHARGE_FAILED' }, { status: 400 })
  return NextResponse.json(data)
}
