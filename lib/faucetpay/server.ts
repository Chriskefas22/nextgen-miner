import "server-only";

const FAUCETPAY_API_BASE = "https://faucetpay.io";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

/**
 * FaucetPay merchant username.
 *
 * IMPORTANT:
 * Keep this server-side only.
 */
export function getFaucetPayMerchantUsername(): string {
  return getRequiredEnv("FAUCETPAY_MERCHANT_USERNAME");
}

/**
 * Generate a cryptographically secure reference for a new deposit.
 *
 * This value is stored as provider_order_id/reference_code
 * and later matched against the FaucetPay callback.
 */
export function generateFaucetPayDepositReference(): string {
  const randomBytes = new Uint8Array(16);

  crypto.getRandomValues(randomBytes);

  const randomPart = Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `NGM-${Date.now()}-${randomPart}`;
}

/**
 * FaucetPay hosted merchant checkout endpoint.
 */
export function getFaucetPayCheckoutUrl(): string {
  return `${FAUCETPAY_API_BASE}/merchant/webscr`;
}

/**
 * Verify a FaucetPay callback token.
 *
 * FaucetPay callback tokens are single-use.
 * The callback must NOT be trusted until this endpoint
 * confirms the payment with FaucetPay.
 */
export async function verifyFaucetPayPaymentToken(token: string) {
  const cleanToken = token.trim();

  if (!cleanToken) {
    throw new Error("Missing FaucetPay verification token");
  }

  if (cleanToken.length > 512) {
    throw new Error("Invalid FaucetPay verification token");
  }

  const response = await fetch(
    `${FAUCETPAY_API_BASE}/merchant/get-payment/${encodeURIComponent(
      cleanToken,
    )}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `FaucetPay verification request failed: HTTP ${response.status}`,
    );
  }

  const data = await response.json();

  return data;
}
