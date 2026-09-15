'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';

type FaucetSnapshot = {
  enabled?: boolean;
  reward_diamond?: number | string;
  cooldown_seconds?: number | string;
  daily_cap_diamond?: number | string;
  daily_used?: number | string;
  next_claim_at?: string | null;
  can_claim?: boolean;
};

function formatCountdown(target: string | null | undefined) {
  if (!target) return 'READY';
  const seconds = Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / 1000));
  if (seconds <= 0) return 'READY';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Faucet() {
  const [snapshot, setSnapshot] = useState<FaucetSnapshot | null>(null);
  const [countdown, setCountdown] = useState('SYNCING…');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('nextgen_faucet_snapshot');
    if (error) {
      setMessage(error.message || 'Unable to load faucet state.');
      return;
    }
    setSnapshot((data ?? {}) as FaucetSnapshot);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      const value = formatCountdown(snapshot?.next_claim_at);
      setCountdown(value);
    }, 1000);
    setCountdown(formatCountdown(snapshot?.next_claim_at));
    return () => clearInterval(id);
  }, [snapshot?.next_claim_at]);

  const claim = async () => {
    if (busy || snapshot?.can_claim === false) return;
    setBusy(true);
    setMessage('');
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('nextgen_claim_faucet');
      if (error) throw error;
      const reward = Number((data as { reward?: unknown } | null)?.reward ?? snapshot?.reward_diamond ?? 0);
      setMessage(`CLAIMED ✓ +${reward} Diamond`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Faucet claim failed.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const reward = Number(snapshot?.reward_diamond ?? 0);
  const dailyUsed = Number(snapshot?.daily_used ?? 0);
  const dailyCap = Number(snapshot?.daily_cap_diamond ?? 0);
  const cycleHours = Number(snapshot?.cooldown_seconds ?? 0) / 3600;

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">FREE REWARDS</div>
          <h1 className="page-title">Faucet</h1>
          <div className="muted">Server-authoritative claim cycle and cooldown.</div>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="glass section" style={{ textAlign: 'center' }}>
          <div className="holo-core" style={{ height: 300 }}>
            <img className="holo-preview" src="/assets/nextgen-master-ui.png" alt="" />
          </div>

          <div className="eyebrow" style={{ marginTop: 12 }}>NEXT CLAIM</div>
          <div className="stat"><b>{countdown}</b></div>

          <button
            className="btn btn-primary"
            disabled={busy || snapshot?.can_claim === false || countdown !== 'READY'}
            onClick={() => void claim()}
          >
            {busy ? 'SYNCING…' : countdown === 'READY' ? `CLAIM +${reward} 💎` : countdown}
          </button>

          {message ? (
            <p className="muted" style={{ marginTop: 10 }}>{message}</p>
          ) : null}
        </section>

        <section className="glass section">
          <div className="eyebrow">SERVER RULES</div>
          <h2>Claim safely</h2>

          <div className="list-row"><span className="muted">Cycle</span><b>{cycleHours.toFixed(0)} hours</b></div>
          <div className="list-row"><span className="muted">Reward</span><b>💎 {reward}</b></div>
          <div className="list-row"><span className="muted">Daily used</span><b>💎 {dailyUsed}</b></div>
          <div className="list-row"><span className="muted">Daily cap</span><b>💎 {dailyCap}</b></div>
          <div className="list-row">
            <span className="muted">Status</span>
            <span className={`badge ${snapshot?.enabled ? 'green' : ''}`}>
              {snapshot?.enabled ? 'LIVE' : 'DISABLED'}
            </span>
          </div>

          <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
            Reward amount, cooldown and daily cap are read from Supabase. The browser does not decide eligibility.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
