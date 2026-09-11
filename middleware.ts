import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const OLD_HOSTS = new Set([
  'nextgenminer.devs.surf',
  'www.nextgenminer.devs.surf',
]);
const CANONICAL_HOST = 'nextgen-miner.vercel.app';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase();

  if (host && OLD_HOSTS.has(host)) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = CANONICAL_HOST;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
