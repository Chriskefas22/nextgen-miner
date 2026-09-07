import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 try{
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401})
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null
  const asset=typeof body?.asset==='string'?body.asset.trim().toUpperCase():''
  const network=typeof body?.network==='string'?body.network.trim():''
  const destination=typeof body?.destination==='string'?body.destination.trim():''
  const cryptoAmount=Number(body?.cryptoAmount)
  if(!asset||!network||!destination||!Number.isFinite(cryptoAmount)||cryptoAmount<=0)return NextResponse.json({error:'INVALID_WITHDRAWAL_REQUEST'},{status:400})
  const {data,error}=await supabase.rpc('nextgen_request_crypto_withdrawal',{p_asset:asset,p_network:network,p_crypto_amount:cryptoAmount,p_destination:destination})
  if(error)return NextResponse.json({error:error.message||'WITHDRAWAL_FAILED'},{status:400})
  return NextResponse.json(data)
 }catch{ return NextResponse.json({error:'INTERNAL_SERVER_ERROR'},{status:500}) }
}
