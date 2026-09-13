import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

const OFFER_API = "https://offer-api.adgem.com/v1/offers";
const TOKEN_API = "https://targeted-api.adgem.com/v1/users/token";

function str(v: unknown): string { return String(v ?? "").trim(); }
function num(v: unknown): number { return Number(v); }

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method !== "POST") return new Response("METHOD_NOT_ALLOWED", { status: 405 });
    const syncToken = (Deno.env.get("ADGEM_SYNC_TOKEN") ?? "").trim();
    const presented = (req.headers.get("X-AdGem-Sync-Token") ?? "").trim();
    if (!syncToken) return new Response("SYNC_NOT_CONFIGURED", { status: 503 });
    if (!presented || presented !== syncToken) return new Response("UNAUTHORIZED", { status: 401 });

    const refreshToken = (Deno.env.get("ADGEM_REFRESH_TOKEN") ?? "").trim();
    if (!refreshToken) return new Response("ADGEM_REFRESH_TOKEN_NOT_CONFIGURED", { status: 503 });

    const tokenResp = await fetch(TOKEN_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    if (!tokenResp.ok) return new Response("ADGEM_TOKEN_EXCHANGE_FAILED", { status: 502 });
    const tokenJson = await tokenResp.json();
    const accessToken = str(tokenJson?.access_token);
    if (!accessToken) return new Response("ADGEM_ACCESS_TOKEN_MISSING", { status: 502 });

    const offerResp = await fetch(`${OFFER_API}?per_page=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!offerResp.ok) return new Response("ADGEM_OFFER_API_FAILED", { status: 502 });
    const offerJson = await offerResp.json();
    const offers = Array.isArray(offerJson?.data?.offers) ? offerJson.data.offers : [];

    const { data: provider, error: providerError } = await ctx.supabaseAdmin
      .from("nextgen_offer_providers")
      .select("id,enabled")
      .eq("provider_key", "adgem")
      .maybeSingle();
    if (providerError || !provider) return new Response("ADGEM_PROVIDER_ROW_MISSING", { status: 500 });

    let upserted = 0;
    for (const offer of offers) {
      const externalOfferId = str(offer?.campaign_id);
      const title = str(offer?.name);
      const description = str(offer?.creatives?.description ?? offer?.name);
      const clickUrl = str(offer?.links?.click_url);
      const payout = num(offer?.total_payout_usd);
      const active = String(offer?.status ?? "active").toLowerCase() === "active";
      if (!externalOfferId || !title || !clickUrl || !Number.isFinite(payout) || payout <= 0) continue;

      const { error } = await ctx.supabaseAdmin.from("nextgen_offers").upsert({
        provider_id: provider.id,
        external_offer_id: externalOfferId,
        title,
        description: description || null,
        target_url: clickUrl,
        revenue_usd: payout,
        reward_share_bps: 2500,
        enabled: Boolean(provider.enabled) && active,
      }, { onConflict: "provider_id,external_offer_id" });
      if (error) return new Response("ADGEM_CATALOG_UPSERT_FAILED", { status: 500 });
      upserted++;
    }

    return Response.json({ ok: true, provider_enabled: provider.enabled, received_offers: offers.length, upserted });
  }),
};
