'use client';

import Link from 'next/link';
import { Bell, Menu, Plus, WalletCards } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type TopbarProps = {
  onMenu?: () => void;
};

export function Topbar({ onMenu }: TopbarProps) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function loadWallet() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) return;

      const { data } = await supabase
        .from('nextgen_wallets')
        .select('diamond_balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (mounted) {
        setBalance(
          data?.diamond_balance == null
            ? 0
            : Number(data.diamond_balance)
        );
      }
    }

    loadWallet();

    return () => {
      mounted = false;
    };
  }, []);

  const formatted =
    balance === null
      ? '—'
      : new Intl.NumberFormat('en-US', {
          maximumFractionDigits: 2,
        }).format(balance);

  return (
    <header className="topbar">
      <button
        type="button"
        aria-label="Open menu"
        className="icon-btn mobile-menu"
        onClick={onMenu}
      >
        <Menu size={18} />
      </button>

      <Link
        href="/dashboard"
        className="brand"
        aria-label="NextGen Miner dashboard"
      >
        <div className="brand-mark">N</div>

        <div className="brand-title">
          NEXTGEN <span>MINER</span>
        </div>
      </Link>

      <div className="top-actions">
        <Link
          href="/wallet/deposit"
          className="diamond-pill"
          aria-label="Open deposit"
        >
          <span>💎</span>
          <b>{formatted}</b>
          <span aria-hidden="true">
            <Plus size={15} />
          </span>
        </Link>

        <Link
          href="/notifications"
          className="icon-btn"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </Link>

        <Link
          href="/wallet"
          className="icon-btn"
          aria-label="Wallet"
        >
          <WalletCards size={18} />
        </Link>
      </div>
    </header>
  );
}
