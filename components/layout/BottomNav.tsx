'use client';

import Link from 'next/link';
import {
  Boxes,
  Droplets,
  Target,
  Wallet,
  Coins,
} from 'lucide-react';

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      <Link href="/dashboard">
        <Coins size={17} />
        <span>Home</span>
      </Link>

      <Link href="/miners">
        <Boxes size={17} />
        <span>Miners</span>
      </Link>

      <Link href="/faucet">
        <Droplets size={17} />
        <span>Faucet</span>
      </Link>

      <Link href="/quests">
        <Target size={17} />
        <span>Quests</span>
      </Link>

      <Link href="/wallet">
        <Wallet size={17} />
        <span>Wallet</span>
      </Link>
    </nav>
  );
}
