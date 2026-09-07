import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Single source of truth for Owner authorization.
    const { data: isOwner, error: ownerError } =
      await supabase.rpc('nextgen_is_owner');

    if (ownerError) {
      console.error('Owner check error:', ownerError);

      return NextResponse.json(
        {
          success: false,
          error: 'OWNER_CHECK_FAILED',
        },
        { status: 500 }
      );
    }

    if (isOwner !== true) {
      return NextResponse.json(
        {
          success: false,
          error: 'OWNER_ONLY',
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const targetIdentifier =
      typeof body.targetUserId === 'string'
        ? body.targetUserId.trim()
        : '';

    const note =
      typeof body.note === 'string'
        ? body.note.trim()
        : '';

    const delta = Number(body.delta);

    if (!targetIdentifier) {
      return NextResponse.json(
        {
          success: false,
          error: 'TARGET_USER_REQUIRED',
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(delta) || delta === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_DIAMOND_AMOUNT',
        },
        { status: 400 }
      );
    }

    if (Math.abs(delta) > 1000000000000) {
      return NextResponse.json(
        {
          success: false,
          error: 'DIAMOND_AMOUNT_TOO_LARGE',
        },
        { status: 400 }
      );
    }

    if (note.length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOTE_REQUIRED',
        },
        { status: 400 }
      );
    }

    if (note.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOTE_TOO_LONG',
        },
        { status: 400 }
      );
    }

    /*
     * Resolve username -> Auth UUID inside protected
     * SECURITY DEFINER RPC.
     *
     * UUID is also accepted for backward compatibility.
     */
    const {
      data: resolvedUserId,
      error: resolveError,
    } = await supabase.rpc(
      'nextgen_owner_resolve_user',
      {
        p_identifier: targetIdentifier,
      }
    );

    if (resolveError || !resolvedUserId) {
      console.error(
        'Owner target resolution error:',
        resolveError
      );

      const resolverMessage =
        resolveError?.message || '';

      let errorCode = 'TARGET_USER_NOT_FOUND';

      if (
        resolverMessage.includes(
          'AMBIGUOUS_TARGET_USERNAME'
        )
      ) {
        errorCode = 'AMBIGUOUS_TARGET_USERNAME';
      } else if (
        resolverMessage.includes(
          'OWNER_ONLY'
        )
      ) {
        errorCode = 'OWNER_ONLY';
      } else if (
        resolverMessage.includes(
          'AUTH_REQUIRED'
        )
      ) {
        errorCode = 'AUTH_REQUIRED';
      }

      return NextResponse.json(
        {
          success: false,
          error: errorCode,
        },
        { status: 400 }
      );
    }

    /*
     * Existing protected Owner RPC remains the only
     * operation allowed to change the Diamond balance.
     */
    const {
      data,
      error,
    } = await supabase.rpc(
      'nextgen_owner_adjust_diamond',
      {
        p_target_user_id: resolvedUserId,
        p_delta: delta,
        p_note: note,
      }
    );

    if (error) {
      console.error(
        'Owner Diamond RPC error:',
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
            'OWNER_RPC_FAILED',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      auditId: data,
      diamondDelta: delta,
    });
  } catch (error) {
    console.error(
      'Owner Diamond API error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
