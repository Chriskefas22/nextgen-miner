import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
}

function safeEqual(a: string, b: string): boolean {
  const aa = new TextEncoder().encode(a.toLowerCase());
  const bb = new TextEncoder().encode(b.toLowerCase());
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method !== "POST") return new Response("METHOD_NOT_ALLOWED", { status: 405 });

    const signature = (req.headers.get("Signature") ?? "").trim();
    const secret = (Deno.env.get("ADGEM_POSTBACK_KEY") ?? "").trim();
    if (!secret) return new Response("PROVIDER_NOT_CONFIGURED", { status: 503 });
    if (!signature) return new Response("SIGNATURE_REQUIRED", { status: 401 });

    const rawBody = await req.text();
    if (rawBody.length === 0 || rawBody.length > 262144) return new Response("INVALID_BODY", { status: 400 });

    const expected = await hmacSha256Hex(secret, rawBody);
    const received = signature.startsWith("sha256=") ? signature.slice(7) : signature;
    if (!safeEqual(expected, received)) return new Response("INVALID_SIGNATURE", { status: 401 });

    let payload: any;
    try { payload = JSON.parse(rawBody); } catch { return new Response("INVALID_JSON", { status: 400 }); }

    const data = payload?.data ?? {};
    const conversionType = String(data?.conversion_type ?? "reward").toLowerCase();
    if (conversionType === "install") return Response.json({ ok: true, ignored: true, reason: "NON_REWARD_EVENT" });
    if (conversionType !== "reward") return new Response("UNSUPPORTED_CONVERSION_TYPE", { status: 422 });

    const requestId = String(payload?.request_id ?? "").trim();
    const conversionId = String(data?.conversion_id ?? "").trim();
    const playerId = String(data?.player_id ?? "").trim();
    const campaignId = String(data?.campaign_id ?? "").trim();
    const payout = Number(data?.payout);
    const amount = Number(data?.amount);
    const eventTimestamp = Number(payload?.timestamp);

    if (!requestId || !conversionId || !playerId || !campaignId) return new Response("REQUIRED_FIELDS_MISSING", { status: 400 });
    if (!Number.isFinite(payout) || payout <= 0 || !Number.isFinite(amount) || amount <= 0) return new Response("INVALID_REWARD_VALUES", { status: 422 });
    if (!Number.isInteger(eventTimestamp) || eventTimestamp <= 0) return new Response("INVALID_TIMESTAMP", { status: 422 });

    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(playerId)) return new Response("PLAYER_ID_MUST_BE_USER_UUID", { status: 422 });

    const { data: result, error } = await ctx.supabaseAdmin.rpc("nextgen_process_adgem_reward", {
      p_request_id: requestId,
      p_conversion_id: conversionId,
      p_player_id: playerId,
      p_campaign_id: campaignId,
      p_payout_usd: payout,
      p_amount_diamond: amount,
      p_event_timestamp: eventTimestamp,
      p_payload: payload,
    });

    if (error) {
      console.error("AdGem RPC rejected", { code: error.code, message: error.message });
      return new Response(error.message || "REWARD_REJECTED", { status: 422 });
    }
    return Response.json(result);
  }),
};
