import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { ReferralPanel } from '@/components/referrals/ReferralPanel';

export const metadata = {
  title: 'Referral Program',
  description: 'Invite users and view server-recorded referral results.',
};

type Summary = {
  referral_code: string;
  total_referrals: number;
  qualified_referrals: number;
  total_reward_diamond: number;
};

export default async function ReferralsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data, error } = await supabase.rpc('nextgen_get_my_referral_summary');
  if (error) throw new Error('Unable to load referral summary.');

  const summary = data as Summary;

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">REFERRAL GRID</div>
          <h1 className="page-title">Invite &amp; Earn</h1>
          <div className="muted">Referral rewards are qualified by server-side activity rules.</div>
        </div>
      </div>
      <section className="glass section">
        <ReferralPanel summary={summary} />
      </section>
    </AppShell>
  );
}
