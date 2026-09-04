import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const DIAMOND_PER_USD = 10000;

const ALLOWED_ASSETS = new Set([
  "BTC",
  "ETH",
  "BCH",
  "ADA",
  "DASH",
  "DGB",
  "DOGE",
  "LTC",
  "XMR",
  "POL",
  "SOL",
  "TON",
  "TRX",
  "USDT",
  "BNB",
]);

const ALLOWED_NETWORKS = new Set([
  "Bitcoin Chain",
  "Ethereum Chain",
  "Bitcoin Cash Chain",
  "Cardano Chain",
  "Dash Chain",
  "DigiByte Chain",
  "Dogecoin Chain",
  "Litecoin Chain",
  "Monero Chain",
  "Polygon PoS",
  "Solana Chain",
  "TON Chain",
  "TRON / TRC20",
  "TRC20",
  "Polygon",
  "ERC20",
  "BEP20",
  "BNB Chain",
]);

export async function POST(request: Request) {
  try {
    /*
     * 1. Authenticate the user through the normal Supabase session.
     */
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    /*
     * 2. Read request body.
     */
    const body = await request.json();

    const asset = String(body.asset ?? "").trim().toUpperCase();
    const network = String(body.network ?? "").trim();

    const amount = Number(body.amount);
    const usdAmount = Number(body.usdAmount);

    const txHash = String(body.txHash ?? "").trim();

    /*
     * 3. Basic validation.
     */
    if (!asset || !network || !txHash) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_REQUIRED_FIELDS",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_ASSETS.has(asset)) {
      return NextResponse.json(
        {
          ok: false,
          error: "UNSUPPORTED_ASSET",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_NETWORKS.has(network)) {
      return NextResponse.json(
        {
          ok: false,
          error: "UNSUPPORTED_NETWORK",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_AMOUNT",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(usdAmount) || usdAmount < 0.01) {
      return NextResponse.json(
        {
          ok: false,
          error: "MIN_DEPOSIT_$0.01",
        },
        { status: 400 }
      );
    }

    if (txHash.length < 8 || txHash.length > 256) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_TX_HASH",
        },
        { status: 400 }
      );
    }

    /*
     * 4. Diamond amount is calculated SERVER-SIDE.
     *
     * Never trust the diamond amount sent by the browser.
     */
    const diamondAmount = usdAmount * DIAMOND_PER_USD;

    /*
     * 5. Service-role client is used only for protected server-side
     * duplicate checking.
     */
    const service = createServiceClient();

    const { data: existingDeposit, error: duplicateError } =
      await service
        .from("nextgen_deposits")
        .select("id,user_id,status")
        .eq("tx_hash", txHash)
        .maybeSingle();

    if (duplicateError) {
      console.error("Deposit duplicate check failed:", duplicateError);

      return NextResponse.json(
        {
          ok: false,
          error: "DEPOSIT_CHECK_FAILED",
        },
        { status: 500 }
      );
    }

    if (existingDeposit) {
      return NextResponse.json(
        {
          ok: false,
          error: "TX_HASH_ALREADY_SUBMITTED",
          deposit_id: existingDeposit.id,
          status: existingDeposit.status,
        },
        { status: 409 }
      );
    }

    /*
     * 6. Call the existing protected deposit RPC.
     *
     * IMPORTANT:
     * The RPC itself does NOT credit the wallet.
     * It creates the pending deposit record.
     */
    const { data, error } = await supabase.rpc(
      "nextgen_request_deposit",
      {
        p_asset: asset,
        p_network: network,
        p_amount: amount,
        p_usd_amount: usdAmount,
        p_diamond_amount: diamondAmount,
        p_tx_hash: txHash,
      }
    );

    if (error) {
      console.error("nextgen_request_deposit failed:", error);

      return NextResponse.json(
        {
          ok: false,
          error: "DEPOSIT_REQUEST_FAILED",
          detail: error.message,
        },
        { status: 400 }
      );
    }

    /*
     * 7. Return pending deposit information.
     */
    return NextResponse.json(
      {
        ok: true,
        deposit: data,
        status: "pending",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Deposit submit API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
