'use client';

import Link from 'next/link';
import {
  LayoutDashboard,
  Coins,
  Boxes,
  ArrowUpCircle,
  Target,
  Droplets,
  MousePointerClick,
  Link2,
  Gift,
  Users,
  Wallet,
  Clock3,
  Trophy,
  Headphones,
  Settings,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const items = [
  ['Dashboard', '/dashboard', LayoutDashboard],
  ['Earn', '/earn', Coins],
  ['Miners', '/miners', Boxes],
  ['Upgrade', '/miners?tab=upgrade', ArrowUpCircle],
  ['Quests', '/quests', Target],
  ['Faucet', '/faucet', Droplets],
  ['PTC', '/ptc', MousePointerClick],
  ['Shortlinks', '/shortlinks', Link2],
  ['Offers', '/offers', Gift],
  ['Referral', '/referrals', Users],
  ['Wallet', '/wallet', Wallet],
  ['History', '/wallet/history', Clock3],
  ['Leaderboard', '/leaderboard', Trophy],
  ['Support', '/support', Headphones],
  ['Settings', '/settings', Settings],
] as const;

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const [userName, setUserName] = useState('Account');
  const [minerLevel, setMinerLevel] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) return;

      const metadataName =
        user.user_metadata?.username ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0];

      if (metadataName && mounted) {
        setUserName(String(metadataName));
      }

      const { data } = await supabase
        .from('nextgen_user_miners')
        .select('current_level')
        .eq('user_id', user.id)
        .order('current_level', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mounted) {
        setMinerLevel(
          data?.current_level == null
            ? null
            : Number(data.current_level)
        );
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-head">
        <span>CONTROL GRID</span>

        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <nav>
        {items.map(([label, href, Icon]) => (
          <Link
            key={label}
            href={href}
            className="nav-item"
            onClick={onClose}
          >
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link
          href="/profile"
          className="mini-user"
          onClick={onClose}
        >
          <div className="avatar">
            {userName.charAt(0).toUpperCase()}
          </div>

          <div>
            <b>{userName}</b>

            <small>
              {minerLevel === null
                ? 'No miner yet'
                : `Level ${minerLevel}`}
            </small>
          </div>

          <span className="dot" />
        </Link>
      </div>
    </aside>
  );
}
