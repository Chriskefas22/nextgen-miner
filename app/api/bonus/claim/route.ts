import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHENTICATED' },
      { status: 401 },
    );
  }

  const { data, error } = await supabase.rpc(
    'nextgen_claim_registration_bonus',
    { p_user_id: userId },
  );

  if (error) {
    console.error('Registration bonus claim failed:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'BONUS_CLAIM_FAILED' },
      { status: 400 },
    );
  }

  return NextResponse.json(data ?? { ok: true });
}
