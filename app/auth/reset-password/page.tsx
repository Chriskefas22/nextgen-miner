'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });

    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) setReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (!ready) throw new Error('This password reset link is invalid or has expired. Please request a new one.');
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      if (password !== confirm) throw new Error('Passwords do not match.');

      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      setPassword('');
      setConfirm('');
      setMessage('Your password has been updated successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="glass auth-card">
        <div className="auth-brand"><div className="brand-mark" style={{width:54,height:54}}>N</div></div>
        <div className="eyebrow">SECURE RECOVERY</div>
        <h1>Set new password</h1>
        <p className="muted">Choose a new password for your NextGen Miner account.</p>

        <form className="form" onSubmit={submit}>
          <div className="field">
            <label>NEW PASSWORD</label>
            <input className="input" type="password" autoComplete="new-password" minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" required />
          </div>
          <div className="field">
            <label>CONFIRM PASSWORD</label>
            <input className="input" type="password" autoComplete="new-password" minLength={8}
              value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your password" required />
          </div>

          {message && <div className="notice" role="status">{message}</div>}

          {!success ? (
            <button className="btn btn-primary" type="submit" disabled={busy || !ready}>
              {busy ? 'UPDATING…' : !ready ? 'VERIFYING LINK…' : 'UPDATE PASSWORD'}
            </button>
          ) : (
            <Link href="/auth/login" className="btn btn-primary" style={{display:'block',textAlign:'center',textDecoration:'none'}}>
              RETURN TO LOGIN
            </Link>
          )}
        </form>
      </div>
    </div>
  );
}
