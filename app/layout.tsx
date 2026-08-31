import './globals.css';
import '../styles/hologram.css';

export const metadata = {
  title: 'NextGen Miner',
  description: 'Futuristic virtual mining command center',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
