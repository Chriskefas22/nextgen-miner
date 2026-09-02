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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Require an authenticated NextGen Miner user.
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

    // Keep monetary precision controlled.
    const normalizedAmount = Number(amount.toFixed(2));

    if (!isFinitePositiveNumber(normalizedAmount)) {
      return NextResponse.json(
        {
          error: "Invalid deposit amount",
        },
        { status: 400 },
      );
    }

    const referenceCode = generateFaucetPayDepositReference();

    /*
     * The database RPC is responsible for:
     * - authentication
     * - minimum deposit validation
     * - creating the pending deposit
     * - keeping Diamond at 0
     *
     * No Diamond is credited by this route.
     */
    const { data: depositData, error: depositError } = await supabase.rpc(
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

    const merchantUsername = getFaucetPayMerchantUsername();
    const checkoutUrl = getFaucetPayCheckoutUrl();

    /*
     * FaucetPay Merchant Checkout expects a standard POST form.
     *
     * We return the form fields to the client.
     * The merchant credential itself is not exposed.
     */
    return NextResponse.json({
      success: true,
      checkout_url: checkoutUrl,
      merchant_username: merchantUsername,
      item_description: `NextGen Miner Deposit ${referenceCode}`,
      amount1: normalizedAmount.toFixed(2),
      currency1: "USD",
      custom: referenceCode,
      deposit: depositData,
    });
  } catch (error) {
    console.error("FaucetPay checkout route error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
