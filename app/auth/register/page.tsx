'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TurnstileField } from '@/components/auth/TurnstileField';

type BonusStatus = { remaining_slots?: number; bonus_miner?: { name?: string; hashrate?: number } };

export default function Register() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [remainingSlots, setRemainingSlots] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref')?.trim().toUpperCase() || '';
    if (/^[A-Z0-9-]{4,40}$/.test(ref)) setReferralCode(ref);

    let mounted = true;
    createClient().rpc('nextgen_get_registration_bonus_status').then(({ data }) => {
      if (!mounted) return;
      const status = data as BonusStatus | null;
      if (typeof status?.remaining_slots === 'number') setRemainingSlots(status.remaining_slots);
    });
    return () => { mounted = false; };
  }, [searchParams]);

  async function verifyTurnstile(token: string) {
    const response = await fetch('/api/security/turnstile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error('Security verification failed.');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(''); setSuccess(false);
    try {
      const cleanUsername = username.trim();
      if (!/^[A-Za-z0-9_]{3,24}$/.test(cleanUsername)) throw new Error('Username must be 3–24 characters using letters, numbers, or underscore.');
      if (!email.trim()) throw new Error('Please enter your email.');
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');
      if (!turnstileToken) throw new Error('Please complete the security verification.');

      await verifyTurnstile(turnstileToken);
      const supabase = createClient();
      const origin = window.location.origin;
      const metadata: Record<string, string> = { username: cleanUsername };
      if (referralCode) metadata.referral_code = referralCode;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: metadata, emailRedirectTo: `${origin}/auth/login` },
      });
      if (error) throw error;

      if (data.session && data.user) {
        router.replace('/dashboard');
        router.refresh();
        return;
      }

      setSuccess(true);
      setMessage('Account created. Check your email and verify the account. Your launch miner is assigned by the database after verification.');
      setPassword('');
      setConfirmPassword('');
      setTurnstileToken('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="glass auth-card">
        <div className="auth-brand"><div className="brand-mark" style={{ width: 54, height: 54 }}>N</div></div>
        <div className="eyebrow">CREATE ACCOUNT</div>
        <h1>Start mining</h1>
        <p className="muted">Build your miner network and enter the NextGen Miner grid.</p>

        <div style={{ margin: '14px 0', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(36,232,255,.22)', background: 'rgba(36,232,255,.05)' }}>
          <b style={{ color: 'var(--cyan)' }}>
            {remainingSlots === null ? 'Launch bonus checking…' : `${remainingSlots.toLocaleString('en-US')} Entry GPU slots remaining`}
          </b>
          <small className="muted" style={{ display: 'block', marginTop: 4 }}>
            The reward is decided server-side after email verification.
          </small>
        </div>

        {referralCode ? (
          <div style={{ margin: '0 0 14px', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(125,60,255,.24)', background: 'rgba(125,60,255,.06)' }}>
            <small className="muted">Referral code</small>
            <b style={{ display: 'block', color: 'var(--cyan)', marginTop: 3 }}>{referralCode}</b>
          </div>
        ) : null}

        <form className="form" onSubmit={submit}>
          <div className="field"><label>USERNAME</label><input className="input" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="MinerX" required /></div>
          <div className="field"><label>EMAIL</label><input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
          <div className="field"><label>PASSWORD</label><input className="input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8+ characters" required /></div>
          <div className="field"><label>CONFIRM PASSWORD</label><input className="input" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" required /></div>
          <TurnstileField onToken={setTurnstileToken} />
          {message && <div className="notice">{message}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy || !turnstileToken}>{busy ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT'}</button>
        </form>

        <p className="muted">Already registered? <Link href="/auth/login" style={{ color: 'var(--cyan)' }}>Login</Link></p>
      </div>
    </div>
  );
}
