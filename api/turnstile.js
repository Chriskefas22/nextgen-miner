export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'method_not_allowed'});
  try{
    const {token,remoteip}=req.body||{};
    if(!token) return res.status(400).json({ok:false,error:'missing_token'});
    const secret=process.env.TURNSTILE_SECRET_KEY;
    if(!secret) return res.status(503).json({ok:false,error:'turnstile_not_configured'});
    const body=new URLSearchParams({secret,response:token});if(remoteip)body.set('remoteip',remoteip);
    const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
    const data=await r.json();return res.status(data.success?200:403).json(data);
  }catch(e){return res.status(500).json({ok:false,error:'verification_failed'});}
}
