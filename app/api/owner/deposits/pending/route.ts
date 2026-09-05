import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const { data: isOwner, error: ownerError } =
      await supabase.rpc('nextgen_is_owner');

    if (ownerError) {
      console.error('Owner check failed:', ownerError);

      return NextResponse.json(
        { success: false, error: 'OWNER_CHECK_FAILED' },
        { status: 500 }
      );
    }

    if (isOwner !== true) {
      return NextResponse.json(
        { success: false, error: 'OWNER_ONLY' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get('limit') ?? '100');

    const limit = Number.isInteger(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 200)
      : 100;

    const { data, error } = await supabase.rpc(
      'nextgen_owner_pending_deposits',
      {
        p_limit: limit,
      }
    );

    if (error) {
      console.error('Pending deposits RPC failed:', error);

      return NextResponse.json(
        {
          success: false,
          error: error.message || 'PENDING_DEPOSITS_FAILED',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      deposits: data ?? [],
    });
  } catch (error) {
    console.error('Pending deposits API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
