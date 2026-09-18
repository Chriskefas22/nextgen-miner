import { NextResponse } from 'next/server';

function normalizeCountry(value: string | null) {
  const code = (value ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function fromAcceptLanguage(value: string | null) {
  const first = (value ?? '').split(',')[0]?.trim() ?? '';
  const region = first.match(/^[A-Za-z]{2,3}-([A-Za-z]{2})$/)?.[1];
  return normalizeCountry(region ?? null);
}

function fromLanguage(value: string | null) {
  const language = (value ?? '').split(',')[0]?.trim().toLowerCase();
  const defaults: Record<string, string> = {
    id: 'ID', en: 'US', ms: 'MY', th: 'TH', vi: 'VN',
    zh: 'CN', ja: 'JP', ko: 'KR', hi: 'IN', ar: 'AE',
    tr: 'TR', fr: 'FR', de: 'DE', es: 'ES', pt: 'BR',
    it: 'IT', nl: 'NL', pl: 'PL', ru: 'RU',
  };
  return normalizeCountry(defaults[language] ?? null);
}

function fromTimeZone(value: string | null) {
  const zone = (value ?? '').trim();
  const map: Record<string, string> = {
    'Asia/Jakarta': 'ID',
    'Asia/Makassar': 'ID',
    'Asia/Jayapura': 'ID',
    'Asia/Singapore': 'SG',
    'Asia/Kuala_Lumpur': 'MY',
    'Asia/Bangkok': 'TH',
    'Asia/Manila': 'PH',
    'Asia/Ho_Chi_Minh': 'VN',
    'Asia/Tokyo': 'JP',
    'Asia/Seoul': 'KR',
    'Asia/Kolkata': 'IN',
    'Asia/Dubai': 'AE',
    'Europe/London': 'GB',
    'Europe/Paris': 'FR',
    'Europe/Berlin': 'DE',
    'Europe/Amsterdam': 'NL',
    'Europe/Madrid': 'ES',
    'Europe/Rome': 'IT',
    'Europe/Warsaw': 'PL',
    'Europe/Moscow': 'RU',
    'Australia/Sydney': 'AU',
    'Pacific/Auckland': 'NZ',
    'America/New_York': 'US',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'America/Los_Angeles': 'US',
    'America/Toronto': 'CA',
    'America/Mexico_City': 'MX',
    'America/Sao_Paulo': 'BR',
    'Africa/Johannesburg': 'ZA',
    'Africa/Lagos': 'NG',
    'Africa/Nairobi': 'KE',
  };
  return normalizeCountry(map[zone] ?? null);
}

export async function GET(request: Request) {
  const headers = request.headers;
  const url = new URL(request.url);

  const countryCode =
    normalizeCountry(headers.get('x-vercel-ip-country')) ??
    normalizeCountry(headers.get('cf-ipcountry')) ??
    fromTimeZone(url.searchParams.get('timezone')) ??
    fromAcceptLanguage(url.searchParams.get('language')) ??
    fromAcceptLanguage(headers.get('accept-language')) ??
    fromLanguage(url.searchParams.get('language')) ??
    fromLanguage(headers.get('accept-language'));

  return NextResponse.json(
    { country_code: countryCode },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
