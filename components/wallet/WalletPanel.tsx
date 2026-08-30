'use client';

import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { diamond, money } from '@/lib/format';

export function WalletPanel() {
  const [balance, setBalance] = useState<number | null>(null);
  const [usdValue, setUsdValue] = useState<number | null>(null);
  const [qualifyingTopup, setQualifyingTopup] = useState<number | null>(null);

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
        .select(
          'diamond_balance, usd_value, qualifying_topup_usd'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mounted) return;

      setBalance(
        data?.diamond_balance == null
          ? 0
          : Number(data.diamond_balance)
      );

      setUsdValue(
        data?.usd_value == null
          ? null
          : Number(data.usd_value)
      );

      setQualifyingTopup(
        data?.qualifying_topup_usd == null
          ? 0
          : Number(data.qualifying_topup_usd)
      );
    }

    loadWallet();

    return () => {
      mounted = false;
    };
  }, []);

  const canWithdraw =
    (qualifyingTopup ?? 0) >= 1;

  return (
    <section className="glass wallet-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">WALLET</span>
          <h2>Balance & Transactions</h2>
        </div>

        <span className="status-pill online">
          ACTIVE
        </span>
      </div>

      <div className="wallet-total">
        <span>AVAILABLE</span>

        <b>
          {balance === null
            ? '—'
            : diamond(balance)}
        </b>

        {usdValue !== null && (
          <small>
            {money(usdValue)} estimated value
          </small>
        )}
      </div>

      <div className="wallet-actions">
        <Link
          href="/wallet/deposit"
          className="btn btn-success"
        >
          <ArrowDownLeft size={16} />
          Deposit
        </Link>

        <Link
          href="/wallet/withdraw"
          className="btn btn-primary"
        >
          <ArrowUpRight size={16} />
          Withdraw
        </Link>

        <Link
          href="/wallet/exchange"
          className="btn btn-ghost"
        >
          <RefreshCw size={16} />
          Exchange
        </Link>
      </div>

      <div className="notice">
        Minimum withdrawal <b>$1.00</b>.
        A cumulative qualifying top-up of{' '}
        <b>$1.00</b> is required before withdrawal.

        {qualifyingTopup !== null && (
          <span className="muted">
            {' '}
            Current qualifying top-up: $
            {qualifyingTopup.toFixed(2)}
            {' · '}
            {canWithdraw
              ? 'Eligible'
              : 'Not yet eligible'}
            .
          </span>
        )}
      </div>
    </section>
  );
}
