'use client';

import Link from 'next/link';
import { Bell, Menu, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import BrandLink from '@/components/branding/BrandLink';

type TopbarProps = {
  onMenu?: () => void;
  showSearch?: boolean;
  showBalance?: boolean;
};

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Topbar({
  onMenu,
  showSearch = true,
  showBalance = true,
}: TopbarProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [userName, setUserName] = useState('User');
  const [membership, setMembership] = useState('Standard Member');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) return;

      const metadata = user.user_metadata ?? {};
      const displayName = String(
        metadata.username ||
          metadata.full_name ||
          metadata.name ||
          user.email?.split('@')[0] ||
          'User',
      );

      setUserName(displayName);
      setMembership(String(metadata.membership || 'Standard Member'));
      setAvatarUrl(String(metadata.avatar_url || metadata.picture || ''));

      if (showBalance) {
        const { data } = await supabase
          .from('nextgen_wallets')
          .select('diamond_balance')
          .eq('user_id', user.id)
          .maybeSingle();

        if (mounted) {
          setBalance(data?.diamond_balance == null ? 0 : Number(data.diamond_balance));
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [showBalance]);

  const formatted =
    balance === null
      ? '—'
      : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(balance);

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
          <input aria-label="Search" placeholder="Search miners, assets, or features..." />
        </div>
      ) : null}

      <div className="top-actions">
        {showBalance ? (
          <div className="diamond-pill">
            <span>💎</span>
            <b>{formatted}</b>
            <Link href="/wallet/deposit" aria-label="Add diamonds">
              <Plus size={14} />
            </Link>
          </div>
        ) : null}

        <Link href="/notifications" className="icon-btn" aria-label="Notifications">
          <Bell size={18} />
          <span className="notify-dot" />
        </Link>

        <Link href="/profile" className="home-user" aria-label={`Open profile for ${userName}`}>
          <span className="home-user-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              initials(userName)
            )}
          </span>
          <span>
            <b>{userName}</b>
            <small>{membership} ▾</small>
          </span>
        </Link>
      </div>
    </header>
  );
}
