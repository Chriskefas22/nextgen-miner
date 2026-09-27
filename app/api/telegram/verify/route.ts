import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getTelegramChannelUsername,
  getTelegramQuestMessageId,
  getTelegramQuestPostUrl,
  isActiveTelegramMember,
  isTelegramQuestConfigured,
  telegramBotApi,
} from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST() {
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

  const service = createServiceClient();
  const { data: link, error: linkError } = await service
    .from("nextgen_telegram_links")
    .select("telegram_user_id, username, joined_at, verified_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (linkError) {
    return NextResponse.json(
      {
        ok: false,
        error: "TELEGRAM_LINK_READ_FAILED",
        detail: linkError.message,
      },
      { status: 500 },
    );
  }

  if (!link) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_NOT_CONNECTED" },
      { status: 400 },
    );
  }

  const messageId = getTelegramQuestMessageId();
  const channel = getTelegramChannelUsername();

  if (!isTelegramQuestConfigured() || !messageId) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_VERIFICATION_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let joined = false;

  try {
    const member = await telegramBotApi<{
      status?: string;
      is_member?: boolean;
    }>("getChatMember", {
      chat_id: `@${channel}`,
      user_id: Number(link.telegram_user_id),
    });

    joined = isActiveTelegramMember(member);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "TELEGRAM_MEMBERSHIP_CHECK_FAILED",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }

  const { data: reaction, error: reactionError } = await service
    .from("nextgen_telegram_reactions")
    .select("liked")
    .eq("telegram_user_id", Number(link.telegram_user_id))
    .eq("chat_username", channel)
    .eq("message_id", messageId)
    .maybeSingle();

  if (reactionError) {
    return NextResponse.json(
      {
        ok: false,
        error: "TELEGRAM_REACTION_READ_FAILED",
        detail: reactionError.message,
      },
      { status: 500 },
    );
  }

  const liked = reaction?.liked === true;
  const verified = joined && liked;
  const now = new Date().toISOString();

  const { error: updateError } = await service
    .from("nextgen_telegram_links")
    .update({
      joined_at: joined ? link.joined_at || now : link.joined_at,
      verified_at: verified ? now : null,
      updated_at: now,
    })
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json(
      {
        ok: false,
        error: "TELEGRAM_STATUS_SAVE_FAILED",
        detail: updateError.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    joined,
    liked,
    verified,
    reward_ready: verified,
    channel,
    post_url: getTelegramQuestPostUrl(),
  });
}
