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
    <span className={`${styles.visual} ${variant === 'dashboard' ? styles.dashboardVisual : styles.publicVisual}`}>
      <span className={styles.markWrap} aria-hidden="true">
        <svg className={styles.mark} viewBox="0 0 64 64" role="presentation" focusable="false">
          <defs>
            <linearGradient id="ngBrandFrame" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#eaffff" />
              <stop offset="0.22" stopColor="#36efff" />
              <stop offset="0.56" stopColor="#287dff" />
              <stop offset="0.82" stopColor="#7d45ff" />
              <stop offset="1" stopColor="#f04cff" />
            </linearGradient>
            <linearGradient id="ngBrandN" x1="17" y1="13" x2="50" y2="51" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.18" stopColor="#bdfdff" />
              <stop offset="0.45" stopColor="#20e7ff" />
              <stop offset="0.72" stopColor="#397dff" />
              <stop offset="1" stopColor="#d74bff" />
            </linearGradient>
            <linearGradient id="ngBrandNEdge" x1="19" y1="12" x2="49" y2="53" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".96" />
              <stop offset=".5" stopColor="#48f5ff" stopOpacity=".88" />
              <stop offset="1" stopColor="#9f6aff" stopOpacity=".92" />
            </linearGradient>
            <radialGradient id="ngBrandCore" cx="30" cy="27" r="31" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#2cecff" stopOpacity=".30" />
              <stop offset=".35" stopColor="#267dff" stopOpacity=".10" />
              <stop offset="1" stopColor="#020918" stopOpacity="0" />
            </radialGradient>
            <filter id="ngBrandGlow" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 0.95 0 0 0.02  0 0 1 0 0.08  0 0 0 .95 0" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ngBrandBeam" x="-90%" y="-90%" width="280%" height="280%">
              <feGaussianBlur stdDeviation="1.7" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect x="5.5" y="5.5" width="53" height="53" rx="17" fill="#020a18" fillOpacity=".94" stroke="#1a4664" strokeWidth="1.4" />
          <rect x="8" y="8" width="48" height="48" rx="15" fill="url(#ngBrandCore)" stroke="url(#ngBrandFrame)" strokeWidth="2.1" filter="url(#ngBrandGlow)" />

          <path d="M15 18h8M41 46h8" stroke="#b7fbff" strokeWidth="1" strokeLinecap="round" opacity=".56" />
          <path d="M13 25h3M48 39h3" stroke="#8c64ff" strokeWidth="1" strokeLinecap="round" opacity=".7" />

          <path
            d="M20 45V19L44 45V19"
            fill="none"
            stroke="url(#ngBrandNEdge)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".18"
            filter="url(#ngBrandGlow)"
          />
          <path
            d="M20 45V19L44 45V19"
            fill="none"
            stroke="url(#ngBrandN)"
            strokeWidth="4.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#ngBrandGlow)"
          />
          <path d="M22 20.5L43 43" stroke="#ffffff" strokeOpacity=".55" strokeWidth="1.15" strokeLinecap="round" />

          <circle cx="25" cy="37.8" r="1.6" fill="#71f8ff" opacity=".9" />
          <circle cx="25" cy="42.1" r="1.15" fill="#9b7cff" opacity=".9" />

          {/* Premium energy runner: the bright segment is animated in CSS around the N frame. */}
          <rect className={styles.energyTrack} x="8.7" y="8.7" width="46.6" height="46.6" rx="14" fill="none" stroke="url(#ngBrandFrame)" strokeWidth="1.7" strokeLinecap="round" strokeDasharray="7 127" filter="url(#ngBrandBeam)" />
          <rect className={styles.energyTrackSoft} x="9.4" y="9.4" width="45.2" height="45.2" rx="13.5" fill="none" stroke="#35ecff" strokeWidth=".8" strokeLinecap="round" strokeDasharray="2 132" opacity=".72" />
          <circle className={styles.energyNode} cx="8.8" cy="23" r="1.25" fill="#ebffff" filter="url(#ngBrandBeam)" />
        </svg>
      </span>
      <span className={styles.wordmark}>
        NEXTGEN <span className={styles.wordmarkAccent}>MINER</span>
      </span>
    </span>
  );
}

export default function BrandLink({ authAware = false, href, className = '', variant = 'public' }: BrandLinkProps) {
  const router = useRouter();
  const supabase = useMemo(() => (authAware ? createClient() : null), [authAware]);
  const [target, setTarget] = useState(href || '/');

  useEffect(() => {
    if (!authAware || !supabase) return;
    let mounted = true;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) setTarget(user ? '/dashboard' : '/');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
    const { data: { user } } = await supabase.auth.getUser();
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
