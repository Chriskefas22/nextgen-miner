'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 95,
            border: 0,
            padding: 0,
            background: 'rgba(0,0,0,.58)',
            backdropFilter: 'blur(2px)',
            cursor: 'default',
          }}
        />
      )}

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="main">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="content">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
