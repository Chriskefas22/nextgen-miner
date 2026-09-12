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
            <linearGradient id="ngBrandStroke" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#7df7ff" />
              <stop offset="0.55" stopColor="#24e8ff" />
              <stop offset="1" stopColor="#6d6bff" />
            </linearGradient>
            <linearGradient id="ngBrandN" x1="18" y1="13" x2="49" y2="53" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ecffff" />
              <stop offset="0.48" stopColor="#27eaff" />
              <stop offset="1" stopColor="#7e69ff" />
            </linearGradient>
            <radialGradient id="ngBrandCore" cx="32" cy="29" r="30" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#24e8ff" stopOpacity=".15" />
              <stop offset="1" stopColor="#24e8ff" stopOpacity="0" />
            </radialGradient>
            <filter id="ngBrandGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.1" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="32" cy="32" r="29" fill="url(#ngBrandCore)" />
          <rect x="6" y="6" width="52" height="52" rx="17" fill="rgba(3,13,25,.86)" stroke="url(#ngBrandStroke)" strokeWidth="2.2" filter="url(#ngBrandGlow)" />
          <path d="M21 45V19L43 45V19" fill="none" stroke="url(#ngBrandN)" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" filter="url(#ngBrandGlow)" />
          <path d="M16 15H24M40 49H48" stroke="#9fffff" strokeOpacity=".72" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </span>
      <span className={styles.wordmark}>NEXTGEN <span className={styles.wordmarkAccent}>MINER</span></span>
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
