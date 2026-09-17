'use client';

import Link from 'next/link';
import { Boxes, Grid2X2, Pickaxe, Wallet } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname() ?? '';

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const rackActive = isActive('/rooms');
  const mineActive = isActive('/miners');
  const walletActive = isActive('/wallet');
  const moreActive = isActive('/more');
  const homeActive = isActive('/dashboard');

  return (
    <nav className="bottom-nav home-bottom-nav ng-bottom-dock" aria-label="Primary navigation">
      <Link
        href="/rooms"
        className={rackActive ? 'active' : ''}
        aria-current={rackActive ? 'page' : undefined}
        aria-label="Mining rack and room management"
      >
        <Boxes size={18} />
        <span>Rack</span>
      </Link>

      <Link
        href="/miners"
        className={mineActive ? 'active' : ''}
        aria-current={mineActive ? 'page' : undefined}
        aria-label="Miner catalog and mining equipment"
      >
        <Pickaxe size={18} />
        <span>Mine</span>
      </Link>

      <Link
        href="/dashboard"
        className={`home-n-core${homeActive ? ' is-core-active' : ''}`}
        aria-label="Home dashboard"
        aria-current={homeActive ? 'page' : undefined}
      >
        <span>N</span>
      </Link>

      <Link
        href="/wallet"
        className={walletActive ? 'active' : ''}
        aria-current={walletActive ? 'page' : undefined}
        aria-label="Wallet"
      >
        <Wallet size={18} />
        <span>Wallet</span>
      </Link>

      <Link
        href="/more"
        className={moreActive ? 'active' : ''}
        aria-current={moreActive ? 'page' : undefined}
        aria-label="More"
      >
        <Grid2X2 size={18} />
        <span>More</span>
      </Link>
    </nav>
  );
}
