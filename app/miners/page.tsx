'use client';

import Link from 'next/link';
import { Boxes, PackageOpen, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { MinerCard, Miner } from '@/components/miner/MinerCard';
import { createClient } from '@/lib/supabase/client';
import { diamond } from '@/lib/format';

const FILTERS = ['All', 'Starter', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const;

type CatalogRow = { id:number; slug:string; name:string; tier:string; base_hashrate:number; base_price_diamond:number; base_power_watts:number; image_path:string|null; sort_order:number };
type LevelRow = { miner_id:number; level:number; hashrate:number };
type UserMinerRow = { id:number; miner_id:number; current_level:number; status:string; is_merged:boolean; deployment_state:'inventory'|'deployed' };

function imagePath(path:string|null,slug:string){
  if(!path) return `/assets/miners/${slug}.webp`;
  const clean=path.replace(/^\/+/, '');
  if(clean.startsWith('assets/')) return `/${clean}`;
  if(clean.startsWith('miners/')) return `/assets/${clean}`;
  return `/assets/miners/${slug}.webp`;
}

export default function MinersPage(){
  const [miners,setMiners]=useState<Miner[]>([]);
  const [filter,setFilter]=useState<(typeof FILTERS)[number]>('All');
  const [balance,setBalance]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const sb=createClient();
      const {data:{user}}=await sb.auth.getUser();
      const [catalogResult,levelsResult,userResult,walletResult]=await Promise.all([
        sb.from('nextgen_miner_catalog').select('id,slug,name,tier,base_hashrate,base_price_diamond,base_power_watts,image_path,sort_order').eq('enabled',true).order('sort_order'),
        sb.from('nextgen_miner_levels').select('miner_id,level,hashrate').order('miner_id').order('level'),
        user?sb.from('nextgen_user_miners').select('id,miner_id,current_level,status,is_merged,deployment_state').eq('user_id',user.id).eq('is_merged',false):Promise.resolve({data:[],error:null}),
        user?sb.from('nextgen_wallets').select('diamond_balance').eq('user_id',user.id).maybeSingle():Promise.resolve({data:null,error:null}),
      ]);
      if(catalogResult.error)throw catalogResult.error;if(levelsResult.error)throw levelsResult.error;if(userResult.error)throw userResult.error;if(walletResult.error)throw walletResult.error;
      const catalog=(catalogResult.data??[]) as unknown as CatalogRow[];
      const levels=(levelsResult.data??[]) as unknown as LevelRow[];
      const users=(userResult.data??[]) as unknown as UserMinerRow[];
      const levelMap=new Map<string,LevelRow>();for(const row of levels)levelMap.set(`${Number(row.miner_id)}:${Number(row.level)}`,row);
      const byMiner=new Map<number,UserMinerRow[]>();for(const row of users){const k=Number(row.miner_id);const arr=byMiner.get(k)??[];arr.push(row);byMiner.set(k,arr)}
      const tierOrder=['STARTER','COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','MYTHIC'];
      const mapped:Miner[]=catalog.map(item=>{
        const id=Number(item.id);const owned=byMiner.get(id)??[];const primary=owned[0];
        const highest=owned.reduce((max,row)=>Math.max(max,Number(row.current_level)),1);
        const levelRow=levelMap.get(`${id}:${highest}`)??levelMap.get(`${id}:1`);
        const levelCount=levels.filter(row=>Number(row.miner_id)===id).length;
        return {catalogId:id,slug:item.slug,name:item.name,tier:item.tier,image:imagePath(item.image_path,item.slug),baseHashrate:Number(item.base_hashrate),purchasePrice:Number(item.base_price_diamond),currentLevel:highest,maxLevel:levelCount||10,currentHashrate:Number(levelRow?.hashrate??item.base_hashrate),ownedCount:owned.length,owned:owned.length>0,active:owned.some(row=>row.status.toLowerCase()==='active'),deploymentState:owned.some(row=>row.deployment_state==='deployed')?'deployed':'inventory'};
      });
      mapped.sort((a,b)=>(tierOrder.indexOf(a.tier.toUpperCase())-tierOrder.indexOf(b.tier.toUpperCase()))||(a.catalogId-b.catalogId));
      setMiners(mapped);setBalance(Number(walletResult.data?.diamond_balance??0));
    }catch(err){setError(err instanceof Error?err.message:'Unable to load miner catalog.')}finally{setLoading(false)}
  },[]);

  useEffect(()=>{void load()},[load]);

  const filtered=useMemo(()=>filter==='All'?miners:miners.filter(x=>x.tier.toLowerCase()===filter.toLowerCase()),[miners,filter]);
  const ownedCopies=miners.reduce((sum,x)=>sum+x.ownedCount,0);
  const activeCopies=miners.reduce((sum,x)=>sum+(x.active?x.ownedCount:0),0);

  return <AppShell>
    <div className="page-head"><div><div className="eyebrow">SHOP / MINERS</div><h1 className="page-title">Miner Shop</h1><div className="muted">12 miner families · Level 1–10 · Buy → Inventory → Room → Mining.</div></div><div className="diamond-pill"><span>💎</span><b>{diamond(balance)}</b></div></div>
    <div className="hero-banner"><div><b>NEXTGEN MINER CATALOG</b><br/><span>Every purchase enters Inventory first. Deployment starts only after a Room slot is assigned.</span></div><Link href="/items" className="btn btn-ghost"><PackageOpen size={15}/> INVENTORY <ArrowIcon/></Link></div>
    <div className="grid grid-3" style={{marginTop:14}}>
      <section className="glass stat"><label>YOUR COPIES</label><b>{ownedCopies}</b><div className="muted">All non-merged miners</div></section>
      <section className="glass stat"><label>DEPLOYED</label><b>{activeCopies}</b><div className="muted">Active or deployed copies</div></section>
      <section className="glass stat"><label>WALLET</label><b>{diamond(balance)}</b><div className="muted">Available Diamond</div></section>
    </div>
    <div className="filters" style={{margin:'14px 0'}}>{FILTERS.map(item=><button key={item} type="button" className={`filter ${filter===item?'active':''}`} onClick={()=>setFilter(item)}>{item}</button>)}<button type="button" className="filter" onClick={()=>void load()}><RefreshCw size={13}/> Refresh</button></div>
    {loading?<div className="glass section"><div className="eyebrow">DATABASE SYNC</div><h2>Loading miner catalog…</h2></div>:error?<div className="glass section"><div className="eyebrow">SYNC ERROR</div><h2>Unable to load miner catalog</h2><p className="muted">{error}</p><button type="button" className="btn btn-primary" onClick={()=>void load()}>Retry</button></div>:<div className="shop-grid">{filtered.map(miner=><MinerCard key={miner.catalogId} miner={miner} onChanged={load}/>)}</div>}
    <section className="glass section" style={{marginTop:14}}><div className="eyebrow">UNIFIED FLOW</div><div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',color:'#8fa8b9',fontSize:10}}><span>SHOP</span><ArrowIcon/><span>INVENTORY</span><ArrowIcon/><span>ROOM</span><ArrowIcon/><span>FARM</span></div></section>
  </AppShell>
}
function ArrowIcon(){return <span aria-hidden="true" style={{opacity:.6}}>→</span>}
