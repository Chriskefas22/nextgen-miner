'use client';

import Link from 'next/link';
import { Bell, Menu, Search, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import BrandLink from '@/components/branding/BrandLink';

type TopbarProps = {
  onMenu?: () => void;
  showSearch?: boolean;
};

export function Topbar({ onMenu, showSearch = true }: TopbarProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      setUserName(
        String(
          user.user_metadata?.username ||
            user.user_metadata?.full_name ||
            user.email?.split('@')[0] ||
            'User',
        ),
      );

      const { data } = await supabase
        .from('nextgen_wallets')
        .select('diamond_balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (mounted) {
        setBalance(data?.diamond_balance == null ? 0 : Number(data.diamond_balance));
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const formatted =
    balance === null
      ? '—'
      : new Intl.NumberFormat('en-US', {
          maximumFractionDigits: 0,
        }).format(balance);

  return (
    <header className="topbar home-topbar">
      <div className="home-top-left">
        <button
          type="button"
          aria-label="Open menu"
          className="icon-btn mobile-menu"
          onClick={onMenu}
        >
          <Menu size={19} />
        </button>
        <BrandLink href="/dashboard" variant="dashboard" className="brand" />
      </div>

      {showSearch ? (
        <div className="home-search">
          <Search size={16} />
          <input
            aria-label="Search"
            placeholder="Search miners, assets, or features..."
          />
        </div>
      ) : null}

      <div className="top-actions">
        <div className="diamond-pill">
          <span>💎</span>
          <b>{formatted}</b>
          <Link href="/wallet/deposit" aria-label="Add diamonds">
            <Plus size={14} />
          </Link>
        </div>
        <Link href="/notifications" className="icon-btn" aria-label="Notifications">
          <Bell size={18} />
          <span className="notify-dot" />
        </Link>
        <Link href="/profile" className="home-user">
          <span className="home-user-avatar">{userName.charAt(0).toUpperCase()}</span>
          <span>
            <b>{userName}</b>
            <small>Standard Member ▾</small>
          </span>
        </Link>
      </div>
    </header>
  );
}
