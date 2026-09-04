'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowLeft, Check, ChevronRight, Copy, ShieldAlert } from 'lucide-react';

type Wallet = {
  id: string; name: string; symbol: string; network: string; address: string;
  icon: string; color: string; warning?: string; note?: string;
};

const wallets: Wallet[] = [
  { id:'btc', name:'Bitcoin', symbol:'BTC', network:'Bitcoin Chain', address:'13bvoKfBsVtE1xLcbYP8oVw9QRURaAZUkY', icon:'bitcoin', color:'#f7931a' },
  { id:'eth', name:'Ethereum', symbol:'ETH', network:'Ethereum Chain', address:'0x7AC694DA231fdDba9a72448a27fdc51a1393CBeB', icon:'ethereum', color:'#8b92ff' },
  { id:'bch', name:'Bitcoin Cash', symbol:'BCH', network:'Bitcoin Cash Chain', address:'bitcoincash:qr8jw9wh9s8yd59gc86vvzx7lrejpdqdjyr7xc83az', icon:'bitcoin-cash', color:'#22c55e' },
  { id:'ada', name:'Cardano', symbol:'ADA', network:'Cardano Chain', address:'addr1qyffsxlt9dgf7tyfj5vc3xvt3l4e4ucdms78dtugqw5z9gdqwk5rzfhp7pkaz7pwrve8s58fhvj59hgu0wlpfmrxsafqg29exv', icon:'cardano', color:'#3b82f6' },
  { id:'dash', name:'Dash', symbol:'DASH', network:'Dash Chain', address:'Xydoi8R5Hsce6SMbRaZXGvEGEd2u6mii52', icon:'dash', color:'#1787d7' },
  { id:'dgb', name:'DigiByte', symbol:'DGB', network:'DigiByte Chain', address:'DC7jb8HV17nr8KEUU93CKVruUUTstKmFQW', icon:'digibyte', color:'#006ad6' },
  { id:'doge', name:'Dogecoin', symbol:'DOGE', network:'Dogecoin Chain', address:'D7YPWikXJYrZgATya7Y79CeQrcneG7H3kR', icon:'dogecoin', color:'#c2a633' },
  { id:'ltc', name:'Litecoin', symbol:'LTC', network:'Litecoin Chain', address:'ltc1qv00frrh9hxds3uz0r97ulaujped5ek9eusnaw0', icon:'litecoin', color:'#b7b7b7' },
  { id:'xmr', name:'Monero', symbol:'XMR', network:'Monero Chain', address:'4Bw5E7qSTCyUijTko5mQzSah8AQiJHnyV7XKBqwRkr6aWgRLNkUXvXkYrtVoj65GcmK7xQVCceJ6VgiCz4msqgdZ2Aui6ejTFsiGsAgdkS', icon:'monero', color:'#ff6600' },
  { id:'pol', name:'Polygon', symbol:'POL', network:'Polygon PoS', address:'0x0eeb0d52628441403a85E9F0fC5137255af9A8AC', icon:'polygon', color:'#8247e5' },
  { id:'sol', name:'Solana', symbol:'SOL', network:'Solana Chain', address:'HC664vbxGBe3DFJSfCAetau1KjzphtEnopT42EeHgmq3', icon:'solana', color:'#8b5cf6' },
  { id:'ton', name:'Toncoin', symbol:'TON', network:'TON Chain', address:'UQAXW6RU8aUj6hInPJMWCY9glFOT0ladnW7neyDThe5hcaIr', icon:'ton', color:'#0098ea' },
  { id:'trx', name:'Tron', symbol:'TRX', network:'TRON / TRC20', address:'TLTKUNf2MCKUchiYScj9o3mHhMcjhZtBEs', icon:'tron', color:'#ef3340' },
  { id:'usdt-trc20', name:'Tether', symbol:'USDT', network:'TRC20 / TRON', address:'TLTKUNf2MCKUchiYScj9o3mHhMcjhZtBEs', icon:'tether', color:'#26a17b' },
  { id:'usdt-polygon', name:'Tether', symbol:'USDT', network:'Polygon PoS', address:'0x0eeb0d52628441403a85E9F0fC5137255af9A8AC', icon:'tether', color:'#26a17b' },
  { id:'usdt-erc20', name:'Tether', symbol:'USDT', network:'ERC20 / Ethereum', address:'0x7AC694DA231fdDba9a72448a27fdc51a1393CBeB', icon:'tether', color:'#26a17b' },
  { id:'usdt-bep20', name:'Tether', symbol:'USDT', network:'BEP20 / BNB Chain', address:'0x5C81a904F4134aB34a38D8159BDa8825Cdf92Bdd', icon:'tether', color:'#26a17b' },
  { id:'bnb', name:'Binance Coin', symbol:'BNB', network:'BNB Chain', address:'0x5C81a904F4134aB34a38D8159BDa8825Cdf92Bdd', icon:'bnb', color:'#f3ba2f', warning:'BNB only. Send only BNB on the BNB chain. Sending the wrong coin or using a different network will result in a permanent loss of funds. We are not responsible for lost funds.', note:'First-time deposits can take up to 30 minutes depending on network congestion. We do not support deposits from smart contracts — recovery fees apply.' },
];

const amounts = [1, 5, 10, 25, 50, 100];

function Logo({ wallet }: { wallet: Wallet }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="deposit-logo-fallback" style={{color:wallet.color}}>{wallet.symbol.slice(0,4)}</span>;
  return <img src={`https://cdn.simpleicons.org/${wallet.icon}`} alt="" onError={() => setFailed(true)} />;
}

function PaymentAddress({ wallet }: { wallet: Wallet }) {
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(wallet.address, { width: 280, margin: 2, errorCorrectionLevel: 'M' })
      .then(url => live && setQr(url)).catch(() => live && setQr(''));
    return () => { live = false; };
  }, [wallet.address]);
  async function copy() {
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch {}
  }
  return <>
    <div className="deposit-qr">{qr ? <img src={qr} alt={`${wallet.symbol} ${wallet.network} deposit QR code`} /> : <span>Generating QR…</span>}</div>
    <div className="deposit-address-title">WALLET ADDRESS</div>
    <div className="deposit-address"><code>{wallet.address}</code><button onClick={copy} aria-label="Copy wallet address">{copied ? <Check size={17}/> : <Copy size={17}/>}</button></div>
    <div className="deposit-warning"><ShieldAlert size={16}/><span>{wallet.warning ?? `Send only ${wallet.symbol} on the ${wallet.network}. Sending the wrong asset or using a different network may result in permanent loss of funds.`}</span></div>
    {wallet.note && <div className="deposit-note">{wallet.note}</div>}
  </>;
}

export function DepositFlow() {
  const [selected, setSelected] = useState<Wallet | null>(null);
  const [usd, setUsd] = useState(1);
  const [customUsd, setCustomUsd] = useState('');
  const amount = Math.max(0, customUsd ? Number(customUsd) || 0 : usd);
  const diamond = amount * 10000;
  const displayAmount = useMemo(() => amount.toFixed(2), [amount]);

  if (selected) return <div className="deposit-flow">
    <button className="deposit-back" onClick={() => setSelected(null)}><ArrowLeft size={17}/> Back to assets</button>
    <div className="deposit-payment-card">
      <div className="deposit-payment-head">
        <div className="deposit-coin"><span className="deposit-coin-icon"><Logo wallet={selected}/></span><div><h2>{selected.name} ({selected.symbol})</h2><span>{selected.network}</span></div></div>
        <span className="deposit-step">STEP 2 / 2</span>
      </div>
      <div className="deposit-payment-grid">
        <div className="deposit-payment-left">
          <div className="deposit-label">SELECT DEPOSIT NOMINAL</div>
          <div className="deposit-amounts">{amounts.map(v => <button key={v} onClick={() => {setUsd(v);setCustomUsd('')}} className={!customUsd && usd===v ? 'active' : ''}>${v.toFixed(2)}</button>)}</div>
          <div className="deposit-field"><label>CUSTOM AMOUNT (USD)</label><input type="number" min="0.01" step="0.01" value={customUsd} onChange={e=>setCustomUsd(e.target.value)} placeholder="1.00"/></div>
          <div className="deposit-summary">
            <div><span>Deposit nominal</span><b>${displayAmount}</b></div>
            <div><span>You receive</span><b>💎 {diamond.toLocaleString()}</b></div>
            <div className="total"><span>Total to send</span><b>{displayAmount} {selected.symbol} equivalent</b></div>
          </div>
        </div>
        <div className="deposit-payment-right">
          <div className="deposit-label">PAYMENT INFORMATION</div>
          <PaymentAddress wallet={selected}/>
          <div className="deposit-confirm">Send the exact amount through the selected network. After sending, the next confirmation step will collect the transaction hash so the server can verify the payment before crediting 💎.</div>
          <button className="btn btn-success deposit-confirm-btn">I have sent the payment</button>
        </div>
      </div>
    </div>
  </div>;

  return <div className="deposit-flow">
    <div className="deposit-flow-title"><div><div className="eyebrow">TOP UP</div><h2>Choose your cryptocurrency</h2><p>Select the exact asset and network. Then choose the deposit nominal and review the payment details.</p></div><div className="deposit-rate">$1 = <b>10,000 💎</b></div></div>
    <div className="deposit-safety"><ShieldAlert size={18}/><div><b>Always verify the coin and network</b><span>Wrong asset or network can permanently lose funds. Each option below opens its own payment step and QR code.</span></div></div>
    <div className="deposit-asset-list">{wallets.map(wallet => <button key={wallet.id} className="deposit-asset" onClick={() => setSelected(wallet)}><span className="deposit-asset-logo"><Logo wallet={wallet}/></span><span className="deposit-asset-name"><b>{wallet.name}</b><small>{wallet.symbol}</small></span><span className="deposit-asset-network">{wallet.network}</span><ChevronRight className="deposit-chevron" size={18}/></button>)}</div>
  </div>;
}
