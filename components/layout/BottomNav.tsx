'use client';
import Link from 'next/link';
import { Grid2X2, Home, Pickaxe, Wallet } from 'lucide-react';
export function BottomNav(){return <nav className="bottom-nav home-bottom-nav"><Link href="/dashboard" className="active"><Home size={17}/><span>Home</span></Link><Link href="/rooms"><Pickaxe size={17}/><span>Mine</span></Link><Link href="/dashboard" className="home-n-core" aria-label="NextGen Miner Home"><span>N</span></Link><Link href="/wallet"><Wallet size={17}/><span>Wallet</span></Link><Link href="/more"><Grid2X2 size={17}/><span>More</span></Link></nav>}
