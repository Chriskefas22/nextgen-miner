'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { MinerCard, Miner } from '@/components/miner/MinerCard';
import { createClient } from '@/lib/supabase/client';
import { diamond } from '@/lib/format';

type CatalogRow={id:number;slug:string;name:string;tier:string;base_hashrate:number;base_price_diamond:number;image_path:string;enabled:boolean;sort_order:number};
type LevelRow={miner_id:number;level:number;hashrate:number;upgrade_price_diamond:number;cumulative_price_diamond:number};
type UserMinerRow={id:number;miner_id:number;current_level:number;total_spent_diamond:number;status:string};

const FILTERS=['All','Common','Uncommon','Rare','Epic','Legendary','Mythic','Premium','Omega+'] as const;
function asRows<T>(value:unknown):T[]{return Array.isArray(value)?value as T[]:[]}
function normalizeMinerImagePath(imagePath:string|null|undefined,slug:string){const fallback=`/assets/miners/${slug}.svg`;if(!imagePath)return fallback;const cleaned=String(imagePath).trim().replace(/^\/+/, '');if(cleaned.startsWith('assets/miners/'))return `/${cleaned}`;if(cleaned.startsWith('miners/'))return `/assets/${cleaned}`;if(cleaned.endsWith('.webp'))return `/assets/miners/${cleaned}`;return fallback}

export default function MinersPage(){
 const [miners,setMiners]=useState<Miner[]>([]),[balance,setBalance]=useState(0),[filter,setFilter]=useState<string>('All'),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const loadData=useCallback(async()=>{const supabase=createClient();setLoading(true);setError('');try{
   const {data:{user}}=await supabase.auth.getUser();
   const [catalogResult,levelsResult]=await Promise.all([
     supabase.from('nextgen_miner_catalog').select('id,slug,name,tier,base_hashrate,base_price_diamond,image_path,enabled,sort_order').eq('enabled',true).order('sort_order',{ascending:true}),
     supabase.from('nextgen_miner_levels').select('miner_id,level,hashrate,upgrade_price_diamond,cumulative_price_diamond').order('miner_id',{ascending:true}).order('level',{ascending:true})
   ]);
   if(catalogResult.error)throw catalogResult.error;if(levelsResult.error)throw levelsResult.error;
   const catalog=asRows<CatalogRow>(catalogResult.data);const levels=asRows<LevelRow>(levelsResult.data);
   let userMiners:UserMinerRow[]=[];let walletBalance=0;
   if(user){const [userMinersResult,walletResult]=await Promise.all([
     supabase.from('nextgen_user_miners').select('id,miner_id,current_level,total_spent_diamond,status').eq('user_id',user.id),
     supabase.from('nextgen_wallets').select('diamond_balance').eq('user_id',user.id).maybeSingle()
   ]);if(userMinersResult.error)throw userMinersResult.error;if(walletResult.error)throw walletResult.error;userMiners=asRows<UserMinerRow>(userMinersResult.data);walletBalance=Number(walletResult.data?.diamond_balance??0)}
   setBalance(walletBalance);
   const levelsByMiner=new Map<number,LevelRow[]>();for(const level of levels){const arr=levelsByMiner.get(Number(level.miner_id))??[];arr.push(level);levelsByMiner.set(Number(level.miner_id),arr)}
   const ownedByMiner=new Map<number,UserMinerRow>();for(const userMiner of userMiners)ownedByMiner.set(Number(userMiner.miner_id),userMiner);
   const mapped:Miner[]=catalog.map((item)=>{const catalogId=Number(item.id);const slug=String(item.slug??'');const lower=`${slug} ${item.name}`.toLowerCase();if(slug==='starter-keyboard'||lower.includes('starter keyboard'))return null as never;const minerLevels=levelsByMiner.get(catalogId)??[];const owned=ownedByMiner.get(catalogId);const currentLevel=owned?Number(owned.current_level):1;const currentLevelRow=minerLevels.find(l=>Number(l.level)===currentLevel)??minerLevels[0];const nextLevelRow=minerLevels.find(l=>Number(l.level)===currentLevel+1)??null;const maxLevel=minerLevels.length?Math.max(...minerLevels.map(l=>Number(l.level))):10;return {catalogId,userMinerId:owned?Number(owned.id):null,slug,name:String(item.name??''),tier:String(item.tier??''),image:normalizeMinerImagePath(item.image_path,slug),baseHashrate:Number(item.base_hashrate??0),purchasePrice:Number(item.base_price_diamond??0),currentLevel,maxLevel,currentHashrate:Number(currentLevelRow?.hashrate??item.base_hashrate??0),nextHashrate:nextLevelRow?Number(nextLevelRow.hashrate):null,nextUpgradePrice:nextLevelRow?Number(nextLevelRow.upgrade_price_diamond):null,totalSpent:Number(owned?.total_spent_diamond??0),owned:Boolean(owned),active:Boolean(owned&&String(owned.status).toLowerCase()==='active')} }).filter(Boolean) as Miner[];
   setMiners(mapped.sort((a,b)=>{const order=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','MYTHIC','PREMIUM','OMEGA+'];return order.indexOf(a.tier.toUpperCase())-order.indexOf(b.tier.toUpperCase())||a.catalogId-b.catalogId}));
 }catch(err){console.error('[MinersPage]',err);setError(err instanceof Error?err.message:'Unable to load miner data')}finally{setLoading(false)}},[]);
 useEffect(()=>{void loadData()},[loadData]);
 const filtered=useMemo(()=>filter==='All'?miners:miners.filter(m=>m.tier.toLowerCase()===filter.toLowerCase()),[miners,filter]);
 const activeMiners=miners.filter(m=>m.owned&&m.active).length;const totalHashrate=miners.reduce((t,m)=>t+(m.owned&&m.active?Number(m.currentHashrate):0),0);
 return <AppShell><div className="page-head"><div><div className="eyebrow">SHOP / MINERS</div><h1 className="page-title">Choose Your Mining Rig</h1><div className="muted">Core collection from Basic CPU to Quantum Rig, plus premium late-game hardware. Starter Keyboard removed.</div></div><div className="diamond-pill"><span aria-hidden="true">💎</span><b>{diamond(balance)}</b></div></div>
   <div className="hero-banner"><div><b>NEXTGEN MINER CATALOG</b><br/><span>Scale your mining power from entry hardware to premium quantum rigs.</span></div><span>LEVEL 1–10</span></div>
   <div className="grid grid-3" style={{marginTop:14}}><section className="glass stat"><label>YOUR HASHRATE</label><b>{totalHashrate.toLocaleString('en-US')} H/s</b><div className="muted">Active miner power</div></section><section className="glass stat"><label>ACTIVE MINERS</label><b>{activeMiners}</b><div className="muted">Currently mining</div></section><section className="glass stat"><label>WALLET</label><b>{diamond(balance)}</b><div className="muted">Available balance</div></section></div>
   <div className="filters" style={{margin:'14px 0'}}>{FILTERS.map(item=><button key={item} type="button" className={`filter ${filter===item?'active':''}`} onClick={()=>setFilter(item)}>{item}</button>)}</div>
   {loading?<div className="glass section"><div className="eyebrow">DATABASE SYNC</div><h2>Loading miner catalog…</h2><p className="muted">Syncing catalog, level progression and account ownership.</p></div>:error?<div className="glass section"><div className="eyebrow">SYNC ERROR</div><h2>Unable to load miner data</h2><p className="muted">{error}</p><button type="button" className="btn btn-primary" onClick={()=>void loadData()}>Retry</button></div>:filtered.length===0?<div className="glass section"><div className="eyebrow">NO RESULTS</div><h2>No miners in this tier</h2><p className="muted">Select another tier to view available miners.</p></div>:<div className="shop-grid">{filtered.map(miner=><MinerCard key={miner.catalogId} miner={miner} onChanged={loadData}/>)}</div>}
 </AppShell>;
}
