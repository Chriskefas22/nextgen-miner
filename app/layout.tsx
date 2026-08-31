import './globals.css';
import '../styles/blueprint-dashboard.css';
import '../styles/nav-drawer.css';

export const metadata = {
  title: 'NextGen Miner',
  description: 'NextGen Miner — futuristic virtual mining platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
