# NextGen Miner — Deposit Flow implementation

This package is ready to apply to the existing Next.js repository.

## User flow
1. Wallet > Deposit shows a compact list of all configured crypto/network options.
2. Clicking TRX (or any asset) opens Step 2.
3. User selects a USD deposit nominal or enters a custom amount.
4. The screen shows the diamond credit calculation (`$1 = 10,000 💎`).
5. The selected wallet address and a locally generated QR code are displayed.
6. Copy button copies the exact wallet address.
7. Network/asset warnings are shown.
8. The final confirmation/transaction-hash submission must be wired to the existing `nextgen_request_deposit` RPC after the payment is sent.

## Files
- `components/wallet/DepositFlow.tsx` — asset selector + payment detail step.
- `app/wallet/page.tsx` — wallet page using the new deposit flow.
- `deposit-wallet.css.txt` — append to `app/globals.css`.
- `package.json.patch.json` — add qrcode dependency.

## Important
- The wallet addresses are exactly the addresses supplied in the conversation.
- USDT TRC20, Polygon, ERC20 and BEP20 remain separate choices.
- BNB retains the supplied warning and smart-contract notice.
- The current implementation does **not** alter Supabase wallet balances, miner RPCs, withdrawal logic, or Finance RPCs.
- No deposit/network fee is displayed. The user sends only the required crypto amount for the selected deposit nominal.
- The `I have sent the payment` button is a visual step only until the existing deposit confirmation flow is connected to `nextgen_request_deposit` with the transaction hash.

## GitHub status
The connected GitHub integration returned HTTP 403 on the write attempt, so these changes were not committed to the repository automatically.
