import './globals.css';
import './landing-page.css';
import './deposit-wallet.css';
import './brand-mobile-polish.css';
import '../styles/nav-drawer.css';
import '../styles/dashboard-simple.css';
import '../css/landing-neon-frame.css';
import '../css/public-pages.css';

export const metadata = {
  metadataBase: new URL('https://nextgen-miner.vercel.app'),
  title: { default: 'NextGen Miner — Virtual Mining Platform', template: '%s | NextGen Miner' },
  description: 'NextGen Miner is a virtual mining and reward platform with live miner data, server-side reward controls and transparent platform rules.',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  icons: {
    icon: '/branding/nextgen-miner-logo.svg',
    shortcut: '/branding/nextgen-miner-logo.svg',
  },
  openGraph: {
    title: 'NextGen Miner — Virtual Mining Platform',
    description: 'Build your rig, grow hashrate, upgrade miners and manage rewards through a virtual mining platform.',
    url: '/',
    siteName: 'NextGen Miner',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'NextGen Miner — Virtual Mining Platform',
    description: 'Build your rig, grow hashrate and manage rewards through a virtual mining platform.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
