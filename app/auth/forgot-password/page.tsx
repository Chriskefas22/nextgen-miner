'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TurnstileField } from '@/components/auth/TurnstileField';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (!email.trim()) throw new Error('Please enter your email.');
      if (!token) throw new Error('Please complete the security verification.');

      const verify = await fetch('/api/security/turnstile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
        cache: 'no-store',
      });
      const result = await verify.json();
      if (!verify.ok || !result.success) {
        throw new Error('Security verification failed.');
      }

      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/auth/reset-password` }
      );
      if (error) throw error;

      setSent(true);
      setMessage('If an account exists for this email, a password reset link has been sent.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to send the reset email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="glass auth-card">
        <div className="auth-brand"><div className="brand-mark" style={{width:54,height:54}}>N</div></div>
        <div className="eyebrow">ACCOUNT RECOVERY</div>
        <h1>Forgot password?</h1>
        <p className="muted">Enter your account email and we will send you a secure password reset link.</p>

        <form className="form" onSubmit={submit}>
          <div className="field">
            <label>EMAIL</label>
            <input className="input" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>

          <TurnstileField onToken={setToken} />
          {message && <div className="notice" role="status">{message}</div>}

          <button className="btn btn-primary" type="submit" disabled={busy || !token || sent}>
            {busy ? 'SENDING…' : sent ? 'EMAIL SENT' : 'SEND RESET LINK'}
          </button>
        </form>

        <p className="muted">Remember your password? <Link href="/auth/login" style={{color:'var(--cyan)'}}>Back to Login</Link></p>
      </div>
    </div>
  );
}
