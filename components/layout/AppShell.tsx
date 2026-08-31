'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
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
        <Topbar onMenu={() => setOpen(true)} />
        <main className="content">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
