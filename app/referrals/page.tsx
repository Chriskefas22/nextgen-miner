import Link from 'next/link';
import { PublicPage } from '@/components/public/PublicPage';
import { createClient } from '@/lib/supabase/server';
import { siteConfig } from '@/lib/site-config';

export const metadata = {
  title: 'Referral Program',
  description: 'Learn how the NextGen Miner referral program works and how referred users are attributed.',
  alternates: {
    canonical: `${siteConfig.url}/referrals`,
  },
  openGraph: {
    title: 'Referral Program | NextGen Miner',
    description: 'Learn how the NextGen Miner referral program works and how referred users are attributed.',
    url: `${siteConfig.url}/referrals`,
  },
};

export default async function ReferralsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <PublicPage
      eyebrow="REFERRAL PROGRAM"
      title="Invite the next generation of miners."
      description="Share your referral link, bring new users into the platform and let the server determine attribution and qualification."
    >
      <section className="public-card public-hero">
        <h2>How the referral program works</h2>
        <div className="public-grid">
          <article className="public-info"><h3>1 · Share</h3><p>Registered users receive a server-owned referral code and can share a registration link built from that code.</p></article>
          <article className="public-info"><h3>2 · Register</h3><p>A new user can arrive through the referral link. The registration flow passes the referral code into the authenticated account metadata.</p></article>
          <article className="public-info"><h3>3 · Qualify</h3><p>Referral attribution and reward values are determined by server-side referral records and qualification rules, not client counters.</p></article>
        </div>

        <h2>What is tracked</h2>
        <p>The referral system can record the referrer, the referred user, referral status and any server-calculated Diamond reward. A referred account is uniquely attributed to one referrer so duplicate attribution is prevented.</p>

        <h2>Rewards are not guaranteed</h2>
        <p>Referral rewards depend on the platform&apos;s configured qualification rules and available reward economics. Promotional text on this page does not override the database or the platform&apos;s active rules.</p>

        <div className="public-note">
          {user
            ? 'You are signed in. Open your private referral dashboard to view your live server-recorded referral code, referrals and reward totals.'
            : 'Create an account to receive your referral code. Existing members can sign in to use the private referral dashboard.'}
        </div>

        <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginTop:16 }}>
          {user ? (
            <Link className="public-button-primary" href="/dashboard/referrals">Open My Referral Dashboard →</Link>
          ) : (
            <>
              <Link className="public-button-primary" href="/auth/register">Create Account →</Link>
              <Link className="public-button" href="/auth/login">Login</Link>
            </>
          )}
          <Link className="public-button" href="/legal/terms">Read Terms</Link>
        </div>
      </section>
    </PublicPage>
  );
}
