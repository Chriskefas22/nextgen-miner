'use client';

import Link from 'next/link';
import { Boxes, Grid2X2, Home, PackageOpen, ShoppingCart } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function BottomNav(){
  const pathname=usePathname()??'';
  const active=(href:string)=>href==='/dashboard'?pathname==='/dashboard':pathname===href||pathname.startsWith(`${href}/`);
  return <nav className="bottom-nav home-bottom-nav ng-bottom-dock" aria-label="Primary navigation">
    <Link href="/dashboard" className={active('/dashboard')?'active':''}><Home size={18}/><span>Farm</span></Link>
    <Link href="/rooms" className={active('/rooms')?'active':''}><Boxes size={18}/><span>Rooms</span></Link>
    <Link href="/miners" className={active('/miners')?'active':''}><ShoppingCart size={18}/><span>Shop</span></Link>
    <Link href="/items" className={active('/items')?'active':''}><PackageOpen size={18}/><span>Inventory</span></Link>
    <Link href="/more" className={active('/more')?'active':''}><Grid2X2 size={18}/><span>More</span></Link>
  </nav>;
}
