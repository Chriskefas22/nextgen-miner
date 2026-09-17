'use client';

import Link from 'next/link';
import { Grid2X2, Home, Pickaxe, Wallet } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname();
  const currentPath = pathname ?? '';

  const isActive = (href: string) => {
    if (href === '/dashboard') return currentPath === '/dashboard';
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  const homeActive = isActive('/dashboard');
  const mineActive = isActive('/rooms') || isActive('/miners');
  const walletActive = isActive('/wallet');
  const moreActive = isActive('/more');

  return (
    <nav
      className="bottom-nav home-bottom-nav ng-bottom-dock"
      aria-label="Primary navigation"
    >
      <Link
        href="/dashboard"
        className={homeActive ? 'active' : ''}
        aria-current={homeActive ? 'page' : undefined}
      >
        <Home size={17} />
        <span>Home</span>
      </Link>

      <Link
        href="/rooms"
        className={mineActive ? 'active' : ''}
        aria-current={mineActive ? 'page' : undefined}
      >
        <Pickaxe size={17} />
        <span>Mine</span>
      </Link>

      <Link
        href="/dashboard"
        className="home-n-core"
        aria-label="NextGen Miner Home"
        aria-current={homeActive ? 'page' : undefined}
      >
        <span>N</span>
      </Link>

      <Link
        href="/wallet"
        className={walletActive ? 'active' : ''}
        aria-current={walletActive ? 'page' : undefined}
      >
        <Wallet size={17} />
        <span>Wallet</span>
      </Link>

      <Link
        href="/more"
        className={moreActive ? 'active' : ''}
        aria-current={moreActive ? 'page' : undefined}
      >
        <Grid2X2 size={17} />
        <span>More</span>
      </Link>
    </nav>
  );
}
