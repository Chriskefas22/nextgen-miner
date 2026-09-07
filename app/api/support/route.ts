import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401})
 const {data,error}=await supabase.from('nextgen_support_tickets').select('id,subject,message,status,priority,owner_note,created_at,updated_at,resolved_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50)
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({tickets:data??[]})
}
export async function POST(request:Request){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401})
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null
 const subject=typeof body?.subject==='string'?body.subject.trim():''; const message=typeof body?.message==='string'?body.message.trim():''; const priority=typeof body?.priority==='string'?body.priority.trim().toLowerCase():'normal'
 if(subject.length<5||subject.length>120||message.length<10||message.length>4000)return NextResponse.json({error:'INVALID_TICKET'},{status:400})
 const {data,error}=await supabase.rpc('nextgen_create_support_ticket',{p_subject:subject,p_message:message,p_priority:priority})
 if(error)return NextResponse.json({error:error.message||'SUPPORT_TICKET_FAILED'},{status:400}); return NextResponse.json(data)
}
