import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER_EMAIL = 'minernextgen@gmail.com';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Pastikan ada session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    // 2. Owner harus email yang ditentukan
    if (
      (user.email || '').trim().toLowerCase() !==
      OWNER_EMAIL
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'OWNER_ONLY',
        },
        { status: 403 }
      );
    }

    // 3. Baca request body
    const body = await request.json();

    const targetUserId =
      typeof body.targetUserId === 'string'
        ? body.targetUserId.trim()
        : '';

    const note =
      typeof body.note === 'string'
        ? body.note.trim()
        : '';

    const delta = Number(body.delta);

    // 4. Validasi target user
    if (!targetUserId) {
      return NextResponse.json(
        {
          success: false,
          error: 'TARGET_USER_REQUIRED',
        },
        { status: 400 }
      );
    }

    // UUID validation sederhana
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(targetUserId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_TARGET_USER_ID',
        },
        { status: 400 }
      );
    }

    // 5. Validasi Diamond
    if (
      !Number.isFinite(delta) ||
      delta === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_DIAMOND_AMOUNT',
        },
        { status: 400 }
      );
    }

    // Batasi perubahan maksimal per request
    // untuk mencegah kesalahan input besar secara tidak sengaja.
    if (Math.abs(delta) > 1000000000000) {
      return NextResponse.json(
        {
          success: false,
          error: 'DIAMOND_AMOUNT_TOO_LARGE',
        },
        { status: 400 }
      );
    }

    // 6. Catatan wajib
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

    // 7. Panggil protected Owner RPC.
    // Browser TIDAK mengubah wallet secara langsung.
    const { data, error } = await supabase.rpc(
      'nextgen_owner_adjust_diamond',
      {
        p_target_user_id: targetUserId,
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
          error: error.message || 'OWNER_RPC_FAILED',
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
