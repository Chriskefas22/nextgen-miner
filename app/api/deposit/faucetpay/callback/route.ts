import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getFaucetPayMerchantUsername,
  verifyFaucetPayPaymentToken,
} from "@/lib/faucetpay/server";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isFinitePositive(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function isFiniteNonNegative(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

export async function POST(request: Request) {
  try {
    /*
     * FaucetPay sends the callback as application/x-www-form-urlencoded.
     */
    const formData = await request.formData();

    const token = clean(formData.get("token"));

    if (!token) {
      return new NextResponse("Missing verification token", {
        status: 400,
      });
    }

    /*
     * NEVER trust the callback fields.
     *
     * The token is verified directly against FaucetPay.
     */
    const verification = await verifyFaucetPayPaymentToken(token);

    if (
      !verification ||
      typeof verification !== "object"
    ) {
      return new NextResponse("Invalid FaucetPay response", {
        status: 400,
      });
    }

    const verified =
      (verification as { valid?: unknown }).valid === true;

    if (!verified) {
      return new NextResponse(
        "FaucetPay payment is not valid",
        {
          status: 400,
        },
      );
    }

    const payment =
      verification as Record<string, unknown>;

    /*
     * IMPORTANT:
     *
     * From this point onward, payment identity and payment
     * values come ONLY from FaucetPay's verified response.
     */
    const transactionId = clean(
      payment.transaction_id,
    );

    const merchantUsername = clean(
      payment.merchant_username,
    );

    const payerUsername = clean(
      payment.payer_username,
    );

    const amount1Raw = payment.amount1;

    const currency1 = clean(
      payment.currency1,
    );

    const amount2Raw = payment.amount2;

    const currency2 = clean(
      payment.currency2,
    );

    const custom = clean(
      payment.custom,
    );

    const exchangeRateRaw =
      payment.exchange_rate;

    if (!transactionId) {
      return new NextResponse(
        "Missing verified transaction ID",
        { status: 400 },
      );
    }

    if (!merchantUsername) {
      return new NextResponse(
        "Missing verified merchant username",
        { status: 400 },
      );
    }

    if (!custom) {
      return new NextResponse(
        "Missing verified deposit reference",
        { status: 400 },
      );
    }

    if (!isFinitePositive(amount1Raw)) {
      return new NextResponse(
        "Invalid verified payment amount",
        { status: 400 },
      );
    }

    if (!currency1) {
      return new NextResponse(
        "Missing verified payment currency",
        { status: 400 },
      );
    }

    const amount1 = Number(amount1Raw);

    const amount2 =
      amount2Raw === undefined ||
      amount2Raw === null ||
      amount2Raw === ""
        ? 0
        : Number(amount2Raw);

    if (!isFiniteNonNegative(amount2)) {
      return new NextResponse(
        "Invalid verified secondary amount",
        { status: 400 },
      );
    }

    const exchangeRate =
      exchangeRateRaw === undefined ||
      exchangeRateRaw === null ||
      exchangeRateRaw === ""
        ? 0
        : Number(exchangeRateRaw);

    if (
      exchangeRateRaw !== undefined &&
      exchangeRateRaw !== null &&
      exchangeRateRaw !== "" &&
      (!Number.isFinite(exchangeRate) ||
        exchangeRate <= 0)
    ) {
      return new NextResponse(
        "Invalid verified exchange rate",
        { status: 400 },
      );
    }

    /*
     * Merchant identity must match the merchant configured
     * on the server.
     */
    const configuredMerchant =
      getFaucetPayMerchantUsername();

    if (
      merchantUsername !== configuredMerchant
    ) {
      console.error(
        "FaucetPay merchant mismatch",
        {
          expected: configuredMerchant,
          received: merchantUsername,
        },
      );

      return new NextResponse(
        "Merchant mismatch",
        { status: 400 },
      );
    }

    /*
     * Use the server-role Supabase client.
     *
     * This credential MUST exist only in Vercel environment
     * variables and MUST NEVER be exposed to the browser.
     */
    const supabase = createServiceClient();

    /*
     * Call the hardened settlement RPC.
     *
     * The RPC performs:
     * - provider validation
     * - pending/unverified validation
     * - reference matching
     * - amount matching
     * - currency matching
     * - duplicate transaction protection
     * - wallet locking
     * - Diamond calculation
     * - ledger insertion
     * - idempotent settlement
     */
    const { data, error } = await supabase.rpc(
      "nextgen_settle_faucetpay_deposit",
      {
        p_deposit_id: null,
        p_token: token,
        p_transaction_id: transactionId,
        p_merchant_username: merchantUsername,
        p_payer_username: payerUsername,
        p_amount1: amount1,
        p_currency1: currency1,
        p_amount2: amount2,
        p_currency2: currency2,
        p_custom: custom,
        p_exchange_rate: exchangeRate,
      },
    );

    if (error) {
      console.error(
        "FaucetPay settlement RPC failed:",
        error,
      );

      /*
       * Non-200 tells FaucetPay to retry the callback.
       */
      return new NextResponse(
        "Settlement failed",
        { status: 500 },
      );
    }

    /*
     * The current RPC requires p_deposit_id.
     *
     * Therefore this route deliberately does not silently
     * invent or guess a deposit ID.
     *
     * The next small correction will resolve the deposit ID
     * from the verified custom/reference before calling the RPC.
     */
    if (!data) {
      return new NextResponse(
        "Settlement returned no result",
        { status: 500 },
      );
    }

    return new NextResponse("OK", {
      status: 200,
    });
  } catch (error) {
    console.error(
      "FaucetPay callback processing error:",
      error,
    );

    /*
     * FaucetPay retries callbacks when it does not receive
     * HTTP 200.
     */
    return new NextResponse(
      "Callback processing failed",
      { status: 500 },
    );
  }
}
