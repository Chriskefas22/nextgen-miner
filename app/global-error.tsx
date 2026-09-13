'use client';

import Link from 'next/link';

export default function GlobalError() {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#020711', color: '#f3fbff', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <section style={{ width: 'min(720px, 100%)', padding: 28, border: '1px solid rgba(39,234,255,.15)', borderRadius: 18, background: 'linear-gradient(135deg,rgba(8,27,44,.95),rgba(10,9,30,.94))' }}>
            <div style={{ color: '#27eaff', fontSize: 11, fontWeight: 900, letterSpacing: '.18em', marginBottom: 10 }}>
              500 // SYSTEM ERROR
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(30px, 7vw, 56px)', lineHeight: 1.05 }}>Something went wrong.</h1>
            <p style={{ color: '#9eb1bd', lineHeight: 1.65, maxWidth: 620 }}>
              The application could not render this request. No financial or reward action is assumed successful when an error occurs.
            </p>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 18 }}>
              <Link href="/" style={{ display: 'inline-flex', padding: '10px 13px', borderRadius: 10, color: '#06101d', background: 'linear-gradient(135deg,#1fceff,#7d3cff)', fontWeight: 900, textDecoration: 'none' }}>Return Home</Link>
              <Link href="/contact" style={{ display: 'inline-flex', padding: '10px 13px', borderRadius: 10, color: '#c8d7df', border: '1px solid rgba(68,142,193,.3)', background: 'rgba(6,16,29,.72)', fontWeight: 900, textDecoration: 'none' }}>Contact Support</Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
