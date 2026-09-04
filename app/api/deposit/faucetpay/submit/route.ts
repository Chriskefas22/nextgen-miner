import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const DIAMONDS_PER_USD = 10_000;
const MIN_USD = 0.01;
const MAX_USD = 1_000_000;
const QUOTE_MAX_AGE_MS = 60_000;

const ASSET_NETWORKS: Record<string, string[]> = {
  BTC: ['Bitcoin Chain'],
  ETH: ['Ethereum Chain'],
  BCH: ['Bitcoin Cash Chain'],
  ADA: ['Cardano Chain'],
  DASH: ['Dash Chain'],
  DGB: ['DigiByte Chain'],
  DOGE: ['Dogecoin Chain'],
  LTC: ['Litecoin Chain'],
  XMR: ['Monero Chain'],
  POL: ['Polygon PoS'],
  SOL: ['Solana Chain'],
  TON: ['TON Chain'],
  TRX: ['TRON / TRC20'],
  USDT: ['TRC20 / TRON', 'Polygon PoS', 'ERC20 / Ethereum', 'BEP20 / BNB Chain'],
  BNB: ['BNB Chain'],
};

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  try {
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return bad('AUTH_REQUIRED', 401);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return bad('INVALID_JSON');

    const asset = String(body.asset ?? '').trim().toUpperCase();
    const network = String(body.network ?? '').trim();
    const txHash = String(body.txHash ?? '').trim();
    const amount = Number(body.amount);
    const usdAmount = Number(body.usdAmount);
    const quotePrice = Number(body.quotePrice);
    const quoteTimestamp = Number(body.quoteTimestamp);

    if (!ASSET_NETWORKS[asset]) return bad('UNSUPPORTED_ASSET');
    if (!ASSET_NETWORKS[asset].includes(network)) return bad('ASSET_NETWORK_MISMATCH');
    if (!Number.isFinite(amount) || amount <= 0) return bad('INVALID_CRYPTO_AMOUNT');
    if (!Number.isFinite(usdAmount) || usdAmount < MIN_USD || usdAmount > MAX_USD) return bad('INVALID_USD_AMOUNT');
    if (!Number.isFinite(quotePrice) || quotePrice <= 0) return bad('INVALID_QUOTE');
    if (!Number.isFinite(quoteTimestamp) || Math.abs(Date.now() - quoteTimestamp) > QUOTE_MAX_AGE_MS) return bad('QUOTE_EXPIRED');
    if (txHash.length < 8 || txHash.length > 256) return bad('INVALID_TX_HASH');

    const expectedAmount = usdAmount / quotePrice;
    const relativeDifference = Math.abs(amount - expectedAmount) / expectedAmount;
    if (!Number.isFinite(relativeDifference) || relativeDifference > 0.01) return bad('QUOTE_AMOUNT_MISMATCH');

    const diamonds = Number((usdAmount * DIAMONDS_PER_USD).toFixed(8));
    if (!Number.isFinite(diamonds) || diamonds <= 0) return bad('INVALID_DIAMOND_AMOUNT');

    const service = createServiceClient();
    const { data: duplicate, error: duplicateError } = await service
      .from('nextgen_deposits')
      .select('id,user_id,status')
      .eq('tx_hash', txHash)
      .limit(1)
      .maybeSingle();
    if (duplicateError) return bad('DUPLICATE_CHECK_FAILED', 500);
    if (duplicate) return bad('TX_HASH_ALREADY_SUBMITTED', 409);

    const { data: deposit, error: insertError } = await service
      .from('nextgen_deposits')
      .insert({
        user_id: user.id,
        asset,
        network,
        amount,
        usd_amount: usdAmount,
        diamond_amount: diamonds,
        tx_hash: txHash,
        status: 'pending',
      })
      .select('id,status,created_at')
      .single();

    if (insertError) return bad('DEPOSIT_CREATE_FAILED', 500);

    return NextResponse.json({
      ok: true,
      deposit_id: deposit.id,
      status: deposit.status,
      created_at: deposit.created_at,
    }, { status: 201 });
  } catch {
    return bad('INTERNAL_SERVER_ERROR', 500);
  }
}
