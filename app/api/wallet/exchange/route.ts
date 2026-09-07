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
  const cryptoAmount=Number(body?.cryptoAmount)
  if(!asset||!Number.isFinite(cryptoAmount)||cryptoAmount<=0)return NextResponse.json({error:'INVALID_EXCHANGE_REQUEST'},{status:400})
  const {data,error}=await supabase.rpc('nextgen_exchange_crypto_to_diamond',{p_asset:asset,p_crypto_amount:cryptoAmount})
  if(error)return NextResponse.json({error:error.message||'EXCHANGE_FAILED'},{status:400})
  const payload=data as Record<string,unknown>|null
  return NextResponse.json({...(payload??{}),diamondAmount:Number(payload?.diamond_amount??payload?.diamondAmount??0)})
 }catch{ return NextResponse.json({error:'INTERNAL_SERVER_ERROR'},{status:500}) }
}
