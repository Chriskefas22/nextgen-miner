'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowLeft, Check, ChevronRight, Copy, Loader2, ShieldAlert } from 'lucide-react';

type Wallet = {
  id: string;
  name: string;
  symbol: string;
  network: string;
  address: string;
  icon: string;
  color: string;
  quoteId: string;
  warning?: string;
  note?: string;
};

type QuoteState = {
  usdPrice: number | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
};

const wallets: Wallet[] = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', network: 'Bitcoin Chain', address: '13bvoKfBsVtE1xLcbYP8oVw9QRURaAZUkY', icon: 'bitcoin', color: '#f7931a', quoteId: 'bitcoin' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', network: 'Ethereum Chain', address: '0x7AC694DA231fdDba9a72448a27fdc51a1393CBeB', icon: 'ethereum', color: '#8b92ff', quoteId: 'ethereum' },
  { id: 'bch', name: 'Bitcoin Cash', symbol: 'BCH', network: 'Bitcoin Cash Chain', address: 'bitcoincash:qr8jw9wh9s8yd59gc86vvzx7lrejpdqdjyr7xc83az', icon: 'bitcoin-cash', color: '#22c55e', quoteId: 'bitcoin-cash' },
  { id: 'ada', name: 'Cardano', symbol: 'ADA', network: 'Cardano Chain', address: 'addr1qyffsxlt9dgf7tyfj5vc3xvt3l4e4ucdms78dtugqw5z9gdqwk5rzfhp7pkaz7pwrve8s58fhvj59hgu0wlpfmrxsafqg29exv', icon: 'cardano', color: '#3b82f6', quoteId: 'cardano' },
  { id: 'dash', name: 'Dash', symbol: 'DASH', network: 'Dash Chain', address: 'Xydoi8R5Hsce6SMbRaZXGvEGEd2u6mii52', icon: 'dash', color: '#1787d7', quoteId: 'dash' },
  { id: 'dgb', name: 'DigiByte', symbol: 'DGB', network: 'DigiByte Chain', address: 'DC7jb8HV17nr8KEUU93CKVruUUTstKmFQW', icon: 'digibyte', color: '#006ad6', quoteId: 'digibyte' },
  { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', network: 'Dogecoin Chain', address: 'D7YPWikXJYrZgATya7Y79CeQrcneG7H3kR', icon: 'dogecoin', color: '#c2a633', quoteId: 'dogecoin' },
  { id: 'ltc', name: 'Litecoin', symbol: 'LTC', network: 'Litecoin Chain', address: 'ltc1qv00frrh9hxds3uz0r97ulaujped5ek9eusnaw0', icon: 'litecoin', color: '#b7b7b7', quoteId: 'litecoin' },
  { id: 'xmr', name: 'Monero', symbol: 'XMR', network: 'Monero Chain', address: '4Bw5E7qSTCyUijTko5mQzSah8AQiJHnyV7XKBqwRkr6aWgRLNkUXvXkYrtVoj65GcmK7xQVCceJ6VgiCz4msqgdZ2Aui6ejTFsiGsAgdkS', icon: 'monero', color: '#ff6600', quoteId: 'monero' },
  { id: 'pol', name: 'Polygon', symbol: 'POL', network: 'Polygon PoS', address: '0x0eeb0d52628441403a85E9F0fC5137255af9A8AC', icon: 'polygon', color: '#8247e5', quoteId: 'polygon-ecosystem-token' },
  { id: 'sol', name: 'Solana', symbol: 'SOL', network: 'Solana Chain', address: 'HC664vbxGBe3DFJSfCAetau1KjzphtEnopT42EeHgmq3', icon: 'solana', color: '#8b5cf6', quoteId: 'solana' },
  { id: 'ton', name: 'Toncoin', symbol: 'TON', network: 'TON Chain', address: 'UQAXW6RU8aUj6hInPJMWCY9glFOT0ladnW7neyDThe5hcaIr', icon: 'ton', color: '#0098ea', quoteId: 'the-open-network' },
  { id: 'trx', name: 'Tron', symbol: 'TRX', network: 'TRON / TRC20', address: 'TLTKUNf2MCKUchiYScj9o3mHhMcjhZtBEs', icon: 'tron', color: '#ef3340', quoteId: 'tron' },
  { id: 'usdt-trc20', name: 'Tether', symbol: 'USDT', network: 'TRC20 / TRON', address: 'TLTKUNf2MCKUchiYScj9o3mHhMcjhZtBEs', icon: 'tether', color: '#26a17b', quoteId: 'tether' },
  { id: 'usdt-polygon', name: 'Tether', symbol: 'USDT', network: 'Polygon PoS', address: '0x0eeb0d52628441403a85E9F0fC5137255af9A8AC', icon: 'tether', color: '#26a17b', quoteId: 'tether' },
  { id: 'usdt-erc20', name: 'Tether', symbol: 'USDT', network: 'ERC20 / Ethereum', address: '0x7AC694DA231fdDba9a72448a27fdc51a1393CBeB', icon: 'tether', color: '#26a17b', quoteId: 'tether' },
  { id: 'usdt-bep20', name: 'Tether', symbol: 'USDT', network: 'BEP20 / BNB Chain', address: '0x5C81a904F4134aB34a38D8159BDa8825Cdf92Bdd', icon: 'tether', color: '#26a17b', quoteId: 'tether' },
  { id: 'bnb', name: 'Binance Coin', symbol: 'BNB', network: 'BNB Chain', address: '0x5C81a904F4134aB34a38D8159BDa8825Cdf92Bdd', icon: 'bnb', color: '#f3ba2f', quoteId: 'binancecoin', warning: 'BNB only. Send only BNB on the BNB chain. Sending the wrong coin or using a different network will result in a permanent loss of funds. We are not responsible for lost funds.', note: 'First-time deposits can take up to 30 minutes depending on network congestion. We do not support deposits from smart contracts — recovery fees apply.' },
];

const amounts = [1, 5, 10, 25, 50, 100];
const DIAMONDS_PER_USD = 10_000;
const QUOTE_MAX_AGE_MS = 60_000;

function Logo({ wallet }: { wallet: Wallet }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="deposit-logo-fallback" style={{ color: wallet.color }}>{wallet.symbol.slice(0, 4)}</span>;
  return <img src={`https://cdn.simpleicons.org/${wallet.icon}`} alt="" onError={() => setFailed(true)} />;
}

function PaymentAddress({ wallet }: { wallet: Wallet }) {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(wallet.address, { width: 280, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(''));
    return () => { live = false; };
  }, [wallet.address]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be unavailable in some browsers/contexts.
    }
  }

  return <>
    <div className="deposit-qr">{qr ? <img src={qr} alt={`${wallet.symbol} ${wallet.network} deposit QR code`} /> : <span>Generating QR…</span>}</div>
    <div className="deposit-address-title">WALLET ADDRESS</div>
    <div className="deposit-address">
      <code>{wallet.address}</code>
      <button type="button" onClick={copy} aria-label="Copy wallet address">{copied ? <Check size={17} /> : <Copy size={17} />}</button>
    </div>
    <div className="deposit-warning">
      <ShieldAlert size={16} />
      <span>{wallet.warning ?? `Send only ${wallet.symbol} on the ${wallet.network}. Sending the wrong asset or using a different network may result in permanent loss of funds.`}</span>
    </div>
    {wallet.note && <div className="deposit-note">{wallet.note}</div>}
  </>;
}

function useCryptoQuote(wallet: Wallet | null): QuoteState {
  const [quote, setQuote] = useState<QuoteState>({ usdPrice: null, loading: false, error: null, fetchedAt: null });

  useEffect(() => {
    if (!wallet) {
      setQuote({ usdPrice: null, loading: false, error: null, fetchedAt: null });
      return;
    }

    const controller = new AbortController();
    let live = true;
    setQuote({ usdPrice: null, loading: true, error: null, fetchedAt: null });

    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(wallet.quoteId)}&vs_currencies=usd`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Quote service returned ${response.status}`);
        return response.json() as Promise<Record<string, { usd?: number }>>;
      })
      .then((data) => {
        const price = Number(data?.[wallet.quoteId]?.usd);
        if (!Number.isFinite(price) || price <= 0) throw new Error('No valid USD quote returned');
        if (live) setQuote({ usdPrice: price, loading: false, error: null, fetchedAt: Date.now() });
      })
      .catch((error: unknown) => {
        if (!live || controller.signal.aborted) return;
        setQuote({ usdPrice: null, loading: false, error: error instanceof Error ? error.message : 'Unable to load quote', fetchedAt: null });
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [wallet]);

  return quote;
}

export function DepositFlow() {
  const [selected, setSelected] = useState<Wallet | null>(null);
  const [usd, setUsd] = useState(1);
  const [customUsd, setCustomUsd] = useState('');
  const [showTxStep, setShowTxStep] = useState(false);
  const [txHash, setTxHash] = useState('');
  const quote = useCryptoQuote(selected);

  const amount = useMemo(() => {
    const value = customUsd ? Number(customUsd) : usd;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }, [customUsd, usd]);

  const diamond = amount * DIAMONDS_PER_USD;
  const displayUsd = amount.toFixed(2);
  const cryptoAmount = quote.usdPrice ? amount / quote.usdPrice : null;
  const quoteFresh = quote.fetchedAt ? Date.now() - quote.fetchedAt <= QUOTE_MAX_AGE_MS : false;
  const cryptoDisplay = cryptoAmount === null ? '—' : cryptoAmount.toLocaleString(undefined, { maximumSignificantDigits: 10 });

  function chooseAmount(value: number) {
    setUsd(value);
    setCustomUsd('');
    setShowTxStep(false);
    setTxHash('');
  }

  function changeCustom(value: string) {
    setCustomUsd(value);
    setShowTxStep(false);
    setTxHash('');
  }

  function backToAssets() {
    setSelected(null);
    setShowTxStep(false);
    setTxHash('');
  }

  if (selected) {
    return <div className="deposit-flow">
      <button type="button" className="deposit-back" onClick={backToAssets}><ArrowLeft size={17} /> Back to assets</button>
      <div className="deposit-payment-card">
        <div className="deposit-payment-head">
          <div className="deposit-coin">
            <span className="deposit-coin-icon"><Logo wallet={selected} /></span>
            <div><h2>{selected.name} ({selected.symbol})</h2><span>{selected.network}</span></div>
          </div>
          <span className="deposit-step">STEP {showTxStep ? '3 / 3' : '2 / 3'}</span>
        </div>

        <div className="deposit-payment-grid">
          <div className="deposit-payment-left">
            <div className="deposit-label">SELECT DEPOSIT NOMINAL</div>
            <div className="deposit-amounts">
              {amounts.map((value) => (
                <button type="button" key={value} onClick={() => chooseAmount(value)} className={!customUsd && usd === value ? 'active' : ''}>${value.toFixed(2)}</button>
              ))}
            </div>
            <div className="deposit-field">
              <label>CUSTOM AMOUNT (USD)</label>
              <input type="number" min="0.01" step="0.01" value={customUsd} onChange={(event) => changeCustom(event.target.value)} placeholder="1.00" />
            </div>

            <div className="deposit-summary">
              <div><span>Deposit nominal</span><b>${displayUsd}</b></div>
              <div><span>You receive</span><b>💎 {diamond.toLocaleString()}</b></div>
              <div><span>Crypto amount to send</span><b>{cryptoDisplay} {selected.symbol}</b></div>
              <div><span>USD quote</span><b>{quote.loading ? 'Loading…' : quote.usdPrice ? `$${quote.usdPrice.toLocaleString(undefined, { maximumFractionDigits: 8 })}` : 'Unavailable'}</b></div>
            </div>
            <div className="deposit-note">The crypto amount uses the current market quote for display. The server must independently verify the blockchain transaction before any 💎 is credited.</div>
          </div>

          <div className="deposit-payment-right">
            <div className="deposit-label">PAYMENT INFORMATION</div>
            <PaymentAddress wallet={selected} />

            {!showTxStep ? (
              <>
                <div className="deposit-confirm">
                  Send <b>{cryptoDisplay} {selected.symbol}</b> to the address above on <b>{selected.network}</b>. Only continue after your wallet shows the transaction was submitted.
                  {quote.error && <div className="deposit-note">Live quote is unavailable. Refresh or try again before sending so the exact crypto amount can be calculated safely.</div>}
                </div>
                <button type="button" className="btn btn-success deposit-confirm-btn" onClick={() => setShowTxStep(true)} disabled={!quoteFresh || amount < 0.01 || !cryptoAmount}>
                  I have sent the payment
                </button>
              </>
            ) : (
              <div className="deposit-confirm-step">
                <div className="deposit-confirm"><b>Transaction hash</b><span>Enter the TXID/hash from your wallet. Submitting a hash does not immediately credit 💎; it must be verified against the selected asset, network, destination, amount, confirmations and duplicate history.</span></div>
                <div className="deposit-field">
                  <label>TX HASH / TXID</label>
                  <input value={txHash} onChange={(event) => setTxHash(event.target.value.trim())} placeholder="Paste transaction hash" autoComplete="off" />
                </div>
                <button type="button" className="btn btn-success deposit-confirm-btn" disabled={!txHash} title="The server submission endpoint will be connected in the next finance step">
                  {txHash ? 'Submit for verification' : <><Loader2 size={16} /> Enter TX hash</>}
                </button>
                <div className="deposit-note">Verification endpoint is intentionally not simulated in this UI-only change. No wallet balance is changed from the browser.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>;
  }

  return <div className="deposit-flow">
    <div className="deposit-flow-title">
      <div>
        <div className="eyebrow">TOP UP</div>
        <h2>Choose your cryptocurrency</h2>
        <p>Select the exact asset and network. Then choose the deposit nominal and review the payment details.</p>
      </div>
      <div className="deposit-rate">$1 = <b>10,000 💎</b></div>
    </div>
    <div className="deposit-safety">
      <ShieldAlert size={18} />
      <div><b>Always verify the coin and network</b><span>Wrong asset or network can permanently lose funds. Each option below opens its own payment step and QR code.</span></div>
    </div>
    <div className="deposit-asset-list">
      {wallets.map((wallet) => (
        <button type="button" key={wallet.id} className="deposit-asset" onClick={() => { setSelected(wallet); setShowTxStep(false); setTxHash(''); }}>
          <span className="deposit-asset-logo"><Logo wallet={wallet} /></span>
          <span className="deposit-asset-name"><b>{wallet.name}</b><small>{wallet.symbol}</small></span>
          <span className="deposit-asset-network">{wallet.network}</span>
          <ChevronRight className="deposit-chevron" size={18} />
        </button>
      ))}
    </div>
  </div>;
}
