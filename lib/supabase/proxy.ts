import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const RETIRED_HOSTS = new Set([
  'nextgenminer.devs.surf',
  'www.nextgenminer.devs.surf',
]);

const CANONICAL_HOST = 'nextgen-miner.vercel.app';

export async function updateSession(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase();

  if (host && RETIRED_HOSTS.has(host)) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = CANONICAL_HOST;
    return NextResponse.redirect(url, 308);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getClaims();

  supabaseResponse.headers.set('x-content-type-options', 'nosniff');
  supabaseResponse.headers.set('x-frame-options', 'SAMEORIGIN');
  supabaseResponse.headers.set('referrer-policy', 'strict-origin-when-cross-origin');

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
