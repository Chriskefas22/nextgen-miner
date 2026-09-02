import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateFaucetPayDepositReference,
  getFaucetPayCheckoutUrl,
  getFaucetPayMerchantUsername,
} from "@/lib/faucetpay/server";

export const runtime = "nodejs";

type CheckoutRequest = {
  amount?: unknown;
};

function isFinitePositiveNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

function getPublicBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "https://nextgen-miner.vercel.app";

  return url.startsWith("http") ? url : `https://${url}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    /*
     * Deposit checkout requires a logged-in NextGen Miner user.
     */
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Authentication required",
        },
        { status: 401 },
      );
    }

    let body: CheckoutRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON request",
        },
        { status: 400 },
      );
    }

    const amount = Number(body.amount);

    if (!isFinitePositiveNumber(amount)) {
      return NextResponse.json(
        {
          error: "Deposit amount must be a positive number",
        },
        { status: 400 },
      );
    }

    /*
     * Normalize fiat pricing to two decimal places.
     *
     * The authoritative minimum-deposit validation is still
     * performed by nextgen_create_faucetpay_deposit().
     */
    const normalizedAmount = Number(amount.toFixed(2));

    if (!isFinitePositiveNumber(normalizedAmount)) {
      return NextResponse.json(
        {
          error: "Invalid deposit amount",
        },
        { status: 400 },
      );
    }

    /*
     * Generate a unique internal order/reference.
     *
     * This is stored by the Supabase RPC and later returned by
     * FaucetPay as the "custom" callback value.
     */
    const referenceCode = generateFaucetPayDepositReference();

    /*
     * Create the pending deposit first.
     *
     * IMPORTANT:
     * This RPC creates the deposit with diamond_amount = 0.
     * No Diamond is credited at checkout creation.
     */
    const { data: depositData, error: depositError } =
      await supabase.rpc(
        "nextgen_create_faucetpay_deposit",
        {
          p_usd_amount: normalizedAmount,
          p_reference_code: referenceCode,
        },
      );

    if (depositError) {
      console.error(
        "FaucetPay deposit creation failed:",
        depositError,
      );

      return NextResponse.json(
        {
          error: "Unable to create deposit",
        },
        { status: 400 },
      );
    }

    if (!depositData) {
      return NextResponse.json(
        {
          error: "Deposit creation returned no data",
        },
        { status: 500 },
      );
    }

    const merchantUsername =
      getFaucetPayMerchantUsername();

    const checkoutUrl =
      getFaucetPayCheckoutUrl();

    const baseUrl = getPublicBaseUrl();

    /*
     * FaucetPay Merchant Checkout:
     *
     * currency1 = USDT
     * currency2 = blank
     *
     * This means NextGen prices the deposit in USDT-equivalent
     * value while allowing the customer to choose any supported
     * FaucetPay payment coin.
     *
     * Example:
     *
     * $5 deposit
     * -> 5 USDT pricing value
     * -> customer may choose BTC / ETH / USDT / LTC / DOGE etc.
     *
     * The actual payment coin and conversion are handled by
     * FaucetPay.
     */
    const checkout = {
      action: checkoutUrl,
      method: "POST",
      fields: {
        merchant_username: merchantUsername,
        item_description:
          `NextGen Miner Deposit ${referenceCode}`,
        amount1: normalizedAmount.toFixed(2),
        currency1: "USDT",
        currency2: "",
        custom: referenceCode,
        callback_url:
          `${baseUrl}/api/deposit/faucetpay/callback`,
        success_url:
          `${baseUrl}/wallet/deposit?payment=success&reference=${encodeURIComponent(
            referenceCode,
          )}`,
        cancel_url:
          `${baseUrl}/wallet/deposit?payment=cancelled&reference=${encodeURIComponent(
            referenceCode,
          )}`,
      },
    };

    /*
     * Return only checkout information.
     *
     * No FaucetPay API secret is returned.
     * No Diamond calculation is performed here.
     */
    return NextResponse.json({
      success: true,
      deposit: depositData,
      checkout,
    });
  } catch (error) {
    console.error(
      "FaucetPay checkout route error:",
      error,
    );

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
