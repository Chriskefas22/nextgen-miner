const productionUrl = 'https://nextgen-miner.vercel.app';

const clean = (value: string | undefined) => value?.trim() || '';

const cleanHttpUrl = (value: string | undefined) => {
  const candidate = clean(value);
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
};

const cleanEmail = (value: string | undefined) => {
  const candidate = clean(value);
  if (!candidate || /[\r\n]/.test(candidate)) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : '';
};

export const siteConfig = {
  name: 'NextGen Miner',
  url: productionUrl,

  // Public operational/contact configuration. Values are supplied by Vercel
  // Environment Variables and are never inferred from personal accounts.
  supportEmail: cleanEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
  discordUrl: cleanHttpUrl(process.env.NEXT_PUBLIC_DISCORD_URL),
  telegramUrl: cleanHttpUrl(process.env.NEXT_PUBLIC_TELEGRAM_URL),
  xUrl: cleanHttpUrl(process.env.NEXT_PUBLIC_X_URL),

  // Legal disclosure values. Do not invent or infer these from hosting,
  // repository ownership, or deployment metadata.
  legalEntityName: clean(process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME),
  jurisdiction: clean(process.env.NEXT_PUBLIC_LEGAL_JURISDICTION),
  legalAddress: clean(process.env.NEXT_PUBLIC_LEGAL_ADDRESS),

  privacyEffectiveDate: '2026-09-14',
  termsEffectiveDate: '2026-09-14',
  minimumAge: 18,
} as const;

export const publicCompliance = {
  operatorIdentityReady:
    Boolean(siteConfig.legalEntityName) &&
    Boolean(siteConfig.jurisdiction) &&
    Boolean(siteConfig.legalAddress),
  supportReady: Boolean(siteConfig.supportEmail),
  readyForCommercialLaunch:
    Boolean(siteConfig.legalEntityName) &&
    Boolean(siteConfig.jurisdiction) &&
    Boolean(siteConfig.legalAddress) &&
    Boolean(siteConfig.supportEmail),
} as const;
