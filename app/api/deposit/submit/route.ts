import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUOTE_MAX_AGE_MS = 60_000;
const PRICE_TOLERANCE = 0.01; // 1%

/**
 * UI network label -> canonical Supabase network label.
 *
 * IMPORTANT:
 * The browser is allowed to send only the UI label.
 * The server converts it to the exact value used by
 * nextgen_deposit_destinations.
 */
const NETWORK_MAP: Record<string, Record<string, string>> = {
  BTC: {
    "Bitcoin Chain": "Bitcoin",
  },

  ETH: {
    "Ethereum Chain": "Ethereum",
  },

  BCH: {
    "Bitcoin Cash Chain": "Bitcoin Cash",
  },

  ADA: {
    "Cardano Chain": "Cardano",
  },

  DASH: {
    "Dash Chain": "Dash",
  },

  DGB: {
    "DigiByte Chain": "DigiByte",
  },

  DOGE: {
    "Dogecoin Chain": "Dogecoin",
  },

  LTC: {
    "Litecoin Chain": "Litecoin",
  },

  XMR: {
    "Monero Chain": "Monero",
  },

  POL: {
    "Polygon PoS": "Polygon PoS",
  },

  SOL: {
    "Solana Chain": "Solana",
  },

  TON: {
    "TON Chain": "TON",
  },

  TRX: {
    "TRON / TRC20": "TRC20 (Tron)",
  },

  USDT: {
    "TRC20 / TRON": "TRC20 (Tron)",
    "ERC20 / Ethereum": "ERC20 (Ethereum)",
    "BEP20 / BNB Chain": "BEP20 (BSC)",

    /*
     * USDT Polygon is intentionally NOT mapped here.
     *
     * There is currently no active USDT + Polygon PoS
     * destination in nextgen_deposit_destinations.
     *
     * Do NOT map it to the POL destination.
     */
  },

  BNB: {
    "BNB Chain": "BNB Smart Chain",
  },
};

/**
 * Expected CoinGecko IDs.
 *
 * The frontend also sends quoteId, but the server does not
 * blindly trust it. It is checked against this allowlist.
 */
const QUOTE_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BCH: "bitcoin-cash",
  ADA: "cardano",
  DASH: "dash",
  DGB: "digibyte",
  DOGE: "dogecoin",
  LTC: "litecoin",
  XMR: "monero",
  POL: "polygon-ecosystem-token",
  SOL: "solana",
  TON: "the-open-network",
  TRX: "tron",
  USDT: "tether",
  BNB: "binancecoin",
};

type SubmitBody = {
  asset?: unknown;
  network?: unknown;
  amount?: unknown;
  usdAmount?: unknown;
  txHash?: unknown;

  /*
   * Quote information comes from the browser only so the server
   * can verify what the user saw. The server independently fetches
   * the current quote below.
   */
  quoteId?: unknown;
  quotePrice?: unknown;
  quoteTimestamp?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finitePositiveNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

function isSafeNumeric(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isValidTxHash(value: string): boolean {
  return value.length >= 8 && value.length <= 256;
}

function nearlyEqual(
  actual: number,
  expected: number,
  tolerance: number,
): boolean {
  if (
    !Number.isFinite(actual) ||
    !Number.isFinite(expected) ||
    expected <= 0
  ) {
    return false;
  }

  const difference = Math.abs(actual - expected);
  return difference / expected <= tolerance;
}

async function getServerQuote(
  quoteId: string,
): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
        quoteId,
      )}&vs_currencies=usd`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(
        "CoinGecko quote request failed:",
        response.status,
      );

      return null;
    }

    const data = (await response.json()) as Record<
      string,
      { usd?: number }
    >;

    const price = Number(data?.[quoteId]?.usd);

    if (!Number.isFinite(price) || price <= 0) {
      return null;
    }

    return price;
  } catch (error) {
    console.error("CoinGecko quote error:", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. AUTHENTICATION
     * ---------------------------------------------------------
     */

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. READ REQUEST BODY
     * ---------------------------------------------------------
     */

    let body: SubmitBody;

    try {
      body = (await request.json()) as SubmitBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. NORMALIZE INPUT
     * ---------------------------------------------------------
     */

    const asset = text(body.asset).toUpperCase();
    const uiNetwork = text(body.network);
    const txHash = text(body.txHash);

    const amount = Number(body.amount);
    const usdAmount = Number(body.usdAmount);

    const quoteId = text(body.quoteId);
    const quotePrice = Number(body.quotePrice);
    const quoteTimestamp = Number(body.quoteTimestamp);

    /*
     * ---------------------------------------------------------
     * 4. VALIDATE ASSET
     * ---------------------------------------------------------
     */

    if (!asset || !NETWORK_MAP[asset]) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported deposit asset",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. VALIDATE UI NETWORK
     * ---------------------------------------------------------
     */

    const canonicalNetwork =
      NETWORK_MAP[asset][uiNetwork];

    if (!canonicalNetwork) {
      return NextResponse.json(
        {
          success: false,
          error:
            asset === "USDT" &&
            uiNetwork === "Polygon PoS"
              ? "USDT Polygon deposits are not enabled yet"
              : "Invalid network for selected asset",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. VALIDATE CRYPTO AMOUNT
     * ---------------------------------------------------------
     */

    if (!finitePositiveNumber(amount)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid crypto amount",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 7. VALIDATE USD AMOUNT
     * ---------------------------------------------------------
     *
     * The canonical RPC currently enforces the economy setting.
     * We additionally keep a reasonable API boundary here.
     */

    if (
      !Number.isFinite(usdAmount) ||
      usdAmount < 0.01 ||
      usdAmount > 100000
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Deposit amount is outside the allowed range",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. VALIDATE TX HASH
     * ---------------------------------------------------------
     */

    if (!isValidTxHash(txHash)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid transaction hash",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 9. VALIDATE QUOTE ID
     * ---------------------------------------------------------
     */

    const expectedQuoteId = QUOTE_IDS[asset];

    if (!expectedQuoteId || quoteId !== expectedQuoteId) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid price quote",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 10. VALIDATE CLIENT QUOTE
     * ---------------------------------------------------------
     */

    if (!isSafeNumeric(quotePrice)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid price quote",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(quoteTimestamp) ||
      quoteTimestamp <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid quote timestamp",
        },
        { status: 400 },
      );
    }

    const quoteAge =
      Date.now() - quoteTimestamp;

    if (
      quoteAge < -10_000 ||
      quoteAge > QUOTE_MAX_AGE_MS
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Price quote expired. Please refresh the deposit quote.",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 11. SERVER-SIDE PRICE VERIFICATION
     * ---------------------------------------------------------
     *
     * The browser quote is NOT trusted for the financial
     * calculation.
     *
     * We independently request the current CoinGecko price.
     */

    const serverPrice =
      await getServerQuote(expectedQuoteId);

    if (!serverPrice) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify the current crypto price. Please try again.",
        },
        { status: 503 },
      );
    }

    /*
     * The client quote must be close to the server quote.
     * This prevents a user from changing quotePrice manually.
     */

    if (
      !nearlyEqual(
        quotePrice,
        serverPrice,
        PRICE_TOLERANCE,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Crypto price changed. Please refresh the quote and try again.",
        },
        { status: 409 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 12. VERIFY CRYPTO AMOUNT
     * ---------------------------------------------------------
     *
     * Expected:
     *
     * crypto amount = USD amount / server USD price
     */

    const expectedCryptoAmount =
      usdAmount / serverPrice;

    if (
      !Number.isFinite(expectedCryptoAmount) ||
      expectedCryptoAmount <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to calculate the deposit amount.",
        },
        { status: 400 },
      );
    }

    /*
     * Allow a small tolerance for display/rounding differences.
     */

    if (
      !nearlyEqual(
        amount,
        expectedCryptoAmount,
        PRICE_TOLERANCE,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Crypto amount does not match the current USD quote.",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 13. FIND ACTIVE DESTINATION SERVER-SIDE
     * ---------------------------------------------------------
     *
     * IMPORTANT:
     * destinationId is deliberately NOT accepted from the
     * browser.
     *
     * The server resolves the destination using:
     *
     *   asset + canonical network
     */

    const {
      data: destination,
      error: destinationError,
    } = await supabase
      .from("nextgen_deposit_destinations")
      .select(
        "id, asset, network, active, is_active",
      )
      .eq("asset", asset)
      .eq("network", canonicalNetwork)
      .eq("active", true)
      .eq("is_active", true)
      .maybeSingle();

    if (destinationError) {
      console.error(
        "Deposit destination lookup failed:",
        destinationError,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify the selected deposit destination.",
        },
        { status: 503 },
      );
    }

    if (!destination?.id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Selected deposit destination is not currently available.",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 14. DUPLICATE TX HASH CHECK
     * ---------------------------------------------------------
     *
     * We check before calling the RPC.
     */

    const {
      data: existingDeposit,
      error: duplicateCheckError,
    } = await supabase
      .from("nextgen_deposits")
      .select("id, status, user_id")
      .eq("tx_hash", txHash)
      .limit(1)
      .maybeSingle();

    if (duplicateCheckError) {
      console.error(
        "Deposit duplicate check failed:",
        duplicateCheckError,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify transaction status.",
        },
        { status: 503 },
      );
    }

    if (existingDeposit) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This transaction hash has already been submitted.",
        },
        { status: 409 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 15. CALL CANONICAL SUPABASE RPC
     * ---------------------------------------------------------
     *
     * The RPC is responsible for:
     *
     * - authentication
     * - final deposit validation
     * - destination validation
     * - Diamond calculation
     * - creation of PENDING deposit
     *
     * It does NOT credit the wallet.
     */

    const {
      data: depositId,
      error: submitError,
    } = await supabase.rpc(
      "nextgen_submit_deposit",
      {
        p_asset: asset,
        p_network: canonicalNetwork,
        p_amount: amount,
        p_usd_amount: usdAmount,
        p_tx_hash: txHash,
        p_destination_id: destination.id,
      },
    );

    if (submitError) {
      console.error(
        "nextgen_submit_deposit failed:",
        submitError,
      );

      /*
       * Keep database/RPC errors hidden from the browser.
       * This prevents leaking internal database details.
       */

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to submit deposit. Please verify the amount and destination.",
        },
        { status: 400 },
      );
    }

    /*
     * ---------------------------------------------------------
     * 16. SUCCESS
     * ---------------------------------------------------------
     *
     * IMPORTANT:
     * The deposit is PENDING only.
     *
     * No wallet balance is changed here.
     */

    return NextResponse.json(
      {
        success: true,
        status: "pending",
        depositId,
        asset,
        network: canonicalNetwork,
        usdAmount,
        cryptoAmount: amount,
        message:
          "Deposit submitted successfully and is pending manual verification.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "Deposit submission API error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
