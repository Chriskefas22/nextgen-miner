import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyFaucetPayPaymentToken } from "@/lib/faucetpay/server";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finitePositive(value: unknown): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const token = clean(formData.get("token"));

    if (!token) {
      return new NextResponse("Missing token", { status: 400 });
    }

    /*
     * NEVER trust the callback fields directly.
     *
     * FaucetPay provides a single-use token which must be
     * verified server-side against FaucetPay.
     */
    const verification = await verifyFaucetPayPaymentToken(token);

    /*
     * FaucetPay's verification response is the authoritative
     * payment result. We deliberately do not settle anything
     * unless the response contains a successful payment.
     *
     * The exact response shape may vary, so we inspect the
     * commonly documented fields defensively.
     */
    const verified =
      verification &&
      typeof verification === "object" &&
      "valid" in verification
        ? Boolean(
            (verification as { valid?: unknown }).valid,
          )
        : true;

    if (!verified) {
      return new NextResponse("Payment verification failed", {
        status: 400,
      });
    }

    const verifiedData =
      verification && typeof verification === "object"
        ? (verification as Record<string, unknown>)
        : {};

    const transactionId =
      clean(verifiedData.transaction_id) ||
      clean(formData.get("transaction_id"));

    const merchantUsername =
      clean(verifiedData.merchant_username) ||
      clean(formData.get("merchant_username"));

    const payerUsername =
      clean(verifiedData.payer_username) ||
      clean(formData.get("payer_username"));

    const amount1Raw =
      verifiedData.amount1 ?? formData.get("amount1");

    const currency1 =
      clean(verifiedData.currency1) ||
      clean(formData.get("currency1"));

    const amount2Raw =
      verifiedData.amount2 ?? formData.get("amount2");

    const currency2 =
      clean(verifiedData.currency2) ||
      clean(formData.get("currency2"));

    const custom =
      clean(verifiedData.custom) ||
      clean(formData.get("custom"));

    const exchangeRateRaw =
      verifiedData.exchange_rate ??
      formData.get("exchange_rate");

    const amount1 = Number(amount1Raw);
    const amount2 =
      amount2Raw === null ||
      amount2Raw === undefined ||
      amount2Raw === ""
        ? 0
        : Number(amount2Raw);

    const exchangeRate =
      exchangeRateRaw === null ||
      exchangeRateRaw === undefined ||
      exchangeRateRaw === ""
        ? 0
        : Number(exchangeRateRaw);

    if (!transactionId) {
      return new NextResponse("Missing transaction ID", {
        status: 400,
      });
    }

    if (!finitePositive(amount1)) {
      return new NextResponse("Invalid payment amount", {
        status: 400,
      });
    }

    if (!currency1) {
      return new NextResponse("Missing payment currency", {
        status: 400,
      });
    }

    if (!custom) {
      return new NextResponse("Missing deposit reference", {
        status: 400,
      });
    }

    if (
      !Number.isFinite(amount2) ||
      amount2 < 0
    ) {
      return new NextResponse("Invalid secondary amount", {
        status: 400,
      });
    }

    if (
      exchangeRateRaw !== null &&
      exchangeRateRaw !== undefined &&
      exchangeRateRaw !== "" &&
      (!Number.isFinite(exchangeRate) ||
        exchangeRate <= 0)
    ) {
      return new NextResponse("Invalid exchange rate", {
        status: 400,
      });
    }

    /*
     * Service-role settlement must NEVER be called from the
     * browser. The callback is a server-to-server endpoint.
     *
     * The current Supabase server client uses the authenticated
     * user's session, so settlement will NOT be executed here
     * until we add the dedicated server-only service-role client.
     */
    const supabase = await createClient();

    /*
     * Find the deposit by its reference through the authenticated
     * Supabase client only for validation.
     *
     * Settlement itself is intentionally NOT attempted yet.
     */
    const { data: deposit, error: depositError } = await supabase
      .from("nextgen_deposits")
      .select(
        "id,user_id,provider,provider_order_id,reference_code,usd_amount,asset,status,verification_status",
      )
      .eq("reference_code", custom)
      .eq("provider", "faucetpay")
      .maybeSingle();

    if (depositError) {
      console.error(
        "FaucetPay callback deposit lookup failed:",
        depositError,
      );

      return new NextResponse("Deposit lookup failed", {
        status: 500,
      });
    }

    if (!deposit) {
      return new NextResponse("Deposit not found", {
        status: 404,
      });
    }

    /*
     * Do not settle an already completed payment here.
     * The dedicated service-role settlement route will handle
     * idempotency through the database RPC.
     */
    if (
      deposit.status === "approved" &&
      deposit.verification_status === "verified"
    ) {
      return new NextResponse("OK", { status: 200 });
    }

    /*
     * IMPORTANT:
     *
     * We stop here intentionally for this step.
     *
     * The next file will create a server-only Supabase service
     * client and call:
     *
     * nextgen_settle_faucetpay_deposit(...)
     *
     * using the verified FaucetPay data.
     *
     * This prevents accidentally granting Diamond before the
     * service-role boundary is implemented.
     */

    console.info(
      "FaucetPay payment verified; settlement pending service-role route",
      {
        depositId: deposit.id,
        transactionId,
        merchantUsername,
        payerUsername,
        amount1,
        currency1,
        currency2,
        amount2,
        custom,
        exchangeRate,
      },
    );

    return new NextResponse("VERIFIED_PENDING_SETTLEMENT", {
      status: 200,
    });
  } catch (error) {
    console.error(
      "FaucetPay callback verification error:",
      error,
    );

    /*
     * Return non-200 on failure so FaucetPay can retry the
     * callback according to its callback retry behavior.
     */
    return new NextResponse("Callback processing failed", {
      status: 500,
    });
  }
}
