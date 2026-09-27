import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getTelegramChannelUsername,
  getTelegramQuestMessageId,
  isTelegramQuestConfigured,
  verifyTelegramLoginPayload,
  type TelegramLoginPayload,
} from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  if (!isTelegramQuestConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "TELEGRAM_VERIFICATION_NOT_CONFIGURED",
        channel: getTelegramChannelUsername(),
        message_id: getTelegramQuestMessageId(),
      },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as TelegramLoginPayload;
  const verification = verifyTelegramLoginPayload(payload);

  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, error: verification.reason },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  const { data: conflict, error: conflictError } = await service
    .from("nextgen_telegram_links")
    .select("user_id")
    .eq("telegram_user_id", verification.userId)
    .neq("user_id", user.id)
    .maybeSingle();

  if (conflictError) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_LINK_READ_FAILED", detail: conflictError.message },
      { status: 500 },
    );
  }

  if (conflict?.user_id) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_ACCOUNT_ALREADY_LINKED" },
      { status: 409 },
    );
  }

  const displayName = [verification.firstName, verification.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const { error } = await service
    .from("nextgen_telegram_links")
    .upsert(
      {
        user_id: user.id,
        telegram_user_id: verification.userId,
        username: verification.username || null,
        display_name: displayName || null,
        photo_url: verification.photoUrl || null,
        joined_at: null,
        verified_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_LINK_SAVE_FAILED", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    telegram_user_id: verification.userId,
    username: verification.username,
  });
}
