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
    () => `${origin}/auth/register?ref=${encodeURIComponent(summary.referral_code)}`,
    [origin, summary.referral_code],
  );

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
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
          <small>Invite link uses this server-owned referral code.</small>
        </div>
        <button type="button" className="public-button-primary" onClick={copy}>
          {copied ? 'Copied' : 'Copy Link'}
        </button>
      </div>

      <div className="public-grid">
        <div className="public-info"><h3>Total referrals</h3><p>{summary.total_referrals.toLocaleString('en-US')}</p></div>
        <div className="public-info"><h3>Qualified</h3><p>{summary.qualified_referrals.toLocaleString('en-US')}</p></div>
        <div className="public-info"><h3>Total earned</h3><p>💎 {Number(summary.total_reward_diamond || 0).toLocaleString('en-US')}</p></div>
      </div>

      <div className="public-note">
        Referral rewards are calculated from server-side referral records. No promotional
        or hardcoded referral totals are shown.
      </div>
    </>
  );
}
