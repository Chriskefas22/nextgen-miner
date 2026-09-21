'use client';

import Link from 'next/link';
import {
  BadgeHelp,
  Boxes,
  CircleHelp,
  ClipboardList,
  ExternalLink,
  FileClock,
  Home,
  Layers3,
  LogOut,
  MessageCircle,
  Package,
  Settings,
  ShieldQuestion,
  ShoppingBag,
  Target,
  Trophy,
  UserRound,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type NavItem = readonly [
  label: string,
  href: string,
  icon: typeof Home,
];

type Props = {
  open: boolean;
  onClose: () => void;
};

const core: NavItem[] = [
  ['Home', '/dashboard', Home],
  ['Mine', '/rooms', Target],
  ['Miners', '/miners', Boxes],
  ['Merge', '/merge', Layers3],
  ['Quests', '/quests', Target],
];

const earn: NavItem[] = [
  ['PTC', '/ptc', Zap],
  ['Offers', '/offers', ShoppingBag],
  ['Shortlinks', '/shortlinks', ExternalLink],
  ['Surveys', '/surveys', ClipboardList],
  ['Faucet', '/faucet', BadgeHelp],
  ['Contests', '/contests', Trophy],
];

const account: NavItem[] = [
  ['Profile', '/profile', UserRound],
  ['Wallet', '/wallet', Wallet],
  ['History', '/wallet/history', FileClock],
  ['Referrals', '/referrals', Users],
  ['Leaderboard', '/leaderboard', Trophy],
];

const system: NavItem[] = [
  ['Notifications', '/notifications', MessageCircle],
  ['Support', '/support', ShieldQuestion],
  ['Settings', '/settings', Settings],
  ['FAQ', '/faq', CircleHelp],
  ['How It Works', '/how-it-works', CircleHelp],
];

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ open, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const [userName, setUserName] = useState('User');
  const [membership, setMembership] =
    useState('Standard Member');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted || !user) return;

      const metadata = user.user_metadata ?? {};

      setUserName(
        String(
          metadata.username ||
            metadata.full_name ||
            metadata.name ||
            user.email?.split('@')[0] ||
            'User',
        ),
      );

      setMembership(
        String(
          metadata.membership ||
            'Standard Member',
        ),
      );

      setAvatarUrl(
        String(
          metadata.avatar_url ||
            metadata.picture ||
            '',
        ),
      );
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await createClient().auth.signOut();
    } finally {
      onClose();
      router.replace('/');
      router.refresh();
    }
  }

  function render(items: readonly NavItem[]) {
    return items.map(([label, href, Icon]) => (
      <Link
        key={label}
        href={href}
        className={`nav-item ${
          isActivePath(pathname, href)
            ? 'active'
            : ''
        }`}
        onClick={onClose}
      >
        <Icon size={18} strokeWidth={1.85} />
        <span>{label}</span>
      </Link>
    ));
  }

  const avatar = avatarUrl ? (
    <img
      src={avatarUrl}
      alt=""
      referrerPolicy="no-referrer"
    />
  ) : (
    userName.charAt(0).toUpperCase()
  );

  return (
    <aside
      className={`sidebar ${
        open ? 'open' : ''
      } home-sidebar`}
      aria-hidden={!open ? undefined : false}
    >
      <div className="sidebar-head home-sidebar-head">
        <span>MINING CONTROL</span>

        <button
          type="button"
          className="sidebar-close"
          aria-label="Close navigation menu"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="sidebar-section-label">
          CORE
        </div>
        {render(core)}

        <div className="sidebar-section-label">
          EARN DIAMOND
        </div>
        {render(earn)}

        <div className="sidebar-section-label">
          ACCOUNT
        </div>
        {render(account)}

        <div className="sidebar-section-label">
          SYSTEM
        </div>
        {render(system)}

        <button
          type="button"
          className="nav-item sidebar-logout"
          onClick={() => void logout()}
          disabled={loggingOut}
        >
          <LogOut size={18} strokeWidth={1.85} />
          <span>
            {loggingOut
              ? 'Logging out…'
              : 'Logout'}
          </span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <Link
          href="/profile"
          className="mini-user"
          onClick={onClose}
        >
          <div className="avatar">
            {avatar}
          </div>

          <div>
            <b>{userName}</b>
            <small>{membership}</small>
          </div>

          <span className="dot" />
        </Link>

        <div className="home-sidebar-version">
          <span className="version-label">v2.0.0</span>
          <span className="version-status">
            All Systems Operational
          </span>
        </div>
      </div>
    </aside>
  );
}
