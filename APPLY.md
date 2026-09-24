# NextGenMiner — OxaPay Deposit UX v2 (mobile-first)

## What was changed

1. `components/wallet/DepositFlow.tsx`
   - Removes the old two-column desktop-style deposit form.
   - Removes manual OxaPay asset/network selection from NextGenMiner.
   - Removes transaction-hash input from the OxaPay deposit path.
   - Adds quick amount buttons, custom amount, diamond preview, provider explanation, coin strip, deposit history, return-from-OxaPay state and one direct CTA.
   - The CTA immediately redirects to the OxaPay hosted payment page.

2. `styles/wallet-premium.mobile-append.css`
   - Append to the end of `styles/wallet-premium.css`.
   - Makes the wallet genuinely mobile-first at <=760px.
   - Keeps a clean desktop expansion above 760px.
   - Keeps the existing single BottomNav contract.

## Exact GitHub paths

Replace:
`components/wallet/DepositFlow.tsx`

Append:
`styles/wallet-premium.mobile-append.css`
content to the end of:
`styles/wallet-premium.css`

## Resulting UX

Wallet > Setoran > choose amount > Lanjut ke pembayaran > OxaPay.

OxaPay then controls coin, network, address, QR and payment status.
NextGenMiner only verifies and settles the payment server-side.

## Important backend hardening already applied

The OxaPay invoice function was upgraded to send:
`to_currency: "USDT"`
so supported crypto payments can be converted to the USDT settlement currency expected by NextGenMiner.

Do not expose or paste API keys into frontend code.
