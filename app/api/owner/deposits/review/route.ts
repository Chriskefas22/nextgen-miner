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

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;

    const depositId = Number(input.depositId);

    const action =
      typeof input.action === 'string'
        ? input.action.trim().toLowerCase()
        : '';

    const note =
      typeof input.note === 'string'
        ? input.note.trim()
        : '';

    if (!Number.isSafeInteger(depositId) || depositId < 1) {
      return NextResponse.json(
        { success: false, error: 'INVALID_DEPOSIT_ID' },
        { status: 400 }
      );
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { success: false, error: 'INVALID_REVIEW_ACTION' },
        { status: 400 }
      );
    }

    if (note.length > 500) {
      return NextResponse.json(
        { success: false, error: 'NOTE_TOO_LONG' },
        { status: 400 }
      );
    }

    const { error } = await supabase.rpc(
      'nextgen_admin_review_deposit',
      {
        p_deposit_id: depositId,
        p_approve: action === 'approve',
        p_note: note || null,
      }
    );

    if (error) {
      console.error('Deposit review RPC failed:', error);

      return NextResponse.json(
        {
          success: false,
          error: error.message || 'DEPOSIT_REVIEW_FAILED',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      depositId,
      action,
    });
  } catch (error) {
    console.error('Deposit review API error:', error);

    return NextResponse.json(
      { success: false, error: 'INTERNAL_SERVER_ERROR' },
      { status: 500 }
    );
  }
}
