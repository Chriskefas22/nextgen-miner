import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getFaucetPayMerchantUsername,
  verifyFaucetPayPaymentToken,
} from "@/lib/faucetpay/server";

export const runtime = "nodejs";

type FaucetPayDepositRow = {
  id: number;
  user_id: string;
  provider: string;
  provider_order_id: string | null;
  reference_code: string | null;
  usd_amount: number | string | null;
  amount: number | string | null;
  asset: string | null;
  status: string;
  verification_status: string;
};

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
    const formData = await request.formData();

    const token = clean(formData.get("token"));

    if (!token) {
      return new NextResponse("Missing verification token", {
        status: 400,
      });
    }

    /*
     * NEVER trust the callback fields directly.
     * Verify the single-use token with FaucetPay first.
     */
    const verification = await verifyFaucetPayPaymentToken(token);

    if (!verification || typeof verification !== "object") {
      return new NextResponse("Invalid FaucetPay response", {
        status: 400,
      });
    }

    const payment = verification as Record<string, unknown>;

    /*
     * Payment is accepted ONLY when FaucetPay explicitly
     * reports valid === true.
     */
    if (payment.valid !== true) {
      return new NextResponse("FaucetPay payment is not valid", {
        status: 400,
      });
    }

    /*
     * All important payment values now come from the
     * verified FaucetPay response.
     */
    const transactionId = clean(payment.transaction_id);
    const merchantUsername = clean(payment.merchant_username);
    const payerUsername = clean(payment.payer_username);
    const custom = clean(payment.custom);
    const currency1 = clean(payment.currency1);
    const currency2 = clean(payment.currency2);

    const amount1 = Number(payment.amount1);

    const amount2 =
      payment.amount2 === undefined ||
      payment.amount2 === null ||
      payment.amount2 === ""
        ? 0
        : Number(payment.amount2);

    const exchangeRate =
      payment.exchange_rate === undefined ||
      payment.exchange_rate === null ||
      payment.exchange_rate === ""
        ? 0
        : Number(payment.exchange_rate);

    if (!transactionId) {
      return new NextResponse("Missing verified transaction ID", {
        status: 400,
      });
    }

    if (!merchantUsername) {
      return new NextResponse("Missing verified merchant username", {
        status: 400,
      });
    }

    if (!custom) {
      return new NextResponse("Missing verified deposit reference", {
        status: 400,
      });
    }

    if (!isFinitePositive(amount1)) {
      return new NextResponse("Invalid verified payment amount", {
        status: 400,
      });
    }

    if (!currency1) {
      return new NextResponse("Missing verified payment currency", {
        status: 400,
      });
    }

    if (!isFiniteNonNegative(amount2)) {
      return new NextResponse("Invalid verified secondary amount", {
        status: 400,
      });
    }

    if (
      payment.exchange_rate !== undefined &&
      payment.exchange_rate !== null &&
      payment.exchange_rate !== "" &&
      (!Number.isFinite(exchangeRate) || exchangeRate <= 0)
    ) {
      return new NextResponse("Invalid verified exchange rate", {
        status: 400,
      });
    }

    /*
     * Verify merchant identity against the server configuration.
     */
    const configuredMerchant = getFaucetPayMerchantUsername();

    if (merchantUsername !== configuredMerchant) {
      console.error("FaucetPay merchant mismatch", {
        expected: configuredMerchant,
        received: merchantUsername,
      });

      return new NextResponse("Merchant mismatch", {
        status: 400,
      });
    }

    /*
     * Everything below this point runs server-side.
     */
    const supabase = createServiceClient();

    /*
     * Resolve the internal deposit ID using the verified
     * FaucetPay custom/reference value.
     */
    const {
      data: rawDeposit,
      error: depositError,
    } = await supabase
      .from("nextgen_deposits")
      .select(
        [
          "id",
          "user_id",
          "provider",
          "provider_order_id",
          "reference_code",
          "usd_amount",
          "amount",
          "asset",
          "status",
          "verification_status",
        ].join(","),
      )
      .eq("provider", "faucetpay")
      .eq("reference_code", custom)
      .maybeSingle();

    if (depositError) {
      console.error(
        "FaucetPay deposit lookup failed:",
        depositError,
      );

      return new NextResponse("Deposit lookup failed", {
        status: 500,
      });
    }

    /*
     * Supabase generated types are not currently available for
     * this table in this server client, so normalize the query
     * result into the exact shape required by this route.
     */
    const deposit = rawDeposit as FaucetPayDepositRow | null;

    if (!deposit) {
      return new NextResponse("Deposit not found", {
        status: 404,
      });
    }

    /*
     * The internal reference must match exactly.
     */
    if (
      deposit.reference_code !== custom ||
      deposit.provider_order_id !== custom
    ) {
      console.error(
        "FaucetPay deposit reference mismatch",
        {
          depositId: deposit.id,
          expected: deposit.reference_code,
          providerOrderId: deposit.provider_order_id,
          received: custom,
        },
      );

      return new NextResponse("Deposit reference mismatch", {
        status: 400,
      });
    }

    /*
     * Our checkout uses USDT as currency1.
     */
    if (currency1.toUpperCase() !== "USDT") {
      return new NextResponse("Unsupported pricing currency", {
        status: 400,
      });
    }

    /*
     * currency2 may be empty or populated.
     * We do NOT reject it.
     */

    /*
     * Match the verified FaucetPay amount against the amount
     * originally stored for this deposit.
     */
    const storedUsdAmount = Number(
      deposit.usd_amount ?? deposit.amount,
    );

    if (
      !Number.isFinite(storedUsdAmount) ||
      storedUsdAmount <= 0
    ) {
      console.error("Invalid stored deposit amount", {
        depositId: deposit.id,
        usdAmount: deposit.usd_amount,
        amount: deposit.amount,
      });

      return new NextResponse("Invalid stored deposit amount", {
        status: 500,
      });
    }

    const expectedAmount = Number(
      storedUsdAmount.toFixed(2),
    );

    const verifiedAmount = Number(
      amount1.toFixed(2),
    );

    if (expectedAmount !== verifiedAmount) {
      console.error("FaucetPay amount mismatch", {
        depositId: deposit.id,
        expectedAmount,
        verifiedAmount,
      });

      return new NextResponse("Payment amount mismatch", {
        status: 400,
      });
    }

    /*
     * Call the hardened settlement RPC.
     *
     * The RPC is responsible for the final atomic operation:
     * - pending/unverified check
     * - duplicate transaction protection
     * - wallet locking
     * - Diamond calculation
     * - wallet credit
     * - ledger
     * - deposit update
     * - idempotency
     */
    const {
      data: settlement,
      error: settlementError,
    } = await supabase.rpc(
      "nextgen_settle_faucetpay_deposit",
      {
        p_deposit_id: deposit.id,
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

    if (settlementError) {
      console.error(
        "FaucetPay settlement failed:",
        {
          depositId: deposit.id,
          transactionId,
          error: settlementError,
        },
      );

      /*
       * Do NOT acknowledge a failed settlement.
       * Returning non-200 allows FaucetPay to retry.
       */
      return new NextResponse("Settlement failed", {
        status: 500,
      });
    }

    /*
     * Successful settlement OR an idempotent
     * already-settled response is acknowledged with HTTP 200.
     */
    console.info("FaucetPay deposit settled", {
      depositId: deposit.id,
      transactionId,
      result: settlement,
    });

    return new NextResponse("OK", {
      status: 200,
    });
  } catch (error) {
    console.error(
      "FaucetPay callback processing error:",
      error,
    );

    /*
     * Any unexpected server failure must remain non-200 so
     * FaucetPay can retry the callback.
     */
    return new NextResponse(
      "Callback processing failed",
      { status: 500 },
    );
  }
}
