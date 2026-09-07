import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(){
 const sb=await createClient(); const {data:{user}}=await sb.auth.getUser();
 if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const [{data:s,error:se},{data:d,error:de}]=await Promise.all([
  sb.from("nextgen_supported_crypto_assets").select("asset,display_name").order("asset"),
  sb.from("nextgen_deposit_destinations").select("id,asset,network,destination,label,warning_title,warning_message,first_deposit_note,min_deposit,confirmations_required").eq("active",true).eq("is_active",true).order("asset").order("network")
 ]);
 if(se||de)return NextResponse.json({error:"Unable to load deposit options"},{status:503});
 const names=new Map((s??[]).map(x=>[String(x.asset).toUpperCase(),String(x.display_name)]));
 const options=(d??[]).filter(x=>names.has(String(x.asset).toUpperCase())).map(x=>({id:String(x.id),asset:String(x.asset).toUpperCase(),network:String(x.network),destination:String(x.destination),label:x.label??null,warningMessage:x.warning_message??null,firstDepositNote:x.first_deposit_note??null,minDeposit:Number(x.min_deposit??.01),confirmationsRequired:Number(x.confirmations_required??0),displayName:names.get(String(x.asset).toUpperCase())}));
 return NextResponse.json({options},{headers:{"Cache-Control":"no-store"}});
}
