const productionUrl = 'https://nextgen-miner.vercel.app';

export const siteConfig = {
  name: 'NextGen Miner',
  // Production identity is intentionally fixed to the official Vercel domain.
  // This prevents a stale NEXT_PUBLIC_SITE_URL from reintroducing the retired domain.
  url: productionUrl,
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '',
  discordUrl: process.env.NEXT_PUBLIC_DISCORD_URL || '',
  telegramUrl: process.env.NEXT_PUBLIC_TELEGRAM_URL || '',
  xUrl: process.env.NEXT_PUBLIC_X_URL || '',
} as const;
