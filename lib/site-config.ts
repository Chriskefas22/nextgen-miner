export const siteConfig = {
  name: 'NextGen Miner',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://nextgen-miner.vercel.app',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '',
  discordUrl: process.env.NEXT_PUBLIC_DISCORD_URL || '',
  telegramUrl: process.env.NEXT_PUBLIC_TELEGRAM_URL || '',
  xUrl: process.env.NEXT_PUBLIC_X_URL || '',
} as const;
