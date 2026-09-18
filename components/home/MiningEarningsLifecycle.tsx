'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, Coins, Gauge, GitMerge, Hourglass, RefreshCw, ShieldCheck, WalletCards, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './MiningEarningsLifecycle.module.css';

type Live = {
  status: string;
  estimated_usd: number | string;
  estimated_crypto: number | string;
  hourly_usd?: number | string;
  daily_usd?: number | string;
  crypto_rate_usd?: number | string;
  reward_rate_usd_per_hash_second?: number | string;
  recharge_expires_at?: string | null;
  active_hashrate?: number | string;
  as_of?: string;
};

type Preview = { status:string; reason:string; amount_usd:number|string; crypto_amount:number|string; settlement_date:string; payout_id:number|null };
type Room = { name:string; room_level:number; capacity_slots:number; used_slots:number; hashrate:number; power_watts:number };
type Rooms = { room_count:number; max_rooms:number; rooms:Room[] };

type Props = { asset?: string };
const money=(v:number|string|undefined,d=6)=>Number(v??0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const crypto=(v:number|string|undefined)=>Number(v??0).toLocaleString('en-US',{maximumFractionDigits:12});

export function MiningEarningsLifecycle({asset='USDT'}:Props){
  const [live,setLive]=useState<Live|null>(null);const [preview,setPreview]=useState<Preview|null>(null);const [rooms,setRooms]=useState<Rooms|null>(null);const [loading,setLoading]=useState(true);const [claiming,setClaiming]=useState(false);const [message,setMessage]=useState('');const [clock,setClock]=useState(Date.now());
  const load=useCallback(async()=>{try{const sb=createClient();const [l,p,r]=await Promise.all([sb.rpc('nextgen_live_mining_snapshot',{p_asset:asset}),sb.rpc('nextgen_mining_claim_preview',{p_asset:asset}),sb.rpc('nextgen_rooms_snapshot')]);if(l.error)throw l.error;if(p.error)throw p.error;if(r.error)throw r.error;setLive(l.data as Live);setPreview(p.data as Preview);setRooms(r.data as Rooms)}catch(error){setMessage(error instanceof Error?error.message:'Unable to sync mining lifecycle.')}finally{setLoading(false)}},[asset]);
  useEffect(()=>{void load();const poll=window.setInterval(()=>void load(),15000);const tick=window.setInterval(()=>setClock(Date.now()),1000);return()=>{window.clearInterval(poll);window.clearInterval(tick)}},[load]);
  const expiry=live?.recharge_expires_at?new Date(live.recharge_expires_at).getTime():0;const seconds=expiry?Math.max(0,Math.floor((expiry-clock)/1000)):0;const hh=Math.floor(seconds/3600).toString().padStart(2,'0');const mm=Math.floor((seconds%3600)/60).toString().padStart(2,'0');const ss=(seconds%60).toString().padStart(2,'0');const active=['ACTIVE','ACTIVE_GUARDED','ACTIVE_POOL'].includes(live?.status??'')&&seconds>0;
  async function claim(){if(preview?.status!=='READY'||claiming)return;setClaiming(true);setMessage('');try{const result=await createClient().rpc('nextgen_claim_mining',{p_asset:asset});if(result.error)throw result.error;setMessage(result.data?.settled?`Settlement ${result.data?.payout_id?`#${result.data.payout_id} `:''}claimed successfully.`:String(result.data?.reason??'Settlement was not available.'));await load()}catch(error){setMessage(error instanceof Error?error.message:'Claim failed.')}finally{setClaiming(false)}}
  const room=rooms?.rooms?.[0];
  return <section className={styles.panel} aria-label="Mining earnings lifecycle">
    <div className={styles.head}><div><div className={styles.kicker}>MINING ACCOUNTING FLOW</div><h2>Live → Pending → Claimable → Wallet</h2><p>Live accrual is visual only until a daily settlement is created server-side. Claimable is an exact preview of the prior settlement cycle.</p></div><button className={styles.refresh} type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/></button></div>
    {message?<div className={styles.message}>{message}</div>:null}
    {loading&&!live?<div className={styles.loading}>SYNCING MINING ENGINE…</div>:<>
      <div className={styles.lifecycleGrid}>
        <div className={`${styles.card} ${styles.live}`}><div className={styles.cardTop}><span><Zap size={14}/> LIVE NOW</span><b>{active?'ONLINE':'PAUSED'}</b></div><strong>{crypto(live?.estimated_crypto)} <em>{asset}</em></strong><small>~${money(live?.estimated_usd)} current server snapshot</small><div className={styles.mini}><span>PER HOUR</span><b>${money(live?.hourly_usd,6)}</b></div><div className={styles.mini}><span>SESSION</span><b>{active?`${hh}:${mm}:${ss}`:'—'}</b></div></div>
        <div className={styles.card}><div className={styles.cardTop}><span><Hourglass size={14}/> PENDING</span><b>ESTIMATED</b></div><strong>{crypto(live?.estimated_crypto)} <em>{asset}</em></strong><small>Current cycle · becomes claimable after settlement.</small><div className={styles.note}><ShieldCheck size={14}/> Not added to wallet yet.</div></div>
        <div className={`${styles.card} ${preview?.status==='READY'?styles.claimable:''}`}><div className={styles.cardTop}><span><CheckCircle2 size={14}/> CLAIMABLE</span><b>{preview?.status??'WAITING'}</b></div><strong>{crypto(preview?.crypto_amount)} <em>{asset}</em></strong><small>{preview?.settlement_date??'—'} · ${money(preview?.amount_usd)} USD settlement</small><button className={styles.claim} type="button" disabled={preview?.status!=='READY'||claiming} onClick={()=>void claim()}><WalletCards size={15}/>{claiming?'CLAIMING…':preview?.status==='READY'?'CLAIM':'WAITING FOR SETTLEMENT'}</button></div>
      </div>
      <div className={styles.footerRow}><div><Gauge size={14}/><span>LIVE HASHRATE</span><b>{Number(live?.active_hashrate??0).toLocaleString('en-US')} H/s</b></div><div><Coins size={14}/><span>DAILY EST.</span><b>${money(live?.daily_usd,6)}</b></div><div><Clock3 size={14}/><span>RATE</span><b>${money(live?.crypto_rate_usd,8)}</b></div><div><GitMerge size={14}/><span>ROOM</span><b>{room?`${room.used_slots}/${room.capacity_slots}`:'—'}</b></div><Link href="/rooms" className={styles.roomLink}>Open Rooms <ArrowRight size={13}/></Link></div>
    </>}
  </section>
}
