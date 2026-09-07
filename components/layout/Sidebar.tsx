'use client';

import Link from 'next/link';
import {
  LayoutDashboard, Coins, Boxes, ArrowUpCircle, Target, Droplets,
  MousePointerClick, Link2, Gift, Users, Wallet, Clock3, Trophy,
  Headphones, Settings, Crown, LogOut,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const items = [
  ['Dashboard', '/dashboard', LayoutDashboard],
  ['Earn', '/earn', Coins],
  ['Miners', '/miners', Boxes],
  ['Upgrade', '/miners?tab=upgrade', ArrowUpCircle],
  ['Premium', '/premium', Crown],
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

type SidebarProps = { open: boolean; onClose: () => void };

export function Sidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();
  const [userName, setUserName] = useState('Account');
  const [minerLevel, setMinerLevel] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      const metadataName =
        user.user_metadata?.username ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0];

      if (metadataName) setUserName(String(metadataName));

      const { data: ownerResult, error: ownerError } =
        await supabase.rpc('nextgen_is_owner');

      if (mounted && !ownerError && ownerResult === true) {
        setIsOwner(true);
      }

      const { data } = await supabase
        .from('nextgen_user_miners')
        .select('current_level')
        .eq('user_id', user.id)
        .order('current_level', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mounted) {
        setMinerLevel(data?.current_level == null ? null : Number(data.current_level));
      }
    }

    loadProfile();
    return () => { mounted = false; };
  }, []);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    onClose();
    router.replace('/');
    router.refresh();
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-head">
        <span>CONTROL GRID</span>
        <button type="button" aria-label="Close menu" onClick={onClose}>×</button>
      </div>

      <nav>
        {isOwner ? (
          <div className="sidebar-owner-section">
            <div className="sidebar-section-label">OWNER</div>
            <Link href="/owner" className="nav-item nav-item--owner" onClick={onClose}>
              <Crown size={17} /><span>Owner Control</span>
            </Link>
          </div>
        ) : null}

        {items.map(([label, href, Icon]) => (
          <Link key={label} href={href} className="nav-item" onClick={onClose}>
            <Icon size={17} /><span>{label}</span>
          </Link>
        ))}

        <button
          type="button"
          className="nav-item"
          onClick={logout}
          disabled={loggingOut}
          style={{ width: '100%', background: 'transparent', cursor: loggingOut ? 'wait' : 'pointer' }}
        >
          <LogOut size={17} />
          <span>{loggingOut ? 'Logging out…' : 'Logout'}</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <Link href="/profile" className="mini-user" onClick={onClose}>
          <div className="avatar">{userName.charAt(0).toUpperCase()}</div>
          <div>
            <b>{userName}</b>
            <small>{isOwner ? 'OWNER' : minerLevel === null ? 'No miner yet' : `Level ${minerLevel}`}</small>
          </div>
          <span className="dot" />
        </Link>
      </div>
    </aside>
  );
}
