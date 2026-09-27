import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function normalizeUsername(value: string | undefined | null) {
  return String(value ?? "").trim().replace(/^@/, "").toLowerCase();
}

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

export function getTelegramChannelUsername() {
  return normalizeUsername(
    process.env.TELEGRAM_CHANNEL_USERNAME || "nextgenminerapp",
  );
}

export function getTelegramChannelUrl() {
  const configured = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL?.trim();
  return configured || `https://t.me/${getTelegramChannelUsername()}`;
}

export function getTelegramBotUsername() {
  return normalizeUsername(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME);
}

export function getTelegramQuestMessageId() {
  const raw = process.env.TELEGRAM_QUEST_MESSAGE_ID?.trim() ?? "";
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getTelegramQuestReactionEmoji() {
  return process.env.TELEGRAM_QUEST_REACTION_EMOJI?.trim() || "👍";
}

export function getTelegramQuestPostUrl() {
  const configured = process.env.NEXT_PUBLIC_TELEGRAM_QUEST_POST_URL?.trim();
  if (configured) return configured;

  const messageId = getTelegramQuestMessageId();
  return messageId
    ? `https://t.me/${getTelegramChannelUsername()}/${messageId}`
    : getTelegramChannelUrl();
}

export function isTelegramQuestConfigured() {
  return Boolean(
    getBotToken() &&
      getTelegramBotUsername() &&
      getTelegramQuestMessageId() &&
      process.env.TELEGRAM_WEBHOOK_SECRET?.trim(),
  );
}

export type TelegramLoginPayload = {
  id?: string | number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: string | number;
  hash?: string;
};

export function verifyTelegramLoginPayload(
  payload: TelegramLoginPayload,
):
  | {
      ok: true;
      userId: number;
      username: string;
      firstName: string;
      lastName: string;
      photoUrl: string;
    }
  | { ok: false; reason: string } {
  const token = getBotToken();
  if (!token) return { ok: false, reason: "TELEGRAM_BOT_NOT_CONFIGURED" };

  const userId = Number(payload.id);
  const authDate = Number(payload.auth_date);
  const hash = String(payload.hash ?? "").trim().toLowerCase();

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return { ok: false, reason: "INVALID_TELEGRAM_USER" };
  }

  if (!Number.isInteger(authDate) || authDate <= 0 || !hash) {
    return { ok: false, reason: "INVALID_TELEGRAM_AUTH_PAYLOAD" };
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds < -300 || ageSeconds > 24 * 60 * 60) {
    return { ok: false, reason: "TELEGRAM_AUTH_EXPIRED" };
  }

  const entries = Object.entries(payload)
    .filter(
      ([key, value]) =>
        key !== "hash" &&
        value !== undefined &&
        value !== null &&
        value !== "",
    )
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  const dataCheckString = entries
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHash("sha256").update(token).digest();
  const expected = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const actualBuffer = Buffer.from(hash, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { ok: false, reason: "TELEGRAM_AUTH_INVALID" };
  }

  return {
    ok: true,
    userId,
    username: normalizeUsername(payload.username),
    firstName: String(payload.first_name ?? "").trim(),
    lastName: String(payload.last_name ?? "").trim(),
    photoUrl: String(payload.photo_url ?? "").trim(),
  };
}

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export async function telegramBotApi<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = getBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_NOT_CONFIGURED");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );

  const json = (await response.json()) as TelegramApiResponse<T>;
  if (!response.ok || !json.ok || json.result === undefined) {
    throw new Error(json.description || `TELEGRAM_API_${response.status}`);
  }

  return json.result;
}

export function isActiveTelegramMember(member: {
  status?: string;
  is_member?: boolean;
}) {
  return (
    member.status === "creator" ||
    member.status === "administrator" ||
    member.status === "member" ||
    (member.status === "restricted" && member.is_member === true)
  );
}

export function reactionContainsRequiredEmoji(
  reactions: unknown,
  expectedEmoji = getTelegramQuestReactionEmoji(),
) {
  if (!Array.isArray(reactions)) return false;

  return reactions.some((reaction) => {
    if (!reaction || typeof reaction !== "object") return false;

    const item = reaction as {
      type?: string;
      emoji?: string;
    };

    return item.type === "emoji" && item.emoji === expectedEmoji;
  });
}
