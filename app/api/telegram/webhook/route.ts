import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getTelegramChannelUsername,
  getTelegramQuestMessageId,
  getTelegramQuestReactionEmoji,
  reactionContainsRequiredEmoji,
} from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const update = (await request.json()) as {
    message_reaction?: {
      chat?: { id?: number; username?: string };
      message_id?: number;
      user?: { id?: number };
      new_reaction?: unknown;
    };
  };

  const reaction = update.message_reaction;
  const messageId = getTelegramQuestMessageId();

  if (!reaction || !messageId) {
    return NextResponse.json({ ok: true });
  }

  const channel = getTelegramChannelUsername();
  const chatUsername = String(reaction.chat?.username ?? "")
    .replace(/^@/, "")
    .toLowerCase();

  if (
    reaction.message_id !== messageId ||
    chatUsername !== channel ||
    !Number.isSafeInteger(Number(reaction.user?.id))
  ) {
    return NextResponse.json({ ok: true });
  }

  const telegramUserId = Number(reaction.user?.id);
  const liked = reactionContainsRequiredEmoji(
    reaction.new_reaction,
    getTelegramQuestReactionEmoji(),
  );

  const service = createServiceClient();

  const { error } = await service
    .from("nextgen_telegram_reactions")
    .upsert(
      {
        telegram_user_id: telegramUserId,
        chat_username: channel,
        message_id: messageId,
        liked,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "telegram_user_id,chat_username,message_id",
      },
    );

  if (error) {
    return new NextResponse("Webhook database error", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
