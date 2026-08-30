export async function verifyTurnstile(token:string){
 const secret=process.env.TURNSTILE_SECRET_KEY;
 if(!secret) return {success:true,skipped:true};
 const body=new URLSearchParams({secret,response:token});
 const res=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
 return res.json() as Promise<{success:boolean;[key:string]:unknown}>;
}
