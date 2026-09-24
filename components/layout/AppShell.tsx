'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import '../../styles/dashboard-shell.css';
import '../../styles/home-premium-polish.css';
import '../../styles/navigation-final.css';
import '../../styles/wallet-premium.css';
import '../../styles/wallet-simple.css';

export function AppShell({
  children,
  showSearch = true,
  showBalance = true,
}: {
  children: React.ReactNode;
  showSearch?: boolean;
  showBalance?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const home = pathname === '/dashboard';
  const shop = pathname === '/miners';

  return (
    <div
      className={`app-shell ${home ? 'home-shell' : ''} ${shop ? 'shop-shell' : ''}`}
    >
      {open ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setOpen(false)}
          className="ng-nav-backdrop"
        />
      ) : null}

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="main">
        <Topbar
          onMenu={() => setOpen(true)}
          showSearch={showSearch}
          showBalance={showBalance}
        />
        <main className="content">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
