import {
  createServerClient,
} from '@supabase/ssr';

import {
  NextResponse,
  type NextRequest,
} from 'next/server';

export async function updateSession(
  request: NextRequest
) {
  let supabaseResponse =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet,
            headers
          ) {
            cookiesToSet.forEach(
              ({ name, value }) => {
                request.cookies.set(
                  name,
                  value
                );
              }
            );

            supabaseResponse =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                supabaseResponse.cookies.set(
                  name,
                  value,
                  options
                );
              }
            );

            Object.entries(
              headers || {}
            ).forEach(
              ([key, value]) => {
                supabaseResponse.headers.set(
                  key,
                  value
                );
              }
            );
          },
        },
      }
    );

  /*
   * Refresh/validate the Supabase Auth
   * session before Server Components run.
   */
  await supabase.auth.getClaims();

  /*
   * Security headers previously provided
   * by middleware.ts.
   */
  supabaseResponse.headers.set(
    'x-content-type-options',
    'nosniff'
  );

  supabaseResponse.headers.set(
    'x-frame-options',
    'SAMEORIGIN'
  );

  supabaseResponse.headers.set(
    'referrer-policy',
    'strict-origin-when-cross-origin'
  );

  return supabaseResponse;
}
