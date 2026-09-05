'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { DepositFlow } from '@/components/wallet/DepositFlow';
import { createClient } from '@/lib/supabase/client';

export default function Wallet() {
  const [tab, setTab] = useState('deposit');
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
        setBalance(data?.diamond_balance == null ? 0 : Number(data.diamond_balance));
      }
    }

    loadWallet();

    return () => {
      mounted = false;
    };
  }, []);

  const formattedBalance =
    balance === null
      ? '—'
      : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(balance);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">WALLET CORE</div>
          <h1 className="page-title">Wallet</h1>
          <div className="muted">Crypto deposit and withdrawal controls.</div>
        </div>
        <div className="diamond-pill">
          <span>💎</span>
          <b>{formattedBalance}</b>
        </div>
      </div>

      <section className="glass section">
        <div className="tabs">
          {['deposit', 'withdraw', 'exchange'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`tab ${tab === t ? 'active' : ''}`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'deposit' && <DepositFlow />}

        {tab === 'withdraw' && (
          <div className="grid grid-2">
            <div className="form">
              <div className="field">
                <label>ASSET</label>
                <select className="input">
                  <option>USDT · TRON</option>
                  <option>BTC</option>
                  <option>ETH</option>
                  <option>BNB</option>
                </select>
              </div>
              <div className="field">
                <label>DESTINATION</label>
                <input className="input" placeholder="Wallet address" />
              </div>
              <div className="field">
                <label>AMOUNT (USD)</label>
                <input className="input" placeholder="1.00" />
              </div>
              <button className="btn btn-primary">Request Withdrawal</button>
            </div>

            <div className="glass section">
              <div className="eyebrow">ELIGIBILITY</div>
              <div className="list-row">
                <span className="muted">Minimum withdrawal</span>
                <b>$1.00</b>
              </div>
              <div className="list-row">
                <span className="muted">Qualifying top-up</span>
                <b>$1.00 cumulative</b>
              </div>
              <div className="list-row">
                <span className="muted">Review</span>
                <span className="badge gold">OWNER</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'exchange' && (
          <div className="grid grid-2">
            <div className="form">
              <div className="field">
                <label>FROM</label>
                <input className="input" placeholder="💎 amount" />
              </div>
              <div className="field">
                <label>TO CRYPTO</label>
                <select className="input">
                  <option>USDT</option>
                  <option>BTC</option>
                  <option>ETH</option>
                  <option>BNB</option>
                </select>
              </div>
              <button className="btn btn-primary">Preview Exchange</button>
            </div>

            <div className="glass section">
              <div className="eyebrow">LIVE RATE</div>
              <h2 style={{ fontFamily: 'Orbitron', fontSize: 19 }}>$0.0002 / 💎</h2>
              <p className="muted">
                Rate source and fee are controlled server-side and recorded in the exchange ledger.
              </p>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
