import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs"; export const dynamic="force-dynamic";
const IDS:Record<string,string>={BCH:"bitcoin-cash",BNB:"binancecoin",BTC:"bitcoin",DASH:"dash",DGB:"digibyte",DOGE:"dogecoin",ETH:"ethereum",FEY:"feyorra",LTC:"litecoin",SOL:"solana",TRX:"tron",USDC:"usd-coin",USDT:"tether",ZEC:"zcash"};
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET; if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:"Supabase service credentials are not configured"},{status:503});
 const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(Object.values(IDS).join(","))}&vs_currencies=usd`,{cache:"no-store",headers:{accept:"application/json"}});
 if(!r.ok)return NextResponse.json({error:`CoinGecko returned ${r.status}`},{status:503});
 const data=await r.json() as Record<string,{usd?:number}>; const now=new Date().toISOString();
 const rows=Object.entries(IDS).map(([asset,id])=>({asset,rate_usd:Number(data?.[id]?.usd),source:"coingecko",updated_at:now}));
 if(rows.some(x=>!Number.isFinite(x.rate_usd)||x.rate_usd<=0))return NextResponse.json({error:"Missing required market rate"},{status:503});
 const sb=createClient(url,key,{auth:{persistSession:false}}); const {error}=await sb.from("nextgen_exchange_rates").upsert(rows,{onConflict:"asset"});
 if(error)return NextResponse.json({error:"Rate database update failed"},{status:503}); return NextResponse.json({ok:true,updatedAt:now,assets:rows.map(x=>x.asset)});
}
