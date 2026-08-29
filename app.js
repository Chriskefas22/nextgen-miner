import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => [...root.querySelectorAll(q)];
const money = n => `$${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:6})}`;
const credit = n => `${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2})} 💎`;
const TOPUP_CREDITS_PER_USD = 1000;
const PAYOUT_CREDITS_PER_USD = 5000;
const economy = () => window.NG_ECONOMY || {topup_credits_per_usd:TOPUP_CREDITS_PER_USD,payout_credits_per_usd:PAYOUT_CREDITS_PER_USD};
const topupRate = () => Number(economy().topup_credits_per_usd || TOPUP_CREDITS_PER_USD);
const payoutRate = () => Number(economy().payout_credits_per_usd || PAYOUT_CREDITS_PER_USD);
const creditCostFromUsd = usd => Number(usd||0) * topupRate();
const payoutUsdFromCredits = c => Number(c||0) / payoutRate();
const num = n => Number(n||0).toLocaleString(undefined,{maximumFractionDigits:4});
const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let planLevels=[];
let currentUser=null;
let profile=null;
let wallet=null;
let positions=[];
let operations=null;
let fundingLimits={deposit_min:0.01,deposit_max:100000,withdrawal_min:5,withdrawal_max:100000};
let turnstileToken='';
let isAdmin=false;
let depositAddresses=[];
let exchangeRates=[];
let cryptoBalances=[];
let operationUpgrades=[];
let operationPurchases=[];
let publicActivities=[];
let liveActivityChannel=null;
let currentView='overview';

async function mountTurnstile(container, action){
  if(!container || !CONFIG.TURNSTILE_SITE_KEY) return;
  if(!window.turnstile){
    await new Promise((resolve,reject)=>{ const sc=document.createElement('script'); sc.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async=true; sc.defer=true; sc.onload=resolve; sc.onerror=reject; document.head.appendChild(sc); });
  }
  container.innerHTML='';
  window.turnstile.render(container,{sitekey:CONFIG.TURNSTILE_SITE_KEY,action,callback:t=>{turnstileToken=t;},'expired-callback':()=>{turnstileToken='';},'error-callback':()=>{turnstileToken='';}});
}
async function verifyTurnstile(){
  if(!CONFIG.TURNSTILE_SITE_KEY) throw new Error('Cloudflare Turnstile is not configured yet.');
  if(!turnstileToken) throw new Error('Please complete the anti-bot verification.');
  const r=await fetch('/api/turnstile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:turnstileToken})});
  const data=await r.json(); if(!data.success) throw new Error('Anti-bot verification failed.'); return true;
}

async function loadEconomy(){
  const {data}=await supabase.from('ng_credit_economy').select('*').eq('id',1).maybeSingle();
  if(data){ window.NG_ECONOMY=data; } else { window.NG_ECONOMY={topup_credits_per_usd:TOPUP_CREDITS_PER_USD,payout_credits_per_usd:PAYOUT_CREDITS_PER_USD}; }
}
async function loadFundingLimits(){
  const {data,error}=await supabase.from('ng_funding_limits').select('*').eq('id',1).maybeSingle();
  if(!error && data) fundingLimits=data;
}
async function loadAdminState(){
  if(!currentUser){isAdmin=false;return;}
  const {data}=await supabase.from('ng_admins').select('role').eq('user_id',currentUser.id).maybeSingle();
  isAdmin=!!data;
  const adminBtn=$('#adminConsoleBtn');
  if(adminBtn) adminBtn.classList.toggle('hidden',!isAdmin);
}
async function loadDepositAddresses(){
  const {data}=await supabase.from('ng_deposit_addresses').select('*').eq('active',true).order('asset').order('network');
  depositAddresses=data||[];
}
async function loadExchange(){
  if(!currentUser) return;
  const [{data:r},{data:b}]=await Promise.all([
    supabase.from('ng_exchange_rates').select('*').eq('active',true).order('asset'),
    supabase.from('ng_crypto_balances').select('*').eq('user_id',currentUser.id).order('asset')
  ]);
  exchangeRates=r||[]; cryptoBalances=b||[];
}
async function loadOperations(){
  if(!currentUser)return;
  const [{data:u},{data:p}]=await Promise.all([
    supabase.from('ng_operation_upgrades').select('*').eq('active',true).order('operation_type').order('level'),
    supabase.from('ng_operation_purchases').select('operation_type,level').eq('user_id',currentUser.id).order('operation_type').order('level')
  ]);
  operationUpgrades=u||[]; operationPurchases=p||[];
}

async function recordLoginIp(){
  try{
    const r=await fetch('/api/client-ip'); const data=await r.json();
    if(data.ip) await supabase.rpc('ng_record_security_event',{p_ip:data.ip,p_user_agent:navigator.userAgent,p_event_type:'login'});
  }catch(e){console.warn('IP audit unavailable',e.message);}
}

async function loadPlans(){
  const {data,error}=await supabase.from('ng_plan_levels').select('*').order('plan_slug').order('level');
  if(error){ console.error(error); return; }
  planLevels=data||[];
  renderPlans(); renderSelectors(); renderTable();
}
function family(slug){ return planLevels.filter(x=>x.plan_slug===slug); }
const FAMILY_META={starter:{name:'Coal',tag:'Foundation',bonus:'+0%'},explorer:{name:'Copper',tag:'Efficient',bonus:'+10%'},pro:{name:'Iron',tag:'Industrial',bonus:'+20%'},elite:{name:'Silver',tag:'Advanced',bonus:'+30%'},legend:{name:'Gold',tag:'Ultimate',bonus:'+40%'}};
function familyMeta(slug){ return FAMILY_META[slug]||{name:slug,tag:'Mining',bonus:'+0%'}; }
function tierForLevel(level){ if(level<=10)return {key:'common',label:'Common'}; if(level<=20)return {key:'uncommon',label:'Uncommon'}; if(level<=30)return {key:'rare',label:'Rare'}; if(level<=40)return {key:'epic',label:'Epic'}; return {key:'legendary',label:'Legendary'}; }
function families(){ return [...new Map(planLevels.map(x=>[x.plan_slug,{slug:x.plan_slug,name:familyMeta(x.plan_slug).name}])).values()]; }
function renderPlans(){
  const grid=$('#planGrid'); if(!grid) return;
  const palette={starter:'cyan',explorer:'blue',pro:'violet',elite:'pink',legend:'gold'};
  grid.innerHTML=families().map(f=>{const lvl=family(f.slug)[0];const l50=family(f.slug)[49];return `<article class="plan-card ${palette[f.slug]||'cyan'}"><div class="plan-badge">${esc(f.name)}</div><div class="plan-core">NG<span>CORE</span></div><div class="plan-level">LEVEL 1 → 50</div><div class="plan-metrics"><div><small>Start from</small><strong>${money(lvl.min_investment)}</strong></div><div><small>Level 50</small><strong>${money(l50.min_investment)}</strong></div></div><button class="primary-btn full plan-choose" data-plan="${f.slug}">Inspect Levels</button></article>`}).join('');
  $$('.plan-choose').forEach(b=>b.onclick=()=>{ $('#levelFamily').value=b.dataset.plan; renderTable(); $('#levels').scrollIntoView({behavior:'smooth'}); });
}
function renderSelectors(){
  const lf=$('#levelFamily'), ls=$('#levelSelect'); if(!lf) return;
  lf.innerHTML=families().map(f=>`<option value="${f.slug}">${esc(f.name)}</option>`).join('');
  ls.innerHTML=Array.from({length:50},(_,i)=>`<option value="${i+1}">Level ${i+1}</option>`).join('');
  lf.onchange=()=>{renderTable(); renderSelected();}; ls.onchange=renderSelected; renderSelected();
}
function renderSelected(){
  const rec=family($('#levelFamily')?.value||families()[0]?.slug)[Number($('#levelSelect')?.value||1)-1]; if(!rec) return;
  $('#selectedRig').innerHTML=`<div class="selected-icon"><img src="${minerArt(rec.plan_slug,rec.level,false)}" alt="${esc(familyMeta(rec.plan_slug).name)} Miner Level ${rec.level}" style="width:100%;height:100%;object-fit:contain;border-radius:14px"></div><div><strong>${esc(familyMeta(rec.plan_slug).name)} • Level ${rec.level} · ${tierForLevel(Number(rec.level)).label}</strong><p>Price ${credit(creditCostFromUsd(rec.min_investment))} · ${money(rec.min_investment)} USD · ${num(rec.hash_power_gh)} GH/s</p></div><div class="selected-earn"><span>${credit(rec.hourly_output*topupRate())}/h</span><span>${credit(rec.daily_output*topupRate())}/d</span><span>${credit(rec.monthly_output*topupRate())}/mo</span></div>`;
}
function renderTable(){
  const slug=$('#levelFamily')?.value||families()[0]?.slug; const rows=family(slug).filter((_,i)=>i%5===0||i===49);
  $('#levelTable').innerHTML=rows.map(r=>`<tr><td>${r.level}</td><td>${credit(creditCostFromUsd(r.min_investment))}<br><small>${money(r.min_investment)}</small></td><td>${num(r.hash_power_gh)} GH/s</td><td>${credit(r.hourly_output*TOPUP_CREDITS_PER_USD)}</td><td>${credit(r.daily_output*TOPUP_CREDITS_PER_USD)}</td><td>${credit(r.monthly_output*TOPUP_CREDITS_PER_USD)}</td></tr>`).join(''); renderSelected();
}

function openModal(id){ $('#'+id)?.classList.remove('hidden'); }
function closeModals(){ $$('.modal').forEach(m=>m.classList.add('hidden')); }
function authMarkup(mode){
  if(mode==='signup') return `<form id="signupForm" class="auth-form"><div class="modal-title"><div class="eyebrow">JOIN THE GRID</div><h2>Create your account</h2><p>Launch your mining workspace in minutes.</p></div><input name="username" placeholder="Username" minlength="3" maxlength="24" required><input name="email" type="email" placeholder="Email address" required><input name="password" type="password" placeholder="Password" minlength="8" required><input name="confirm" type="password" placeholder="Confirm password" minlength="8" required><input name="referral" placeholder="Referral code (optional)"><label class="check"><input type="checkbox" name="terms" required><span>I agree to the <a href="#terms" id="openTermsFromAuth">Terms & Conditions</a></span></label><div class="turnstile-placeholder"><span>◌</span> Cloudflare Turnstile <small>Protected action</small></div><button class="primary-btn full" type="submit">Create Account</button><p class="auth-note" id="authMsg"></p></form>`;
  return `<form id="loginForm" class="auth-form"><div class="modal-title"><div class="eyebrow">WELCOME BACK</div><h2>Login</h2><p>Access your mining command center.</p></div><input name="email" type="email" placeholder="Email address" required><input name="password" type="password" placeholder="Password" required><div class="row-between"><label class="check"><input type="checkbox" name="remember"><span>Remember me</span></label><button class="link-btn" type="button" id="resetBtn">Forgot password?</button></div><div class="turnstile-placeholder"><span>◌</span> Cloudflare Turnstile <small>Protected action</small></div><button class="primary-btn full" type="submit">Login</button><p class="auth-note" id="authMsg"></p></form>`;
}
function showAuth(mode='login'){ $('.auth-tab[data-auth="login"]').classList.toggle('active',mode==='login'); $('.auth-tab[data-auth="signup"]').classList.toggle('active',mode==='signup'); $('#authContent').innerHTML=authMarkup(mode); $('#authModal').classList.remove('hidden'); bindAuthForm(mode); }
function bindAuthForm(mode){
  mountTurnstile($('.turnstile-placeholder'),'auth_'+mode).catch(console.warn);
  if(mode==='signup'){
    $('#signupForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const msg=$('#authMsg');if(f.get('password')!==f.get('confirm')){msg.textContent='Passwords do not match.';return;}try{await verifyTurnstile();}catch(err){msg.textContent=err.message;return;}msg.textContent='Creating account…';const {data,error}=await supabase.auth.signUp({email:f.get('email'),password:f.get('password'),options:{data:{username:f.get('username'),referral_code:f.get('referral')}}});if(error){msg.textContent=error.message;return;}msg.textContent=data.session?'Account created.':'Account created — check your email if verification is enabled.';if(data.session){currentUser=data.user;await enterDashboard();}}
    $('#openTermsFromAuth')?.addEventListener('click',e=>{e.preventDefault();closeModals();openModal('termsModal');});
  }else{
    $('#loginForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const msg=$('#authMsg');try{await verifyTurnstile();}catch(err){msg.textContent=err.message;return;}msg.textContent='Signing in…';const {data,error}=await supabase.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error){msg.textContent=error.message;return;}currentUser=data.user;closeModals();await enterDashboard();};
    $('#resetBtn').onclick=async()=>{const email=prompt('Enter your account email:');if(!email)return;const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin});$('#authMsg').textContent=error?error.message:'Password reset email sent.';};
  }
}

async function loadAccount(){
  if(!currentUser) return;
  const [{data:p},{data:w},{data:pos},{data:ops}]=await Promise.all([
    supabase.from('ng_profiles').select('*').eq('id',currentUser.id).maybeSingle(),
    supabase.from('ng_wallets').select('*').eq('user_id',currentUser.id).maybeSingle(),
    supabase.from('ng_mining_positions').select('*').eq('user_id',currentUser.id).eq('active',true).order('started_at',{ascending:false}),
    supabase.rpc('ng_account_operations')
  ]);
  profile=p;wallet=w;positions=pos||[];operations=ops||null;
}
async function syncMining(){
  if(!currentUser)return; const {error}=await supabase.rpc('ng_sync_earnings'); if(error) console.warn(error.message); await loadAccount(); renderDashboard('overview');
}
async function activate(plan,level){
  const {data,error}=await supabase.rpc('ng_activate_miner',{p_plan:plan,p_level:Number(level)});if(error){alert(error.message);return;}await loadAccount();renderDashboard('miners');alert(`Mining position activated: ${plan.toUpperCase()} · Level ${level}. Cost is charged in Credit at 1,000 💎 per $1 plan price.`);
}
async function requestWithdraw(asset,network,amount,dest){if(Number(amount)<Number(fundingLimits.withdrawal_min)||Number(amount)>Number(fundingLimits.withdrawal_max)){alert(`Withdrawal must be between ${money(fundingLimits.withdrawal_min)} and ${money(fundingLimits.withdrawal_max)}.`);return;}const {data,error}=await supabase.rpc('ng_request_withdrawal',{p_asset:asset,p_network:network,p_usd_amount:Number(amount),p_destination:dest});if(error){alert(error.message);return;}await loadAccount();renderDashboard('withdraw');alert('Withdrawal request submitted for review.');}

function activityRows(rows){
  return rows.map(x=>{
    const label=x.activity_type==='deposit'?'DEPOSIT':'PAYOUT';
    const icon=x.activity_type==='deposit'?'↓':'↑';
    const source='<span class="pill verified-pill">VERIFIED</span>';
    return `<div class="live-activity-row"><div class="live-activity-icon ${x.activity_type}">${icon}</div><div class="live-activity-main"><strong>${esc(x.display_name)}</strong><span>${label} · ${esc(x.asset)}${x.network?` · ${esc(x.network)}`:''}</span></div><div class="live-activity-amount">${money(x.amount_usd)}<small>${source} · ${new Date(x.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div></div>`;
  }).join('');
}
async function loadPublicActivity(){
  const {data}=await supabase.from('ng_public_activity').select('id,activity_type,asset,network,amount_usd,display_name,status,source,created_at').eq('source','verified').order('created_at',{ascending:false}).limit(18);
  publicActivities=data||[];
  const realMarkup=publicActivities.length?activityRows(publicActivities):'<div class="empty">No verified deposits or payouts yet.</div>';
  const realEl=$('#verifiedActivityList'); if(realEl) realEl.innerHTML=realMarkup;
  const publicRealEl=$('#publicVerifiedActivityList'); if(publicRealEl) publicRealEl.innerHTML=realMarkup;
}
function startLiveActivity(){
  if(liveActivityChannel) return;
  loadPublicActivity();
  liveActivityChannel=supabase.channel('public:activity-feed').on('postgres_changes',{event:'INSERT',schema:'public',table:'ng_public_activity'},payload=>{
    const row=payload.new;
    if(row.source!=='verified') return;
    publicActivities=[row,...publicActivities].slice(0,18);
    const markup=activityRows(publicActivities); const el=$('#verifiedActivityList'); if(el) el.innerHTML=markup; const publicEl=$('#publicVerifiedActivityList'); if(publicEl) publicEl.innerHTML=markup;
  }).subscribe();
}
async function stopLiveActivity(){
  if(liveActivityChannel){await supabase.removeChannel(liveActivityChannel);liveActivityChannel=null;}
}
async function renderAnnouncements(){
  const el=$('#announcementStrip'); if(!el||!currentUser)return;
  const {data}=await supabase.from('ng_announcements').select('title,message,audience,starts_at,expires_at').eq('active',true).or(`audience.eq.all,user_id.eq.${currentUser.id}`).order('created_at',{ascending:false}).limit(5);
  const now=Date.now(); const rows=(data||[]).filter(a=>new Date(a.starts_at).getTime()<=now && (!a.expires_at || new Date(a.expires_at).getTime()>now));
  el.innerHTML=rows.length?rows.map(a=>`<div class="announcement"><strong>${esc(a.title)}</strong><span>${esc(a.message)}</span></div>`).join(''):`<div class="muted">No active announcements.</div>`;
}
function dashboardOverview(){
  const active=positions.length; const hash=positions.reduce((s,p)=>s+Number(p.hash_power_gh),0); const hourly=positions.reduce((s,p)=>s+Number(p.hourly_output),0);
  const op=operations||{resources:0,resource_capacity:50000,workers:0,worker_capacity:1000,transport:0,transport_capacity:10000};
  return `<div id="announcementStrip" class="glass-card announcement-strip">Loading announcements…</div><div class="stat-grid"><div class="stat-card"><small>Available Credit</small><strong>${credit(wallet?.credit_balance)}</strong><span>$${(Number(wallet?.credit_balance||0)/topupRate()).toFixed(2)} top-up value</span></div><div class="stat-card"><small>Active Miners</small><strong>${active}</strong><span>online positions</span></div><div class="stat-card"><small>Total Hash Power</small><strong>${num(hash)}</strong><span>GH/s</span></div><div class="stat-card"><small>Projected Hourly</small><strong>${credit(hourly*topupRate())}</strong><span>mining credits</span></div></div><article class="glass-card dash-panel operations-panel"><div class="panel-head"><div><div class="eyebrow">MINING OPERATIONS</div><h3>Resource · Workers · Transport</h3></div><span class="status-dot">SYNCED</span></div><div class="ops-grid"><div class="op-card"><small>Resources</small><strong>${num(op.resources)} / ${num(op.resource_capacity)}</strong><div class="op-bar"><i style="width:${Math.min(100,(Number(op.resources)/Number(op.resource_capacity))*100)}%"></i></div><span>Ore inventory</span></div><div class="op-card"><small>Workers</small><strong>${num(op.workers)} / ${num(op.worker_capacity)}</strong><div class="op-bar"><i style="width:${Math.min(100,(Number(op.workers)/Number(op.worker_capacity))*100)}%"></i></div><span>Active workforce</span></div><div class="op-card"><small>Transport</small><strong>${num(op.transport)} / ${num(op.transport_capacity)}</strong><div class="op-bar"><i style="width:${Math.min(100,(Number(op.transport)/Number(op.transport_capacity))*100)}%"></i></div><span>Logistics capacity</span></div></div><p class="muted">Operations are derived from active mining positions. Resource generation, worker capacity, and transport capacity are tracked server-side.</p></article><div class="dash-grid two"><article class="glass-card dash-panel"><div class="panel-head"><h3>Mining Pulse</h3><span class="status-dot">Live</span></div><div class="pulse"><div><small>Hourly</small><strong>${credit(hourly*topupRate())}</strong></div><div><small>Daily</small><strong>${credit(hourly*24*topupRate())}</strong></div><div><small>Monthly</small><strong>${credit(hourly*24*30*topupRate())}</strong></div></div><div class="chart"><i style="height:30%"></i><i style="height:48%"></i><i style="height:42%"></i><i style="height:68%"></i><i style="height:58%"></i><i style="height:85%"></i><i style="height:72%"></i><i style="height:96%"></i></div></article><article class="glass-card dash-panel"><div class="panel-head"><h3>Quick Actions</h3></div><div class="quick-grid"><button class="primary-btn" data-view="plans-view">Buy Miner</button><button class="ghost-btn" data-view="deposit">Deposit</button><button class="ghost-btn" data-view="withdraw">Withdraw</button><button class="ghost-btn" data-view="exchange">Exchange</button><button class="ghost-btn" data-view="referral">Referral</button></div></article></div><article class="glass-card dash-panel"><div class="panel-head"><h3>Recent Miners</h3><button class="link-btn" data-view="miners">View all →</button></div>${positions.length?positions.slice(0,5).map(positionRow).join(''):`<div class="empty">No active miners yet. Choose a rig family and activate your first level.</div>`}</article><article class="glass-card dash-panel live-activity-panel"><div class="panel-head"><div><div class="eyebrow">PUBLIC ACTIVITY</div><h3>Live Deposits & Payouts</h3><p class="muted">Verified events use privacy-safe aliases; no user names or wallet addresses are exposed.</p></div><span class="status-dot">LIVE</span></div><div class="live-activity-columns single-live"><div><div class="subhead"><strong>Verified Live Activity</strong><span class="pill verified-pill">REAL DATA</span></div><div id="verifiedActivityList" class="live-activity-list"><div class="empty">Loading live activity…</div></div></div></div></article>`;}
function positionRow(p){return `<div class="list-row"><div><strong>${esc(p.plan_slug.toUpperCase())}</strong><span>Level ${p.level}</span></div><div><small>Hash</small><b>${num(p.hash_power_gh)} GH/s</b></div><div><small>Hourly</small><b>${credit(Number(p.hourly_output)*topupRate())}</b></div><div><span class="pill">ACTIVE</span></div></div>`}
function minersView(){return `<div class="page-head"><div><div class="eyebrow">YOUR ACTIVE GRID</div><h3>My Miners</h3></div><button class="primary-btn" data-view="plans-view">Add Miner</button></div><div class="glass-card dash-panel">${positions.length?positions.map(positionRow).join(''):`<div class="empty">No miners currently active.</div>`}</div>`}
function minerArt(slug, level, locked=false, size='card'){const t=tierForLevel(Number(level));const meta=familyMeta(slug);const src=`assets/miners/${slug}_level_${String(Number(level)).padStart(2,'0')}.svg`;return `<img class="miner-art-image ${locked?'is-locked':''}" src="${src}" alt="${esc(meta.name)} Miner ${esc(t.label)} Level ${level}" loading="lazy">`; }
function plansView(){
  return `<div class="page-head"><div><div class="eyebrow">MINER HANGAR</div><h3>Choose Your Miner</h3><p class="muted">Five families × 50 levels. Any level can be purchased when your available Credit covers its price. Each family has its own miner artwork from Common to Legendary.</p></div><div class="balance-badge">${credit(wallet?.credit_balance)} available</div></div><div class="welcome-bonus"><div class="welcome-gift">🎁</div><div><strong>Welcome Bonus: 1,000 💎</strong><span>New members receive 1,000 Credit on their first successful registration.</span></div></div><div class="miner-shop-grid">${families().map(f=>{const levels=family(f.slug);const activeLevels=positions.filter(p=>p.plan_slug===f.slug).map(p=>Number(p.level));const activeMax=activeLevels.length?Math.max(...activeLevels):0;const meta=familyMeta(f.slug);return `<section class="miner-shop-family"><div class="miner-shop-family-head"><div><div class="eyebrow">${esc(meta.name)} FAMILY · ${esc(meta.tag)}</div><h4>Levels 1–50 · ${esc(meta.bonus)} family bonus</h4></div><span>${activeLevels.length} active</span></div><div class="tier-strip">${[['common','Common','1–10'],['uncommon','Uncommon','11–20'],['rare','Rare','21–30'],['epic','Epic','31–40'],['legendary','Legendary','41–50']].map(([k,l,r])=>`<div class="tier-mini tier-${k}"><img src="assets/miners/${f.slug}_${k}.svg" alt="${esc(meta.name)} ${l}"><div><b>${l}</b><small>Lv ${r}</small></div></div>`).join('')}</div><div class="miner-level-grid">${levels.map(rec=>{const tier=tierForLevel(Number(rec.level));const active=activeLevels.includes(Number(rec.level));const availableToBuy=!active;const locked=!active;return `<article class="miner-level-card ${active?'owned':'locked'} ${availableToBuy&&!active?'buyable':''}" data-level-card="${f.slug}:${rec.level}"><div class="miner-level-top"><span>LEVEL ${rec.level}</span>${active?'<b>ACTIVE</b>':availableToBuy?'<b class="next-badge">NEXT</b>':'<b class="lock-badge">LOCKED</b>'}</div><div class="miner-tier-label tier-${tier.key}">${tier.label}</div><div class="miner-art-wrap">${minerArt(f.slug,Number(rec.level),locked)}</div><div class="miner-level-stats"><strong>${num(rec.hash_power_gh)} GH/s</strong><span>${credit(Number(rec.hourly_output)*topupRate())} / h</span><span>${credit(Number(rec.daily_output)*topupRate())} / day</span><span>${credit(Number(rec.monthly_output)*topupRate())} / month</span></div><div class="miner-price"><strong>${creditCostFromUsd(rec.min_investment).toLocaleString()} 💎</strong><small>${money(rec.min_investment)}</small></div><button class="primary-btn full activate" data-plan="${f.slug}" data-level="${rec.level}" ${active?'disabled':''}>${active?'Active':'Buy Level '+rec.level}</button><small class="lock-hint">${active?'Mining active': 'Purchase level when your available Credit is sufficient'}</small></article>`}).join('')}</div><div class="family-summary"><span>${esc(meta.name)} · Active to Level <strong>${activeMax||0}</strong> / 50</span><span>Progression: Common → Uncommon → Rare → Epic → Legendary</span></div></section>`}).join('')}</div><article class="glass-card dash-panel payout-guide"><div><strong>Credit economy</strong><span>1 USD deposit = 1,000 💎 · 5,000 💎 = $1 payout</span></div><div><strong>New member</strong><span>+1,000 💎 welcome bonus credited once at registration</span></div></article>`;
}
function formatRefreshTime(value){ if(!value) return '—'; const d=new Date(value); return Number.isNaN(d.getTime())?'—':d.toLocaleString(); }

function depositView(){const assets=[...new Set(depositAddresses.map(x=>`${x.asset} · ${x.network}`))];return `<div class="page-head"><div><div class="eyebrow">ADD FUNDS</div><h3>Deposit</h3><p class="muted">Allowed USD range: ${money(fundingLimits.deposit_min)} – ${money(fundingLimits.deposit_max)} · manual review</p></div></div><div class="dash-grid two"><article class="glass-card dash-panel"><h3>Deposit destination</h3>${depositAddresses.length?`<div class="asset-grid">${depositAddresses.map(a=>`<button class="asset dep-address" data-id="${a.id}" data-address="${esc(a.destination)}" data-asset="${esc(a.asset)}" data-network="${esc(a.network)}" data-provider="${esc(a.provider)}" data-label="${esc(a.label||'')}" data-min="${esc(a.min_deposit??'')}" data-confirmations="${esc(a.confirmations_required??'')}" data-network-fee="${esc(a.network_fee??'')}" data-warning-title="${esc(a.warning_title||'')}" data-warning-message="${esc(a.warning_message||'')}" data-first-note="${esc(a.first_deposit_note||'')}" data-qr="${esc(a.qr_code_path||'')}" data-checked="${esc(a.confirmation_last_checked_at||'')}" data-next-refresh="${esc(a.confirmation_next_refresh_at||'')}">${esc(a.asset)} · ${esc(a.network)}</button>`).join('')}</div><div class="deposit-box"><div class="deposit-destination-card"><div class="deposit-qr-wrap"><img id="depositQR" class="deposit-qr" src="" alt="Deposit QR code"></div><div class="deposit-destination-copy"><small id="depositProvider" class="eyebrow"></small><h4 id="depositAssetTitle">Select a destination</h4><div class="deposit-address-code" id="depositAddress">Select a configured destination.</div><button class="ghost-btn" id="copyDeposit">Copy address</button></div></div><div class="deposit-warning" id="depositWarning"></div><div class="deposit-meta-grid"><div><span>MIN DEPOSIT</span><strong id="depositMin">—</strong></div><div><span>CONFIRMATIONS</span><strong id="depositConfirmations">—</strong></div><div><span>NETWORK FEE</span><strong id="depositFee">—</strong></div></div><div class="deposit-refresh"><span>POLICY CHECK</span><strong id="depositChecked">—</strong><span>NEXT REFRESH</span><strong id="depositNextRefresh">—</strong></div><p id="depositFirstNote" class="muted deposit-first-note"></p></div>`:`<div class="empty">No deposit destinations are active yet. The owner can add FaucetPay or manual destinations from the admin console.</div>`}</article><article class="glass-card dash-panel"><h3>Submit deposit for approval</h3><form id="depositForm" class="stack-form"><select name="destination_id" ${depositAddresses.length?'':'disabled'}><option value="">Select destination</option>${depositAddresses.map(a=>`<option value="${a.id}">${esc(a.asset)} · ${esc(a.network)} · ${esc(a.provider)}</option>`).join('')}</select><input name="asset" placeholder="Asset (BNB / BTC / LTC / TRX…)" required><input name="network" placeholder="Network" required><input name="amount" type="number" step="0.01" min="0.01" max="100000" placeholder="USD deposit value" required><input name="crypto_amount" type="number" step="0.000000001" min="0.000000001" placeholder="Crypto amount sent" required><input name="tx" placeholder="Transaction hash / payment reference" required><button class="primary-btn full" ${depositAddresses.length?'':'disabled'}>Submit for Owner Review</button><p class="muted">Approved deposits credit <strong>1,000 💎 per $1</strong>. The balance is added only after owner/admin approval.</p></form></article></div>`}
function withdrawView(){const assets=exchangeRates.length?exchangeRates:['USDT','BTC','LTC','TRX','DOGE','ETH'].map(asset=>({asset,network:''}));return `<div class="page-head"><div><div class="eyebrow">SEND FUNDS</div><h3>Withdraw</h3><p class="muted">Range: ${money(fundingLimits.withdrawal_min)} – ${money(fundingLimits.withdrawal_max)} · manual approval</p></div><div class="balance-badge">Available ${credit(wallet?.credit_balance)}</div></div><div class="dash-grid two"><article class="glass-card dash-panel"><h3>Withdrawal Request</h3><form id="withdrawForm" class="stack-form"><select name="asset">${assets.map(a=>`<option value="${esc(a.asset)}" data-network="${esc(a.network||'')}">${esc(a.symbol||a.asset)}${a.network?' · '+esc(a.network):''}</option>`).join('')}</select><input name="network" placeholder="Network" required><input name="amount" type="number" min="5" max="100000" step="0.01" placeholder="USD withdrawal amount" required><input name="destination" placeholder="Destination wallet address" minlength="8" required><label class="check"><input type="checkbox" required><span>I confirm the destination is correct.</span></label><div class="turnstile-placeholder"><span>◌</span> Cloudflare Turnstile <small>Protected action</small></div><button class="primary-btn full">Request Withdrawal</button><p class="muted" id="withdrawPreview">$5 = 25,000 💎 minimum · $100,000 = 500,000,000 💎 maximum · Manual approval enabled.</p></form></article><article class="glass-card dash-panel"><h3>Withdrawal Rules</h3><ul class="rules"><li>Requests are reviewed before processing.</li><li>Network and address must match the selected asset.</li><li>Withdrawals are reserved in Credit while pending.</li><li>Approve sends the request to completion; reject releases the reserved Credit.</li></ul></article></div>`}

function operationView(type){
  const meta={
    resources:{title:'Resources',icon:'⛏',value:operations?.resources||0,capacity:operations?.resource_capacity||1000,unit:'ore units',desc:'Storage, extraction and material capacity for your mining empire.'},
    workers:{title:'Workers',icon:'◉',value:operations?.workers||0,capacity:operations?.worker_capacity||1,unit:'workers',desc:'Workforce capacity that determines how many mining operations can be actively managed.'},
    transport:{title:'Transport',icon:'▣',value:operations?.transport||0,capacity:operations?.transport_capacity||100,unit:'transport units',desc:'Logistics capacity for moving mined material through your operation.'}
  }[type];
  const rows=operationUpgrades.filter(x=>x.operation_type===type).map(u=>{
    const owned=operationPurchases.some(p=>p.operation_type===type&&Number(p.level)===Number(u.level));
    const prevOK=u.level===1||operationPurchases.some(p=>p.operation_type===type&&Number(p.level)===Number(u.level)-1);
    const art=`assets/operations/${type}_level_${String(Number(u.level)).padStart(2,'0')}.svg`;
    const tier=Number(u.level)<=10?'Common':Number(u.level)<=20?'Uncommon':Number(u.level)<=30?'Rare':Number(u.level)<=40?'Epic':'Legendary';
    return `<div class="upgrade-row ${owned?'owned':''} ${prevOK&&!owned?'next-upgrade':''}"><img class="operation-upgrade-art" src="${art}" alt="${esc(meta.title)} Level ${u.level}" loading="lazy"><div class="upgrade-level"><span>LEVEL ${u.level}</span><small>${tier} · +${Number(u.capacity_bonus).toLocaleString()} capacity</small></div><div><strong>${Number(u.credit_cost).toLocaleString()} 💎</strong><small>${owned?'Owned':prevOK?'Next upgrade':'Locked — complete Level '+(u.level-1)}</small></div><button class="primary-btn small op-upgrade" data-operation="${type}" data-level="${u.level}" ${owned||!prevOK?'disabled':''}>${owned?'Owned':prevOK?'Upgrade':'Locked'}</button></div>`
  }).join('');
  const art1=`assets/operations/${type}_level_01.svg`, art50=`assets/operations/${type}_level_50.svg`;
  return `<div class="page-head"><div><div class="eyebrow">OPERATIONS MODULE</div><h3>${meta.title}</h3><p class="muted">${meta.desc}</p></div><div class="balance-badge">${credit(wallet?.credit_balance)} available</div></div><article class="glass-card dash-panel infra-hero"><div class="infra-showcase"><img src="${art1}" alt="${esc(meta.title)} Level 1"><div><div class="eyebrow">LEVEL 1 → LEVEL 50</div><h3>${meta.icon} ${meta.title} Progression</h3><p class="muted">Build from Common infrastructure to Legendary infrastructure. Every level has its own capacity, cost and artwork.</p></div><img src="${art50}" alt="${esc(meta.title)} Level 50"></div><div class="panel-head"><div><strong>Current capacity</strong><span class="muted">${num(meta.value)} / ${num(meta.capacity)} ${meta.unit}</span></div><span class="status-dot">SERVER SYNCED</span></div><div class="op-bar big"><i style="width:${Math.min(100,Number(meta.capacity)?Number(meta.value)/Number(meta.capacity)*100:0)}%"></i></div></article><article class="glass-card dash-panel"><div class="panel-head"><div><h3>${meta.title} Upgrades · Levels 1–50</h3><span class="muted">Common → Uncommon → Rare → Epic → Legendary</span></div></div><div class="upgrade-list">${rows||'<div class="empty">Upgrade catalog is loading…</div>'}</div></article>`;
}

function exchangeView(){
  const rows=exchangeRates.map(r=>{const b=cryptoBalances.find(x=>x.asset===r.asset); return `<div class="list-row"><div><strong>${esc(r.symbol)}</strong><span>${esc(r.network)}</span></div><div><small>Rate</small><b>${money(r.usd_rate)}</b></div><div><small>Your balance</small><b>${Number(b?.balance||0).toLocaleString(undefined,{maximumFractionDigits:12})} ${esc(r.symbol)}</b></div><div><span class="pill">Fee ${(Number(r.fee_bps)/100).toFixed(2)}%</span></div></div>`}).join('');
  return `<div class="page-head"><div><div class="eyebrow">CONVERSION HUB</div><h3>Credit ↔ Crypto Exchange</h3><p class="muted"><strong>Top-up rate:</strong> 1 USD = ${num(topupRate())} 💎 &nbsp;·&nbsp; <strong>Payout rate:</strong> ${num(payoutRate())} 💎 = 1 USD</p></div><div class="balance-badge">Credit ${credit(wallet?.credit_balance)}</div></div>
  <div class="dash-grid two"><article class="glass-card dash-panel"><h3>Credit → Crypto</h3><p class="muted">Uses the payout rate: your Credit is valued at ${num(payoutRate())} 💎 = $1 before the asset fee.</p><form id="creditToCryptoForm" class="stack-form"><select name="asset">${exchangeRates.map(r=>`<option value="${r.asset}">${esc(r.symbol)} · ${money(r.usd_rate)}</option>`).join('')}</select><input name="amount" type="number" min="1" step="1" placeholder="Credit amount" required><button class="primary-btn full">Convert to Crypto</button><p class="muted" id="ctcPreview">Enter Credit to preview the crypto amount.</p></form></article>
  <article class="glass-card dash-panel"><h3>Crypto → Credit</h3><p class="muted">Uses the top-up rate: $1 of crypto value becomes ${num(topupRate())} 💎 before the asset fee.</p><form id="cryptoToCreditForm" class="stack-form"><select name="asset">${exchangeRates.map(r=>`<option value="${r.asset}">${esc(r.symbol)} · ${money(r.usd_rate)}</option>`).join('')}</select><input name="amount" type="number" min="0.000000001" step="0.000000001" placeholder="Crypto amount" required><button class="primary-btn full">Convert to Credit</button><p class="muted" id="ctcPreview2">Enter crypto to preview the Credit amount.</p></form></article></div>
  <article class="glass-card dash-panel"><div class="panel-head"><h3>Supported Assets & Balances</h3><span class="status-dot">CONFIGURED</span></div>${rows||'<div class="empty">No exchange assets configured yet.</div>'}</article>`;
}

async function bindExchange(){
  const updateCtcPreview=()=>{const f=$('#creditToCryptoForm');if(!f)return;const amount=Number(new FormData(f).get('amount')||0);const asset=new FormData(f).get('asset');const rate=exchangeRates.find(r=>r.asset===asset);const el=$('#ctcPreview');if(!el||!rate||amount<=0){if(el)el.textContent=`Enter Credit to preview the crypto amount.`;return;}const fee=(Number(rate.fee_bps)/10000);const usd=amount/payoutRate();const out=(usd*(1-fee))/Number(rate.usd_rate);el.textContent=`≈ ${out.toLocaleString(undefined,{maximumFractionDigits:12})} ${rate.symbol} before blockchain withdrawal fees.`;};
  const updateCtc2Preview=()=>{const f=$('#cryptoToCreditForm');if(!f)return;const amount=Number(new FormData(f).get('amount')||0);const asset=new FormData(f).get('asset');const rate=exchangeRates.find(r=>r.asset===asset);const el=$('#ctcPreview2');if(!el||!rate||amount<=0){if(el)el.textContent=`Enter crypto to preview the Credit amount.`;return;}const fee=(Number(rate.fee_bps)/10000);const out=amount*Number(rate.usd_rate)*(1-fee)*topupRate();el.textContent=`≈ ${credit(out)} after the exchange fee.`;};
  $('#creditToCryptoForm')?.querySelector('[name=amount]')?.addEventListener('input',updateCtcPreview); $('#creditToCryptoForm')?.querySelector('[name=asset]')?.addEventListener('change',updateCtcPreview);
  $('#cryptoToCreditForm')?.querySelector('[name=amount]')?.addEventListener('input',updateCtc2Preview); $('#cryptoToCreditForm')?.querySelector('[name=asset]')?.addEventListener('change',updateCtc2Preview);
  $('#creditToCryptoForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const {error,data}=await supabase.rpc('ng_exchange_credit_to_crypto',{p_asset:f.get('asset'),p_credit_amount:Number(f.get('amount'))});if(error){alert(error.message);return;}await loadAccount();await loadExchange();renderDashboard('exchange');alert(`Converted to ${f.get('asset')}. Crypto received: ${Number(data.crypto_amount||0).toLocaleString(undefined,{maximumFractionDigits:12})}`);});
  $('#cryptoToCreditForm')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);const {error,data}=await supabase.rpc('ng_exchange_crypto_to_credit',{p_asset:f.get('asset'),p_crypto_amount:Number(f.get('amount'))});if(error){alert(error.message);return;}await loadAccount();await loadExchange();renderDashboard('exchange');alert(`Converted to Credit: ${credit(data.credit_amount||0)}`);});
}

function transactionsView(){return `<div class="page-head"><div><div class="eyebrow">LEDGER</div><h3>Transactions</h3></div></div><div class="glass-card dash-panel"><div id="txList" class="tx-list">Loading…</div></div>`}
function referralView(){const code=profile?.referral_code||'NG-XXXX';return `<div class="page-head"><div><div class="eyebrow">GROW THE NETWORK</div><h3>Referral</h3></div></div><div class="dash-grid two"><article class="glass-card dash-panel"><h3>Your referral code</h3><div class="ref-code">${esc(code)}</div><button class="primary-btn" id="copyRef">Copy Code</button></article><article class="glass-card dash-panel"><h3>Referral model</h3><p class="muted">Invite users with your code. Commission rules are configurable in the production admin layer and should only be enabled after compliance review.</p></article></div>`}
function supportView(){return `<div class="page-head"><div><div class="eyebrow">HELP DESK</div><h3>Support</h3></div></div><div class="glass-card dash-panel"><div class="support-grid"><a href="mailto:support@example.com" class="support-item"><strong>Email</strong><span>support@example.com</span></a><button class="support-item"><strong>Security</strong><span>Review sessions & account access</span></button><button class="support-item" id="openDashTerms"><strong>Terms</strong><span>Open platform conditions</span></button></div></div>`}
async function renderTransactions(){const {data}=await supabase.from('ng_transactions').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(25);$('#txList').innerHTML=(data||[]).length?(data||[]).map(t=>{const delta=Number(t.credit_delta||0);return `<div class="tx-row"><div><strong>${esc(String(t.tx_type||'transaction').replaceAll('_',' '))}</strong><span>${new Date(t.created_at).toLocaleString()}</span></div><b class="${delta<0?'negative':'positive'}">${delta<0?'-':''}${credit(Math.abs(delta))}</b><small class="tx-usd">≈ ${money(Math.abs(Number(t.usd_delta||delta/topupRate())))} USD</small><span class="pill">POSTED</span></div>`}).join(''):`<div class="empty">No transactions yet.</div>`;}

function renderDashboard(view='overview'){
  currentView=view;
  $('#dashView').innerHTML={overview:dashboardOverview,miners:minersView,'plans-view':plansView,resources:()=>operationView('resources'),workers:()=>operationView('workers'),transport:()=>operationView('transport'),deposit:depositView,withdraw:withdrawView,exchange:exchangeView,transactions:transactionsView,referral:referralView,support:supportView,admin:adminView}[view]?.()||dashboardOverview();
  document.body.dataset.ngView=view;
  if(view==='exchange') bindExchange();
  $$('.side-link').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $$('#dashView [data-view], #dashView .dash-level, #dashView .activate').forEach(el=>{
    if(el.classList.contains('dash-level')) el.onchange=()=>{const l=family(el.dataset.plan)[Number(el.value)-1];$('#current-'+el.dataset.plan).textContent=`${money(l.min_investment)} · ${num(l.hash_power_gh)} GH/s`;el.closest('.plan-card').querySelector('.activate').dataset.level=el.value;el.closest('.plan-card').querySelector('.activate').textContent=`Activate Level ${el.value}`};
    else if(el.classList.contains('activate')) el.onclick=()=>activate(el.dataset.plan,el.dataset.level); else el.onclick=()=>renderDashboard(el.dataset.view);
  });
  if(view==='resources'||view==='workers'||view==='transport'){
    $$('[data-operation]','#dashView').forEach(b=>b.onclick=async()=>{const {error}=await supabase.rpc('ng_purchase_operation_upgrade',{p_operation_type:b.dataset.operation,p_level:Number(b.dataset.level)});if(error){alert(error.message);return;}await loadOperations();await loadAccount();renderDashboard(view);});
  }
  if(view==='deposit'){ $$('.dep-address').forEach(b=>b.onclick=()=>{ const set=(id,v)=>{const el=$(id);if(el)el.textContent=v??''}; set('#depositAddress',b.dataset.address); set('#depositProvider',`${b.dataset.provider||'Manual'} · ${b.dataset.asset||''}`); set('#depositAssetTitle',b.dataset.label||`${b.dataset.asset||''} Deposit`); set('#depositMin',b.dataset.min?`${b.dataset.min} ${b.dataset.asset||''}`:'—'); set('#depositConfirmations',b.dataset.confirmations||'—'); set('#depositFee',b.dataset.networkFee!==''?String(b.dataset.networkFee||'0'):'—'); set('#depositChecked',formatRefreshTime(b.dataset.checked)); set('#depositNextRefresh',formatRefreshTime(b.dataset.nextRefresh)); set('#depositFirstNote',b.dataset.firstNote||''); const warn=$('#depositWarning'); if(warn){warn.innerHTML=b.dataset.warningMessage?`<strong>${esc(b.dataset.warningTitle||'Important')}</strong><span>${esc(b.dataset.warningMessage)}</span>`:''; warn.style.display=b.dataset.warningMessage?'grid':'none';} const qr=$('#depositQR'); if(qr)qr.src=b.dataset.qr||''; const sel=$('select[name=destination_id]'); if(sel)sel.value=b.dataset.id; const af=$('input[name=asset]'); const nf=$('input[name=network]'); if(af)af.value=b.dataset.asset||''; if(nf)nf.value=b.dataset.network||''; }); $('#copyDeposit').onclick=()=>navigator.clipboard?.writeText($('#depositAddress').textContent); $('#depositForm').onsubmit=submitDeposit; }
  if(view==='admin') renderAdmin();
  if(view==='withdraw'){ mountTurnstile($('.turnstile-placeholder'),'withdraw').catch(console.warn); const assetSel=$('#withdrawForm select[name=asset]'); const net=$('#withdrawForm input[name=network]'); const amount=$('#withdrawForm input[name=amount]'); const preview=$('#withdrawPreview'); const setNet=()=>{const opt=assetSel?.selectedOptions?.[0]; if(opt&&opt.dataset.network&&net) net.value=opt.dataset.network;}; const setPreview=()=>{const usd=Number(amount?.value||0); if(preview) preview.textContent=`${usd?usd.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'0.00'} USD = ${(usd*payoutRate()).toLocaleString(undefined,{maximumFractionDigits:2})} 💎 Credit required. Minimum $${Number(fundingLimits.withdrawal_min).toFixed(2)}, maximum $${Number(fundingLimits.withdrawal_max).toLocaleString()}.`;}; assetSel?.addEventListener('change',()=>{setNet();setPreview();}); amount?.addEventListener('input',setPreview); setNet(); setPreview(); $('#withdrawForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await verifyTurnstile();}catch(err){alert(err.message);return;}await requestWithdraw(f.get('asset'),f.get('network'),f.get('amount'),f.get('destination'));}; }
  if(view==='transactions') renderTransactions();
  if(view==='overview') renderAnnouncements();
  if(view==='referral') $('#copyRef').onclick=()=>navigator.clipboard?.writeText(profile?.referral_code||'');
  if(view==='support') $('#openDashTerms').onclick=()=>openModal('termsModal');
}
async function submitDeposit(e){e.preventDefault();const f=new FormData(e.target);const amount=Number(f.get('amount'));const cryptoAmount=Number(f.get('crypto_amount'));if(amount<Number(fundingLimits.deposit_min)||amount>Number(fundingLimits.deposit_max)){alert(`Deposit must be between ${money(fundingLimits.deposit_min)} and ${money(fundingLimits.deposit_max)}.`);return;}if(!(cryptoAmount>0)){alert('Enter the crypto amount actually sent.');return;}const {error}=await supabase.rpc('ng_submit_deposit',{p_asset:f.get('asset'),p_network:f.get('network'),p_amount:cryptoAmount,p_usd_amount:amount,p_tx_hash:f.get('tx'),p_destination_id:f.get('destination_id')?Number(f.get('destination_id')):null});if(error){alert(error.message);return;}alert('Deposit submitted. Waiting for owner/admin approval.');e.target.reset();}

async function adminData(){
  const [users,deps,wds,adds,anns,security]=await Promise.all([
    supabase.from('ng_profiles').select('id,username,email,account_status,last_ip,last_seen_at,created_at').order('created_at',{ascending:false}).limit(100),
    supabase.from('ng_deposits').select('*').eq('status','pending').order('created_at',{ascending:false}).limit(100),
    supabase.from('ng_withdrawals').select('*').eq('status','pending').order('created_at',{ascending:false}).limit(100),
    supabase.from('ng_deposit_addresses').select('*').order('active',{ascending:false}).order('asset'),
    supabase.from('ng_announcements').select('*').order('created_at',{ascending:false}).limit(50),
    supabase.rpc('ng_admin_security_snapshot')
  ]);
  return {users:users.data||[],deps:deps.data||[],wds:wds.data||[],adds:adds.data||[],anns:anns.data||[],security:security.data||{users:[],security_events:[],audit_logs:[]}};
}
function adminView(){if(!isAdmin)return `<div class="glass-card dash-panel"><h3>Admin access required</h3><p class="muted">This area is restricted to the owner/admin role.</p></div>`;return `<div class="page-head"><div><div class="eyebrow">OWNER CONTROL</div><h3>Admin Console</h3><p class="muted">Approve deposits/withdrawals, manage users, payment destinations, announcements, and security monitoring.</p></div></div><div class="admin-grid"><article class="glass-card dash-panel"><h3>Pending Deposits</h3><div id="adminDeposits" class="admin-list">Loading…</div></article><article class="glass-card dash-panel"><h3>Pending Withdrawals</h3><div id="adminWithdrawals" class="admin-list">Loading…</div></article><article class="glass-card dash-panel"><h3>Users</h3><div id="adminUsers" class="admin-list">Loading…</div></article><article class="glass-card dash-panel"><h3>Security Center</h3><div id="adminSecurity" class="admin-list">Loading…</div></article><article class="glass-card dash-panel"><h3>Deposit Destinations</h3><form id="addressForm" class="stack-form"><input name="asset" placeholder="BTC / LTC / TRX / DOGE / ETH / USDT…" required><input name="network" placeholder="Network" required><select name="provider"><option value="manual">Manual</option><option value="faucetpay">FaucetPay</option></select><input name="destination" placeholder="Wallet / deposit destination" required><button class="primary-btn full">Add Destination</button></form><div id="adminAddresses" class="admin-list" style="margin-top:12px">Loading…</div></article><article class="glass-card dash-panel"><h3>Announcements</h3><form id="announcementForm" class="stack-form"><input name="title" placeholder="Announcement title" required><textarea name="message" placeholder="Message" rows="4" required></textarea><select name="audience"><option value="all">All members</option><option value="personal">Personal</option></select><input name="user_id" placeholder="User ID for personal announcement"><button class="primary-btn full">Publish Announcement</button></form><div id="adminAnnouncements" class="admin-list" style="margin-top:12px">Loading…</div></article><article class="glass-card dash-panel"><h3>Credit Economy</h3><p class="muted">Top-up: <strong>${num(topupRate())} 💎 = $1</strong> purchase value · Payout: <strong>${num(payoutRate())} 💎 = $1</strong> withdrawal value.</p><div class="admin-row"><div><strong>Top-up ratio</strong><span>1 USD → ${num(topupRate())} 💎</span></div><span class="pill">BUY</span></div><div class="admin-row"><div><strong>Payout ratio</strong><span>${num(payoutRate())} 💎 → 1 USD</span></div><span class="pill">SELL</span></div></article><article class="glass-card dash-panel"><h3>Exchange Rates</h3><form id="rateForm" class="stack-form"><select name="asset">${exchangeRates.map(r=>`<option value="${esc(r.asset)}">${esc(r.symbol)} · ${esc(r.network)}</option>`).join('')}</select><input name="usd_rate" type="number" min="0.00000001" step="0.00000001" placeholder="USD rate" required><input name="fee_bps" type="number" min="0" max="5000" step="1" placeholder="Fee bps (100 = 1%)" required><button class="primary-btn full">Save Exchange Rate</button></form><div id="adminRates" class="admin-list" style="margin-top:12px">Loading…</div></article><article class="glass-card dash-panel"><h3>Security note</h3><p class="muted">Risk scoring uses shared IP and device-signature signals. It is a review aid, not an automatic accusation. Passwords are never displayed or stored in plaintext; use Supabase Auth password reset for account recovery.</p></article></div>`}
async function renderAdmin(){
  const d=await adminData();
  $('#adminDeposits').innerHTML=d.deps.length?d.deps.map(x=>`<div class="admin-row"><div><strong>${esc(x.asset)} · ${esc(x.network)}</strong><span>User ${esc(x.user_id)} · ${money(x.amount_usd)}</span><small>${new Date(x.created_at).toLocaleString()}</small></div><div class="admin-actions"><button class="primary-btn small" data-ad-approve="${x.id}">Approve</button><button class="danger-btn small" data-ad-reject="${x.id}">Reject</button></div></div>`).join(''):`<div class="empty">No pending deposits.</div>`;
  $('#adminWithdrawals').innerHTML=d.wds.length?d.wds.map(x=>`<div class="admin-row"><div><strong>${esc(x.asset)} · ${esc(x.network)} · ${money(x.amount_usd)}</strong><span>User ${esc(x.user_id)}</span><small>${esc(x.destination)} · ${new Date(x.created_at).toLocaleString()}</small></div><div class="admin-actions"><button class="primary-btn small" data-aw-approve="${x.id}">Approve</button><button class="danger-btn small" data-aw-reject="${x.id}">Reject</button></div></div>`).join(''):`<div class="empty">No pending withdrawals.</div>`;
  $('#adminUsers').innerHTML=d.users.map(x=>`<div class="admin-row"><div><strong>${esc(x.username||'—')}</strong><span>${esc(x.email||'—')} · ${esc(x.account_status)}</span><small>IP: ${esc(x.last_ip||'—')} · Last seen: ${x.last_seen_at?new Date(x.last_seen_at).toLocaleString():'—'}</small></div><div class="admin-actions">${x.account_status==='suspended'?`<button class="primary-btn small" data-user-status="${x.id}" data-status="active">Reactivate</button>`:`<button class="danger-btn small" data-user-status="${x.id}" data-status="suspended">Suspend</button>`}</div></div>`).join('')||`<div class="empty">No users.</div>`;
  const ru=d.security.users||[]; $('#adminSecurity').innerHTML=ru.length?ru.slice(0,80).map(x=>`<div class="admin-row"><div><strong>${esc(x.username||'—')} <span class="risk-badge risk-${esc(x.risk_level||'normal')}">${esc(x.risk_level||'normal').toUpperCase()} · ${Number(x.risk_score||0)}</span></strong><span>${esc(x.email||'—')} · IP ${esc(x.last_ip||'—')}</span><small>Reasons: ${esc((x.reasons||[]).join(', ')||'none')} · ${x.last_seen_at?new Date(x.last_seen_at).toLocaleString():'never'}</small></div><div class="admin-actions"><button class="ghost-btn small" data-risk-review="${x.id}" data-reviewed="true">Mark Reviewed</button></div></div>`).join(''):`<div class="empty">No risk records.</div>`;
  $('#adminAddresses').innerHTML=d.adds.map(x=>`<div class="admin-row"><div><strong>${esc(x.asset)} · ${esc(x.network)}</strong><span>${esc(x.provider)} · ${esc(x.destination)}</span></div><div>${x.active?'<span class="pill">ACTIVE</span>':'<span class="pill">OFF</span>'}</div></div>`).join('')||`<div class="empty">No destinations.</div>`;
  $('#adminAnnouncements').innerHTML=d.anns.map(x=>`<div class="admin-row"><div><strong>${esc(x.title)}</strong><span>${esc(x.audience)} · ${x.active?'active':'inactive'}</span><small>${esc(x.message)}</small></div></div>`).join('')||`<div class="empty">No announcements.</div>`;
  $('#adminRates').innerHTML=exchangeRates.map(r=>`<div class="admin-row"><div><strong>${esc(r.symbol)} · ${esc(r.network)}</strong><span>${money(r.usd_rate)} / asset · ${(Number(r.fee_bps)/100).toFixed(2)}% fee</span></div><div><span class="pill">${esc(r.rate_source)}</span></div></div>`).join('')||`<div class="empty">No exchange rates.</div>`;
  $$('#adminDeposits [data-ad-approve]').forEach(b=>b.onclick=async()=>{const {error}=await supabase.rpc('ng_approve_deposit',{p_deposit_id:Number(b.dataset.adApprove),p_note:'Approved by owner'});if(error)alert(error.message);else renderAdmin();});
  $$('#adminDeposits [data-ad-reject]').forEach(b=>b.onclick=async()=>{const note=prompt('Rejection note:')??'';const {error}=await supabase.rpc('ng_reject_deposit',{p_deposit_id:Number(b.dataset.adReject),p_note:note});if(error)alert(error.message);else renderAdmin();});
  $$('#adminWithdrawals [data-aw-approve]').forEach(b=>b.onclick=async()=>{const {error}=await supabase.rpc('ng_approve_withdrawal',{p_withdrawal_id:Number(b.dataset.awApprove),p_note:'Approved by owner'});if(error)alert(error.message);else renderAdmin();});
  $$('#adminWithdrawals [data-aw-reject]').forEach(b=>b.onclick=async()=>{const note=prompt('Rejection note:')??'';const {error}=await supabase.rpc('ng_reject_withdrawal',{p_withdrawal_id:Number(b.dataset.awReject),p_note:note});if(error)alert(error.message);else renderAdmin();});
  $$('[data-user-status]').forEach(b=>b.onclick=async()=>{const reason=b.dataset.status==='suspended'?prompt('Suspension reason:')||'Owner action':null;const {error}=await supabase.rpc('ng_set_user_status',{p_user_id:b.dataset.userStatus,p_status:b.dataset.status,p_reason:reason});if(error)alert(error.message);else renderAdmin();});
  $$('[data-risk-review]').forEach(b=>b.onclick=async()=>{const note=prompt('Review note:')??'';const {error}=await supabase.rpc('ng_admin_review_risk',{p_user_id:b.dataset.riskReview,p_reviewed:b.dataset.reviewed==='true',p_note:note});if(error)alert(error.message);else renderAdmin();});
  $('#addressForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabase.rpc('ng_admin_upsert_destination',{p_asset:String(f.get('asset')),p_network:String(f.get('network')),p_provider:String(f.get('provider')||'Manual'),p_destination:String(f.get('destination')),p_label:String(f.get('asset')),p_active:true});if(error)alert(error.message);else{await loadDepositAddresses();e.target.reset();renderAdmin();}};
  $('#announcementForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const audience=f.get('audience'); const {error}=await supabase.rpc('ng_admin_announce',{p_title:f.get('title'),p_message:f.get('message'),p_is_global:audience==='all',p_user_id:audience==='personal'?(f.get('user_id')||null):null});if(error)alert(error.message);else{e.target.reset();renderAdmin();}};
  $('#rateForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await supabase.rpc('ng_admin_set_exchange_rate',{p_asset:String(f.get('asset')),p_rate_usd:Number(f.get('usd_rate')),p_source:'owner_manual'});if(error)alert(error.message);else{await loadExchange();renderAdmin();}};
}

async function enterDashboard(){
  await loadFundingLimits();
  await loadDepositAddresses();
  await loadExchange();
  await loadOperations();
  await loadAccount();
  await loadAdminState();
  if(profile?.account_status==='suspended'){alert('This account is suspended by the owner/admin.');await supabase.auth.signOut();leaveDashboard();return;}
  await recordLoginIp();
  $('#publicApp').classList.add('hidden');$('.footer').classList.add('hidden');$('#dashboardApp').classList.remove('hidden');
  $('#userLabel').textContent=profile?.username||currentUser.email?.split('@')[0]||'Miner';$('#userChip').textContent=(profile?.username||'NG').slice(0,2).toUpperCase();
  renderDashboard('overview');
  startLiveActivity();
}
async function leaveDashboard(){await stopLiveActivity();currentUser=null;profile=null;wallet=null;positions=[];$('#dashboardApp').classList.add('hidden');$('#publicApp').classList.remove('hidden');$('.footer').classList.remove('hidden');}

$$('.modal-close').forEach(b=>b.onclick=()=>$('#'+b.dataset.close)?.classList.add('hidden'));
$$('.modal-backdrop').forEach(b=>b.onclick=closeModals);
$$('.auth-tab').forEach(b=>b.onclick=()=>showAuth(b.dataset.auth));
$('#loginBtn').onclick=()=>showAuth('login');$('#createBtn').onclick=()=>showAuth('signup');$('#heroCreate').onclick=()=>showAuth('signup');$('#termsBtn').onclick=()=>openModal('termsModal');
$('#logoutBtn').onclick=async()=>{await supabase.auth.signOut();leaveDashboard();};
$('#refreshBtn').onclick=syncMining;
document.addEventListener('change',e=>{const s=e.target.closest('.dash-level');if(!s)return;const plan=s.dataset.plan;const level=Number(s.value);const rec=family(plan)[level-1];const card=s.closest('.plan-card');if(rec&&card){card.querySelector('.plan-current').textContent=`${credit(creditCostFromUsd(rec.min_investment))} · ${money(rec.min_investment)} USD · ${num(rec.hash_power_gh)} GH/s · ${credit(rec.hourly_output*topupRate())}/h`;const btn=card.querySelector('.activate');btn.dataset.level=level;btn.textContent=`Activate Level ${level}`;}});
$$('.side-link').forEach(b=>{if(b.id!=='logoutBtn')b.onclick=()=>renderDashboard(b.dataset.view)});
window.addEventListener('hashchange',()=>{});
supabase.auth.onAuthStateChange(async(_event,session)=>{if(session?.user&&!currentUser){currentUser=session.user;await enterDashboard();}});

document.body.dataset.ngView='home';
await loadEconomy();
await loadPlans();
startLiveActivity();
// Refresh deposit confirmation policy metadata every hour from Supabase.
setInterval(async()=>{
  try{
    await loadDepositAddresses();
    if(typeof currentView!=='undefined' && currentView==='deposit' && $('#dashView')) renderDashboard('deposit');
  }catch(e){ console.warn('Deposit policy refresh unavailable',e.message); }
}, 60*60*1000);
const {data:{session}}=await supabase.auth.getSession();
if(session?.user){currentUser=session.user;await enterDashboard();}
