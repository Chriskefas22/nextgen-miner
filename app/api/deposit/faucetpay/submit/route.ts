import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_NETWORKS: Record<string, string[]> = {
  BTC: ["Bitcoin Chain"],
  ETH: ["Ethereum Chain"],
  BCH: ["Bitcoin Cash Chain"],
  ADA: ["Cardano Chain"],
  DASH: ["Dash Chain"],
  DGB: ["DigiByte Chain"],
  DOGE: ["Dogecoin Chain"],
  LTC: ["Litecoin Chain"],
  XMR: ["Monero Chain"],
  POL: ["Polygon PoS"],
  SOL: ["Solana Chain"],
  TON: ["TON Chain"],
  TRX: ["TRON / TRC20"],
  USDT: [
    "TRC20 / TRON",
    "Polygon PoS",
    "ERC20 / Ethereum",
    "BEP20 / BNB Chain",
  ],
  BNB: ["BNB Chain"],
};

type SubmitBody = {
  asset?: unknown;
  network?: unknown;
  amount?: unknown;
  usdAmount?: unknown;
  txHash?: unknown;
  destinationId?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    let body: SubmitBody;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request" },
        { status: 400 },
      );
    }

    const asset = text(body.asset).toUpperCase();
    const network = text(body.network);
    const txHash = text(body.txHash);
    const amount = Number(body.amount);
    const usdAmount = Number(body.usdAmount);
    const destinationId =
      body.destinationId == null
        ? null
        : Number(body.destinationId);

    if (!asset || !ALLOWED_NETWORKS[asset]) {
      return NextResponse.json(
        { error: "Unsupported deposit asset" },
        { status: 400 },
      );
    }

    if (!ALLOWED_NETWORKS[asset].includes(network)) {
      return NextResponse.json(
        { error: "Invalid network for selected asset" },
        { status: 400 },
      );
    }

    if (!positiveNumber(amount)) {
      return NextResponse.json(
        { error: "Invalid crypto amount" },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(usdAmount) ||
      usdAmount < 0.01 ||
      usdAmount > 100000
    ) {
      return NextResponse.json(
        { error: "Deposit amount is outside the allowed range" },
        { status: 400 },
      );
    }

    if (txHash.length < 8 || txHash.length > 256) {
      return NextResponse.json(
        { error: "Invalid transaction hash" },
        { status: 400 },
      );
    }

    if (
      destinationId !== null &&
      (!Number.isInteger(destinationId) ||
        destinationId <= 0)
    ) {
      return NextResponse.json(
        { error: "Invalid destination" },
        { status: 400 },
      );
    }

    /*
     * The browser never receives permission to credit the wallet.
     *
     * nextgen_submit_deposit:
     * - requires authenticated user
     * - validates destination
     * - calculates Diamond server-side
     * - creates PENDING deposit
     * - does NOT credit wallet
     */
    const { data, error } = await supabase.rpc(
      "nextgen_submit_deposit",
      {
        p_asset: asset,
        p_network: network,
        p_amount: amount,
        p_usd_amount: usdAmount,
        p_tx_hash: txHash,
        p_destination_id: destinationId,
      },
    );

    if (error) {
      console.error("Deposit submission failed:", error);

      return NextResponse.json(
        { error: "Unable to submit deposit" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      status: "pending",
      depositId: data,
      message:
        "Deposit submitted successfully and is pending manual verification.",
    });
  } catch (error) {
    console.error("Deposit API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
