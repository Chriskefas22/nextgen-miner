'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="ng-public">
      <div className="public-wrap">
        <section className="public-card public-hero">
          <div className="eyebrow">500 // SYSTEM ERROR</div>
          <h1>Something went wrong.</h1>
          <p>The request could not be completed. No financial or reward action is assumed successful when an error occurs.</p>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 18 }}>
            <button type="button" onClick={() => reset()} className="public-button-primary">Try Again</button>
            <Link href="/" className="public-button">Return Home</Link>
            <Link href="/contact" className="public-button">Contact Support</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
