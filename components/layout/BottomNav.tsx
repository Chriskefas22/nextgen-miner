'use client';

import Link from 'next/link';
import {
  Boxes,
  Home,
  PackageOpen,
  ShoppingCart,
  UserRound,
} from 'lucide-react';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname() ?? '';

  const active = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === href ||
        pathname.startsWith(`${href}/`);

  return (
    <nav
      className="bottom-nav home-bottom-nav ng-bottom-dock"
      aria-label="Primary navigation"
    >
      <Link
        href="/dashboard"
        className={
          active('/dashboard')
            ? 'active'
            : ''
        }
      >
        <Home size={19} />
        <span>Farm</span>
      </Link>

      <Link
        href="/rooms"
        className={
          active('/rooms')
            ? 'active'
            : ''
        }
      >
        <Boxes size={19} />
        <span>Rooms</span>
      </Link>

      <Link
        href="/miners"
        className={
          active('/miners')
            ? 'active'
            : ''
        }
      >
        <ShoppingCart size={19} />
        <span>Shop</span>
      </Link>

      <Link
        href="/items"
        className={
          active('/items')
            ? 'active'
            : ''
        }
      >
        <PackageOpen size={19} />
        <span>Inventory</span>
      </Link>

      <Link
        href="/profile"
        className={
          active('/profile')
            ? 'active'
            : ''
        }
      >
        <UserRound size={19} />
        <span>Profile</span>
      </Link>
    </nav>
  );
}
