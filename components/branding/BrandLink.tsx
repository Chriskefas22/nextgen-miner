'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './BrandLink.module.css';

type BrandLinkProps = {
  authAware?: boolean;
  href?: string;
  className?: string;
  variant?: 'public' | 'dashboard';
};

function BrandVisual({ variant }: { variant: BrandLinkProps['variant'] }) {
  return (
    <span
      className={`${styles.visual} ${variant === 'dashboard' ? styles.dashboardVisual : styles.publicVisual}`}
    >
      <span className={styles.markWrap} aria-hidden="true">
        <svg
          className={styles.mark}
          viewBox="0 0 64 64"
          role="presentation"
          focusable="false"
        >
          <defs>
            <linearGradient id="ngBrandFrame" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#dffcff" />
              <stop offset="0.22" stopColor="#24e8ff" />
              <stop offset="0.58" stopColor="#4d86ff" />
              <stop offset="0.82" stopColor="#9a55ff" />
              <stop offset="1" stopColor="#f04dff" />
            </linearGradient>
            <linearGradient id="ngBrandN" x1="18" y1="11" x2="49" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.3" stopColor="#b8faff" />
              <stop offset="0.56" stopColor="#24e8ff" />
              <stop offset="0.78" stopColor="#5d86ff" />
              <stop offset="1" stopColor="#b65cff" />
            </linearGradient>
            <radialGradient id="ngBrandGlass" cx="32" cy="28" r="30" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#35ecff" stopOpacity=".24" />
              <stop offset="0.45" stopColor="#375fff" stopOpacity=".08" />
              <stop offset="1" stopColor="#071426" stopOpacity="0" />
            </radialGradient>
            <filter id="ngBrandGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.9" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ngBrandSoftGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx="32" cy="32" r="29" fill="url(#ngBrandGlass)" />

          <rect
            x="5.8"
            y="5.8"
            width="52.4"
            height="52.4"
            rx="16.8"
            fill="rgba(3,10,22,.86)"
            stroke="rgba(205,244,255,.14)"
            strokeWidth="1"
          />

          <rect
            x="7.8"
            y="7.8"
            width="48.4"
            height="48.4"
            rx="15.1"
            fill="none"
            stroke="url(#ngBrandFrame)"
            strokeWidth="2.2"
            pathLength="100"
            className={styles.frameBase}
          />

          <rect
            x="7.8"
            y="7.8"
            width="48.4"
            height="48.4"
            rx="15.1"
            fill="none"
            stroke="url(#ngBrandFrame)"
            strokeWidth="3.1"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="14 86"
            className={styles.energyRunner}
            filter="url(#ngBrandSoftGlow)"
          />

          <circle className={styles.energySpark} cx="32" cy="7.8" r="1.55" fill="#ffffff" filter="url(#ngBrandGlow)" />

          <path
            d="M20.2 44.2V19.8L43.8 44.2V19.8"
            fill="none"
            stroke="url(#ngBrandN)"
            strokeWidth="4.95"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ngBrandGlow)"
          />

          <path
            d="M16 15.3H24M40 48.7H48"
            stroke="#d7fbff"
            strokeOpacity=".82"
            strokeWidth="1.3"
            strokeLinecap="round"
          />

          <path
            d="M13.8 32H17.6M46.4 32H50.2"
            stroke="#39ecff"
            strokeOpacity=".55"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      </span>

      <span className={styles.wordmark} aria-label="NextGen Miner">
        <span className={styles.wordmarkNext}>NEXTGEN</span>{' '}
        <span className={styles.wordmarkMiner}>MINER</span>
      </span>
    </span>
  );
}

export default function BrandLink({
  authAware = false,
  href,
  className = '',
  variant = 'public',
}: BrandLinkProps) {
  const router = useRouter();
  const supabase = useMemo(() => (authAware ? createClient() : null), [authAware]);
  const [target, setTarget] = useState(href || '/');

  useEffect(() => {
    if (!authAware || !supabase) return;
    let mounted = true;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) setTarget(user ? '/dashboard' : '/');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setTarget(session?.user ? '/dashboard' : '/');
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [authAware, supabase]);

  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!authAware || !supabase) return;
    event.preventDefault();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const next = user ? '/dashboard' : '/';
    setTarget(next);
    router.push(next);
  }

  return (
    <Link
      href={target}
      onClick={handleClick}
      className={`${styles.brandLink} ${className}`.trim()}
      aria-label={target === '/dashboard' ? 'NextGen Miner dashboard' : 'NextGen Miner home'}
    >
      <BrandVisual variant={variant} />
    </Link>
  );
}
