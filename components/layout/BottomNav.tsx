'use client';
import Link from 'next/link';
import { Boxes, Grid2X2, Home, MoreHorizontal, Package, Target } from 'lucide-react';
const items=[['Home','/dashboard',Home],['Rooms','/rooms',Grid2X2],['Shop','/miners',Boxes],['Quests','/quests',Target],['Items','/items',Package],['More','/more',MoreHorizontal]] as const;
export function BottomNav(){return <nav className="bottom-nav" style={{gridTemplateColumns:'repeat(6,minmax(0,1fr))'}}>{items.map(([label,href,Icon])=><Link href={href} key={label}><Icon size={17}/><span>{label}</span></Link>)}</nav>}
