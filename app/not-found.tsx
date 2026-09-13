import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="ng-public">
      <div className="public-wrap">
        <section className="public-card public-hero">
          <div className="eyebrow">404 // PAGE NOT FOUND</div>
          <h1>That page is unavailable.</h1>
          <p>The requested page does not exist or is no longer public.</p>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 18 }}>
            <Link href="/" className="public-button-primary">Return Home →</Link>
            <Link href="/contact" className="public-button">Contact Support</Link>
            <Link href="/auth/login" className="public-button">Login</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
