'use client';

import { useMemo, useState } from 'react';

type Summary = {
  referral_code: string;
  total_referrals: number;
  qualified_referrals: number;
  total_reward_diamond: number;
};

export function ReferralPanel({ summary }: { summary: Summary }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = useMemo(
    () => origin
      ? `${origin}/auth/register?ref=${encodeURIComponent(summary.referral_code)}`
      : `/auth/register?ref=${encodeURIComponent(summary.referral_code)}`,
    [origin, summary.referral_code],
  );

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className="referral-code">
        <div>
          <strong>{summary.referral_code}</strong>
          <small>Share the registration link generated from your server-owned referral code.</small>
        </div>
        <button type="button" className="public-button-primary" onClick={copy}>
          {copied ? 'Copied' : 'Copy Link'}
        </button>
      </div>

      <div className="public-grid">
        <div className="public-info"><h3>Total referrals</h3><p>{Number(summary.total_referrals || 0).toLocaleString('en-US')}</p></div>
        <div className="public-info"><h3>Qualified</h3><p>{Number(summary.qualified_referrals || 0).toLocaleString('en-US')}</p></div>
        <div className="public-info"><h3>Total earned</h3><p>💎 {Number(summary.total_reward_diamond || 0).toLocaleString('en-US')}</p></div>
      </div>

      <div className="public-note">
        Referral totals and rewards are read from server-side referral records. No promotional or hardcoded referral totals are presented.
      </div>
    </>
  );
}
