'use client'

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { MinerCard, Miner } from '@/components/miner/MinerCard';
import { createClient } from '@/lib/supabase/client';
import { diamond } from '@/lib/format';
import { accrueMining } from '@/lib/mining/accrue';

type CatalogRow={id:number;slug:string;name:string;tier:string;base_hashrate:number;base_price_diamond:number;image_path:string;enabled:boolean;sort_order:number};
type LevelRow={miner_id:number;level:number;hashrate:number;upgrade_price_diamond:number;cumulative_price_diamond:number};
type UserMinerRow={id:number;miner_id:number;current_level:number;total_spent_diamond:number;status:string;recharge_expires_at:string|null};
type Benefits={active:boolean;slug:string;name:string;expires_at?:string;mining_factor:number};

const FILTERS=['All','Common','Uncommon','Rare','Epic','Legendary','Mythic','Premium','Omega+'] as const;
function asRows<T>(value:unknown):T[]{return Array.isArray(value)?value as T[]:[]}
function normalizeMinerImagePath(imagePath:string|null|undefined,slug:string){const fallback=`/assets/miners/${slug}.svg`;if(!imagePath)return fallback;const cleaned=String(imagePath).trim().replace(/^\/+/, '');if(cleaned.startsWith('assets/miners/'))return `/${cleaned}`;if(cleaned.startsWith('miners/'))return `/assets/${cleaned}`;if(cleaned.endsWith('.webp'))return `/assets/miners/${cleaned}`;return fallback}

export default function MinersPage(){
 const [miners,setMiners]=useState<Miner[]>([]),[balance,setBalance]=useState(0),[filter,setFilter]=useState<string>('All'),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [benefits,setBenefits]=useState<Benefits|null>(null),[rechargeExpires,setRechargeExpires]=useState<string|null>(null),[recharging,setRecharging]=useState(false),[actionMessage,setActionMessage]=useState('');
 const loadData=useCallback(async()=>{const supabase=createClient();setLoading(true);setError('');try{
   const {data:{user}}=await supabase.auth.getUser();
   const [catalogResult,levelsResult]=await Promise.all([
     supabase.from('nextgen_miner_catalog').select('id,slug,name,tier,base_hashrate,base_price_diamond,image_path,enabled,sort_order').eq('enabled',true).order('sort_order',{ascending:true}),
     supabase.from('nextgen_miner_levels').select('miner_id,level,hashrate,upgrade_price_diamond,cumulative_price_diamond').order('miner_id',{ascending:true}).order('level',{ascending:true})
   ]);
   if(catalogResult.error)throw catalogResult.error;if(levelsResult.error)throw levelsResult.error;
   const catalog=asRows<CatalogRow>(catalogResult.data);const levels=asRows<LevelRow>(levelsResult.data);
   let userMiners:UserMinerRow[]=[];let walletBalance=0;
   if(user){const [userMinersResult,walletResult,benefitResult]=await Promise.all([
     supabase.from('nextgen_user_miners').select('id,miner_id,current_level,total_spent_diamond,status,recharge_expires_at').eq('user_id',user.id),
     supabase.from('nextgen_wallets').select('diamond_balance').eq('user_id',user.id).maybeSingle(),
     supabase.rpc('nextgen_membership_benefits')
   ]);if(userMinersResult.error)throw userMinersResult.error;if(walletResult.error)throw walletResult.error;userMiners=asRows<UserMinerRow>(userMinersResult.data);walletBalance=Number(walletResult.data?.diamond_balance??0);if(!benefitResult.error)setBenefits((benefitResult.data??null) as Benefits|null)}
   setRechargeExpires(userMiners.length?userMiners.map(m=>m.recharge_expires_at).filter(Boolean).sort()[userMiners.map(m=>m.recharge_expires_at).filter(Boolean).length-1]??null:null);
   setBalance(walletBalance);
   const levelsByMiner=new Map<number,LevelRow[]>();for(const level of levels){const arr=levelsByMiner.get(Number(level.miner_id))??[];arr.push(level);levelsByMiner.set(Number(level.miner_id),arr)}
   const ownedByMiner=new Map<number,UserMinerRow>();for(const userMiner of userMiners)ownedByMiner.set(Number(userMiner.miner_id),userMiner);
   const mapped:Miner[]=catalog.map((item)=>{const catalogId=Number(item.id);const slug=String(item.slug??'');const lower=`${slug} ${item.name}`.toLowerCase();if(slug==='starter-keyboard'||lower.includes('starter keyboard'))return null as never;const minerLevels=levelsByMiner.get(catalogId)??[];const owned=ownedByMiner.get(catalogId);const currentLevel=owned?Number(owned.current_level):1;const currentLevelRow=minerLevels.find(l=>Number(l.level)===currentLevel)??minerLevels[0];const nextLevelRow=minerLevels.find(l=>Number(l.level)===currentLevel+1)??null;const maxLevel=minerLevels.length?Math.max(...minerLevels.map(l=>Number(l.level))):10;return {catalogId,userMinerId:owned?Number(owned.id):null,slug,name:String(item.name??''),tier:String(item.tier??''),image:normalizeMinerImagePath(item.image_path,slug),baseHashrate:Number(item.base_hashrate??0),purchasePrice:Number(item.base_price_diamond??0),currentLevel,maxLevel,currentHashrate:Number(currentLevelRow?.hashrate??item.base_hashrate??0),nextHashrate:nextLevelRow?Number(nextLevelRow.hashrate):null,nextUpgradePrice:nextLevelRow?Number(nextLevelRow.upgrade_price_diamond):null,totalSpent:Number(owned?.total_spent_diamond??0),owned:Boolean(owned),active:Boolean(owned&&String(owned.status).toLowerCase()==='active')} }).filter(Boolean) as Miner[];
   setMiners(mapped.sort((a,b)=>{const order=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','MYTHIC','PREMIUM','OMEGA+'];return order.indexOf(a.tier.toUpperCase())-order.indexOf(b.tier.toUpperCase())||a.catalogId-b.catalogId}));
 }catch(err){console.error('[MinersPage]',err);setError(err instanceof Error?err.message:'Unable to load miner data')}finally{setLoading(false)}},[]);
 useEffect(() => {
  let cancelled = false;

  const syncMining = async () => {
    try {
      await accrueMining('USDT');
    } catch (error) {
      // Mining accrual is non-fatal for the UI.
      // A zero-funded pool must not prevent the miner shop from loading.
      console.error('[MinersMiningAccrual]', error);
    }

    if (!cancelled) {
      await loadData();
    }
  };

  void syncMining();

  return () => {
    cancelled = true;
  };
}, [loadData]);
 const filtered=useMemo(()=>filter==='All'?miners:miners.filter(m=>m.tier.toLowerCase()===filter.toLowerCase()),[miners,filter]);
 const activeMiners=miners.filter(m=>m.owned&&m.active).length;const totalHashrate=miners.reduce((t,m)=>t+(m.owned&&m.active?Number(m.currentHashrate):0),0);
 const expired=!rechargeExpires||new Date(rechargeExpires).getTime()<=Date.now();
 const doRecharge=async()=>{setRecharging(true);setActionMessage('');try{const res=await fetch('/api/mining/recharge',{method:'POST'});const json=await res.json().catch(()=>({}));if(!res.ok){setActionMessage(String(json.error??'Recharge gagal.'));return}setActionMessage(json.premium?'Premium aktif: hashrate tidak memerlukan recharge 24 jam.':'Hashrate berhasil diaktifkan selama 24 jam.');await loadData()}finally{setRecharging(false)}};
 const doCheckin=async()=>{setRecharging(true);setActionMessage('');try{const res=await fetch('/api/daily-checkin',{method:'POST'});const json=await res.json().catch(()=>({}));setActionMessage(res.ok?`Daily check-in berhasil: +${Number(json.diamond_awarded??0).toLocaleString('en-US')} 💎.`:String(json.error??'Check-in gagal.'));if(res.ok)await loadData()}finally{setRecharging(false)}};
 return <AppShell><div className="page-head"><div><div className="eyebrow">SHOP / MINERS</div><h1 className="page-title">Choose Your Mining Rig</h1><div className="muted">Core collection from Basic CPU to Quantum Rig, plus premium late-game hardware.</div></div><div className="diamond-pill"><span aria-hidden="true">💎</span><b>{diamond(balance)}</b></div></div>
   <div className="hero-banner"><div><b>NEXTGEN MINER CATALOG</b><br/><span>Scale your mining power from entry hardware to premium quantum rigs.</span></div><span>LEVEL 1–10</span></div>
   <div className="glass section" style={{marginTop:14}}><div className="eyebrow">HASHRATE STATUS</div><div className="list-row"><span className="muted">Mining status</span><b>{benefits?.active?'PREMIUM • AUTO ACTIVE':expired?'PAUSED':'ACTIVE'}</b></div><div className="list-row"><span className="muted">Recharge</span><b>{benefits?.active?'Not required':rechargeExpires?new Date(rechargeExpires).toLocaleString('id-ID'):'Not active'}</b></div><div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}><button type="button" className="btn btn-primary" disabled={recharging||benefits?.active||(!expired&&Boolean(rechargeExpires))} onClick={()=>void doRecharge()}>{benefits?.active?'Premium Hashrate Active':expired?'Aktifkan Hashrate':'Hashrate Aktif'}</button><button type="button" className="btn" disabled={recharging} onClick={()=>void doCheckin()}>Daily Check-in</button></div>{actionMessage?<div className="muted" style={{marginTop:10}}>{actionMessage}</div>:null}</div>
   <div className="grid grid-3" style={{marginTop:14}}><section className="glass stat"><label>YOUR HASHRATE</label><b>{totalHashrate.toLocaleString('en-US')} H/s</b><div className="muted">Active miner power</div></section><section className="glass stat"><label>ACTIVE MINERS</label><b>{activeMiners}</b><div className="muted">Currently mining</div></section><section className="glass stat"><label>WALLET</label><b>{diamond(balance)}</b><div className="muted">Available balance</div></section></div>
   <div className="filters" style={{margin:'14px 0'}}>{FILTERS.map(item=><button key={item} type="button" className={`filter ${filter===item?'active':''}`} onClick={()=>setFilter(item)}>{item}</button>)}</div>
   {loading?<div className="glass section"><div className="eyebrow">DATABASE SYNC</div><h2>Loading miner catalog…</h2><p className="muted">Syncing catalog, level progression and account ownership.</p></div>:error?<div className="glass section"><div className="eyebrow">SYNC ERROR</div><h2>Unable to load miner data</h2><p className="muted">{error}</p><button type="button" className="btn btn-primary" onClick={()=>void loadData()}>Retry</button></div>:filtered.length===0?<div className="glass section"><div className="eyebrow">NO RESULTS</div><h2>No miners in this tier</h2><p className="muted">Select another tier to view available miners.</p></div>:<div className="shop-grid">{filtered.map(miner=><MinerCard key={miner.catalogId} miner={miner} onChanged={loadData}/>)}</div>}
 </AppShell>;
}
