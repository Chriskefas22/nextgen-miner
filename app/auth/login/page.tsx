'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { TurnstileField } from '@/components/auth/TurnstileField';

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] =
    useState('');

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function verifyTurnstile(token: string) {
    const response = await fetch(
      '/api/security/turnstile',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          token,
        }),
        cache: 'no-store',
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        'Security verification failed.'
      );
    }

    return result;
  }

  async function submit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setBusy(true);
    setMessage('');

    try {
      if (!email.trim()) {
        throw new Error(
          'Please enter your email.'
        );
      }

      if (!password) {
        throw new Error(
          'Please enter your password.'
        );
      }

      if (!turnstileToken) {
        throw new Error(
          'Please complete the security verification.'
        );
      }

      await verifyTurnstile(
        turnstileToken
      );

      const supabase = createClient();

      const { data, error } =
        await supabase.auth.signInWithPassword(
          {
            email: email.trim(),
            password,
          }
        );

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          'Login failed. Please try again.'
        );
      }

      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to sign in.'
      );

      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="glass auth-card">

        <div className="auth-brand">
          <div
            className="brand-mark"
            style={{
              width: 54,
              height: 54,
            }}
          >
            N
          </div>
        </div>

        <div className="eyebrow">
          SECURE ACCESS
        </div>

        <h1>Welcome back</h1>

        <p className="muted">
          Enter the command grid with your
          verified account.
        </p>

        <form
          className="form"
          onSubmit={submit}
        >
          <div className="field">
            <label>EMAIL</label>

            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="field">
            <label>PASSWORD</label>

            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="••••••••"
              required
            />

            <div
              style={{
                marginTop: 8,
                textAlign: 'right',
              }}
            >
              <Link
                href="/auth/forgot-password"
                style={{
                  color: 'var(--cyan)',
                  fontSize: 14,
                }}
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <TurnstileField
            onToken={setTurnstileToken}
          />

          {message && (
            <div className="notice">
              {message}
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={
              busy ||
              !turnstileToken
            }
          >
            {busy
              ? 'AUTHENTICATING…'
              : 'LOGIN'}
          </button>
        </form>

        <p className="muted">
          New miner?{' '}

          <Link
            href="/auth/register"
            style={{
              color: 'var(--cyan)',
            }}
          >
            Create account
          </Link>
        </p>

      </div>
    </div>
  );
}
