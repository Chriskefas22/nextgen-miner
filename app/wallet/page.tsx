 "use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  ChevronDown,
  Gem,
  History,
  Loader2,
  RefreshCw,
  Search,
  WalletCards,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DepositFlow } from "@/components/wallet/DepositFlow";
import { createClient } from "@/lib/supabase/client";

type Balance = { asset: string; balance: number; reserved_balance: number };
type Network = { asset: string; network: string };
type Rate = { asset: string; rate_usd: number; observed_at: string };
type Activity = {
  id: number;
  tx_type: string;
  asset: string | null;
  network: string | null;
  crypto_amount: number;
  usd_delta: number;
  diamond_delta: number;
  note: string | null;
  created_at: string;
};

const FALLBACK_ASSETS = [
  "BCH","BNB","BTC","DASH","DGB","DOGE","ETH","FEY","LTC",
  "SOL","TRX","USDC","USDT","ZEC",
];

const CURRENCIES = {
  USD: { label: "US Dollar", symbol: "$", decimals: 2 },
  IDR: { label: "Rupiah Indonesia", symbol: "Rp", decimals: 0 },
  CNY: { label: "Chinese Yuan", symbol: "¥", decimals: 2 },
  EUR: { label: "Euro", symbol: "€", decimals: 2 },
  GBP: { label: "British Pound", symbol: "£", decimals: 2 },
  JPY: { label: "Japanese Yen", symbol: "¥", decimals: 0 },
  KRW: { label: "Korean Won", symbol: "₩", decimals: 0 },
  SGD: { label: "Singapore Dollar", symbol: "S$", decimals: 2 },
  MYR: { label: "Malaysian Ringgit", symbol: "RM", decimals: 2 },
  AUD: { label: "Australian Dollar", symbol: "A$", decimals: 2 },
  CAD: { label: "Canadian Dollar", symbol: "C$", decimals: 2 },
  HKD: { label: "Hong Kong Dollar", symbol: "HK$", decimals: 2 },
} as const;

type CurrencyCode = keyof typeof CURRENCIES;

const iconLetters: Record<string, string> = {
  BCH: "₿", BNB: "B", BTC: "₿", DASH: "D", DGB: "D", DOGE: "Ð",
  ETH: "Ξ", FEY: "F", LTC: "Ł", SOL: "S", TRX: "T", USDC: "$",
  USDT: "₮", ZEC: "Z",
};

const tone = (asset: string) => ({
  BTC: "btc", ETH: "eth", USDT: "usdt", USDC: "usdc", BNB: "bnb",
  SOL: "sol", TRX: "trx", DOGE: "doge", LTC: "ltc", BCH: "bch",
}[asset] ?? "default");

const cryptoFmt = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 12 }).format(n);

const typeLabel = (v: string) =>
  v.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export default function Wallet() {
  const [view, setView] = useState<"summary" | "history">("summary");
  const [action, setAction] = useState<"none" | "deposit" | "withdraw" | "exchange">("none");
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>("USD");
  const [fx, setFx] = useState<Record<string, number>>({ USD: 1 });

  const [diamond, setDiamond] = useState(0);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [assets, setAssets] = useState(FALLBACK_ASSETS);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [withdrawAsset, setWithdrawAsset] = useState("USDT");
  const [withdrawNetwork, setWithdrawNetwork] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [withdrawOk, setWithdrawOk] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  const [exchangeAsset, setExchangeAsset] = useState("USDT");
  const [exchangeAmount, setExchangeAmount] = useState("");
  const [exchangeMsg, setExchangeMsg] = useState("");
  const [exchangeOk, setExchangeOk] = useState("");
  const [exchangeBusy, setExchangeBusy] = useState(false);

  const loadWallet = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true); else setLoading(true);
    try {
      const sb = createClient();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) return;

      const [wallet, crypto, supported, nets, tx, rateRows] = await Promise.all([
        sb.from("nextgen_wallets").select("diamond_balance").eq("user_id", auth.user.id).maybeSingle(),
        sb.from("nextgen_crypto_balances").select("asset,balance,reserved_balance").eq("user_id", auth.user.id).order("asset"),
        sb.from("nextgen_supported_crypto_assets").select("asset").eq("withdrawal_enabled", true).order("asset"),
        sb.from("nextgen_crypto_networks").select("asset,network").eq("enabled", true).order("asset").order("network"),
        sb.from("nextgen_transactions").select("id,tx_type,asset,network,crypto_amount,usd_delta,diamond_delta,note,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(30),
        sb.from("nextgen_exchange_rate_history").select("asset,rate_usd,observed_at").order("observed_at", { ascending: false }).limit(500),
      ]);

      setDiamond(Number(wallet.data?.diamond_balance ?? 0));
      setBalances((crypto.data ?? []).map((x: any) => ({
        asset: String(x.asset),
        balance: Number(x.balance ?? 0),
        reserved_balance: Number(x.reserved_balance ?? 0),
      })));
      if (supported.data?.length) setAssets(supported.data.map((x: any) => String(x.asset)));
      setNetworks((nets.data ?? []).map((x: any) => ({
        asset: String(x.asset),
        network: String(x.network),
      })));
      setActivity((tx.data ?? []).map((x: any) => ({
        id: Number(x.id),
        tx_type: String(x.tx_type ?? "transaction"),
        asset: x.asset ? String(x.asset) : null,
        network: x.network ? String(x.network) : null,
        crypto_amount: Number(x.crypto_amount ?? 0),
        usd_delta: Number(x.usd_delta ?? 0),
        diamond_delta: Number(x.diamond_delta ?? 0),
        note: x.note ? String(x.note) : null,
        created_at: String(x.created_at),
      })));

      const seen = new Set<string>();
      const latest: Rate[] = [];
      for (const x of rateRows.data ?? []) {
        const asset = String(x.asset).toUpperCase();
        if (seen.has(asset)) continue;
        seen.add(asset);
        latest.push({ asset, rate_usd: Number(x.rate_usd ?? 0), observed_at: String(x.observed_at) });
      }
      setRates(latest);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
    void fetch("/api/fx", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.rates) setFx({ USD: 1, ...d.rates });
      })
      .catch(() => {});
  }, [loadWallet]);

  const rateMap = useMemo(
    () => new Map(rates.map((r) => [r.asset.toUpperCase(), r.rate_usd])),
    [rates],
  );

  const available = useCallback(
    (asset: string) => {
      const row = balances.find((b) => b.asset.toUpperCase() === asset.toUpperCase());
      return row ? Math.max(0, row.balance - row.reserved_balance) : 0;
    },
    [balances],
  );

  const totalUsd = useMemo(
    () => balances.reduce((sum, b) => {
      const free = Math.max(0, b.balance - b.reserved_balance);
      return sum + free * (rateMap.get(b.asset.toUpperCase()) ?? 0);
    }, 0),
    [balances, rateMap],
  );

  const convert = useCallback((usd: number) => {
    const amount = usd * (fx[displayCurrency] ?? 1);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: displayCurrency,
      minimumFractionDigits: CURRENCIES[displayCurrency].decimals,
      maximumFractionDigits: CURRENCIES[displayCurrency].decimals,
    }).format(amount);
  }, [displayCurrency, fx]);

  const filteredAssets = assets.filter((a) => !query.trim() || a.includes(query.trim().toUpperCase()));

  const networksFor = useCallback(
    (asset: string) => networks.filter((n) => n.asset.toUpperCase() === asset.toUpperCase()).map((n) => n.network),
    [networks],
  );

  useEffect(() => {
    const n = networksFor(withdrawAsset);
    if (n.length && !n.includes(withdrawNetwork)) setWithdrawNetwork(n[0]);
    if (!n.length) setWithdrawNetwork("");
  }, [withdrawAsset, withdrawNetwork, networksFor]);

  async function withdraw() {
    setWithdrawMsg("");
    setWithdrawOk("");
    const n = Number(withdrawAmount);
    if (!Number.isFinite(n) || n <= 0) return setWithdrawMsg("Masukkan jumlah crypto yang valid.");
    if (!withdrawAddress.trim()) return setWithdrawMsg("Masukkan alamat penerima.");
    if (!withdrawNetwork) return setWithdrawMsg("Network belum tersedia.");
    if (n > available(withdrawAsset)) return setWithdrawMsg("Jumlah melebihi saldo tersedia.");
    setWithdrawBusy(true);
    try {
      const r = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ asset: withdrawAsset, network: withdrawNetwork, cryptoAmount: n, destination: withdrawAddress.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(String(d.error ?? "Withdrawal gagal."));
      setWithdrawOk("Permintaan penarikan sudah dicatat.");
      setWithdrawAmount("");
      setWithdrawAddress("");
      await loadWallet(true);
    } catch (e) {
      setWithdrawMsg(e instanceof Error ? e.message : "Withdrawal gagal.");
    } finally {
      setWithdrawBusy(false);
    }
  }

  async function exchange() {
    setExchangeMsg("");
    setExchangeOk("");
    const n = Number(exchangeAmount);
    if (!Number.isFinite(n) || n <= 0) return setExchangeMsg("Masukkan jumlah crypto yang valid.");
    if (n > available(exchangeAsset)) return setExchangeMsg("Jumlah melebihi saldo tersedia.");
    setExchangeBusy(true);
    try {
      const r = await fetch("/api/wallet/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ asset: exchangeAsset, cryptoAmount: n }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(String(d.error ?? "Exchange gagal."));
      setExchangeOk(`Berhasil ditukar menjadi ${new Intl.NumberFormat("en-US").format(Number(d.diamondAmount ?? 0))} 💎.`);
      setExchangeAmount("");
      await loadWallet(true);
    } catch (e) {
      setExchangeMsg(e instanceof Error ? e.message : "Exchange gagal.");
    } finally {
      setExchangeBusy(false);
    }
  }

  if (loading) {
    return <AppShell><div className="wallet-simple-loading"><Loader2 className="spin" size={20} /> Memuat wallet…</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="wallet-simple-page">
        <header className="wallet-simple-header">
          <div>
            <h1>Dompet</h1>
            <p>Saldo, deposit, penarikan, dan tukar</p>
          </div>

          <label className="wallet-currency-picker">
            <span className="wallet-currency-symbol">{CURRENCIES[displayCurrency].symbol}</span>
            <select
              className="wallet-currency"
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value as CurrencyCode)}
              aria-label="Pilih mata uang tampilan"
            >
              {Object.entries(CURRENCIES).map(([code, meta]) => (
                <option key={code} value={code}>{code} — {meta.label}</option>
              ))}
            </select>
            <ChevronDown size={15} className="wallet-currency-chevron" />
          </label>
        </header>

        <div className="wallet-simple-tabs">
          <button className={view === "summary" ? "active" : ""} type="button" onClick={() => { setView("summary"); setAction("none"); }}>Ringkasan</button>
          <button className={view === "history" ? "active" : ""} type="button" onClick={() => { setView("history"); setAction("none"); }}>Riwayat</button>
        </div>

        {view === "summary" && action === "none" && (
          <>
            <section className="wallet-balance-hero">
              <span>TOTAL SALDO</span>
              <strong>{convert(totalUsd)}</strong>
              <div className="wallet-balance-secondary">
                <span><Gem size={14} /> {new Intl.NumberFormat("en-US").format(diamond)} 💎</span>
                <span>{balances.length} koin</span>
              </div>
              <div className="wallet-primary-actions">
                <button type="button" className="primary" onClick={() => setAction("deposit")}><ArrowDownToLine size={18} /> Setoran</button>
                <button type="button" className="secondary" onClick={() => setAction("withdraw")}><ArrowUpFromLine size={18} /> Penarikan</button>
              </div>
            </section>

            <section className="wallet-coins-section">
              <div className="wallet-section-title">
                <h2>Koin</h2>
                <button className="wallet-refresh-mini" type="button" onClick={() => void loadWallet(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "spin" : ""} /></button>
              </div>

              <div className="wallet-search">
                <Search size={18} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari koin..." />
              </div>

              <div className="wallet-coin-list">
                {filteredAssets.map((asset) => {
                  const amount = available(asset);
                  const usd = amount * (rateMap.get(asset.toUpperCase()) ?? 0);
                  return (
                    <article className="wallet-coin-card" key={asset}>
                      <div className={`wallet-coin-icon ${tone(asset)}`}>{iconLetters[asset] ?? asset.slice(0, 2)}</div>
                      <div className="wallet-coin-main">
                        <div className="wallet-coin-name">{asset}</div>
                        <div className="wallet-coin-amount">{cryptoFmt(amount)}</div>
                      </div>
                      <div className="wallet-coin-right">
                        <strong>{convert(usd)}</strong>
                        <div className="wallet-coin-actions">
                          <button type="button" onClick={() => { setWithdrawAsset(asset); setAction("withdraw"); }}>Penarikan</button>
                          <button type="button" onClick={() => { setExchangeAsset(asset); setAction("exchange"); }}>Tukar</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {view === "summary" && action === "deposit" && (
          <section className="wallet-action-panel">
            <button className="wallet-action-back" type="button" onClick={() => setAction("none")}><ArrowLeft size={16} /> Kembali</button>
            <DepositFlow />
          </section>
        )}

        {view === "summary" && action === "withdraw" && (
          <section className="wallet-action-panel">
            <button className="wallet-action-back" type="button" onClick={() => setAction("none")}><ArrowLeft size={16} /> Kembali</button>
            <div className="wallet-action-title"><h2>Penarikan</h2><p>Kirim crypto dari saldo wallet Anda.</p></div>
            <div className="wallet-simple-form">
              <div className="wallet-form-label">KOIN</div>
              <div className="wallet-asset-strip">
                {assets.map((asset) => (
                  <button key={asset} type="button" className={withdrawAsset === asset ? "selected" : ""} onClick={() => setWithdrawAsset(asset)}>
                    <span className={`mini-token ${tone(asset)}`}>{iconLetters[asset] ?? asset.slice(0, 2)}</span>{asset}
                  </button>
                ))}
              </div>
              <label className="wallet-form-field"><span>NETWORK</span><select value={withdrawNetwork} onChange={(e) => setWithdrawNetwork(e.target.value)}><option value="">Pilih network</option>{networksFor(withdrawAsset).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label className="wallet-form-field"><span>ALAMAT PENERIMA</span><input value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} placeholder="Masukkan alamat wallet" /></label>
              <label className="wallet-form-field"><span>JUMLAH ({withdrawAsset})</span><div className="wallet-max-input"><input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} inputMode="decimal" placeholder="0.00000000" /><button type="button" onClick={() => setWithdrawAmount(String(available(withdrawAsset)))}>MAX</button></div></label>
              {withdrawMsg && <div className="wallet-simple-message error">{withdrawMsg}</div>}
              {withdrawOk && <div className="wallet-simple-message success">{withdrawOk}</div>}
              <button type="button" className="wallet-wide-button" disabled={withdrawBusy} onClick={() => void withdraw()}>{withdrawBusy ? <><Loader2 className="spin" size={18} /> Memproses…</> : <>Penarikan <ArrowRight size={17} /></>}</button>
            </div>
          </section>
        )}

        {view === "summary" && action === "exchange" && (
          <section className="wallet-action-panel">
            <button className="wallet-action-back" type="button" onClick={() => setAction("none")}><ArrowLeft size={16} /> Kembali</button>
            <div className="wallet-action-title"><h2>Tukar ke 💎</h2><p>Crypto ditukar menjadi Diamond.</p></div>
            <div className="wallet-simple-form">
              <div className="wallet-form-label">KOIN</div>
              <div className="wallet-asset-strip">
                {assets.map((asset) => (
                  <button key={asset} type="button" className={exchangeAsset === asset ? "selected" : ""} onClick={() => setExchangeAsset(asset)}>
                    <span className={`mini-token ${tone(asset)}`}>{iconLetters[asset] ?? asset.slice(0, 2)}</span>{asset}
                  </button>
                ))}
              </div>
              <div className="wallet-current-balance"><span>Saldo tersedia</span><strong>{cryptoFmt(available(exchangeAsset))} {exchangeAsset}</strong></div>
              <label className="wallet-form-field"><span>JUMLAH ({exchangeAsset})</span><div className="wallet-max-input"><input value={exchangeAmount} onChange={(e) => setExchangeAmount(e.target.value)} inputMode="decimal" placeholder="0.00000000" /><button type="button" onClick={() => setExchangeAmount(String(available(exchangeAsset)))}>MAX</button></div></label>
              {exchangeMsg && <div className="wallet-simple-message error">{exchangeMsg}</div>}
              {exchangeOk && <div className="wallet-simple-message success">{exchangeOk}</div>}
              <button type="button" className="wallet-wide-button" disabled={exchangeBusy || !available(exchangeAsset)} onClick={() => void exchange()}>{exchangeBusy ? <><Loader2 className="spin" size={18} /> Memproses…</> : <>Tukar ke 💎 <ArrowRight size={17} /></>}</button>
            </div>
          </section>
        )}

        {view === "history" && (
          <section className="wallet-history-simple">
            <div className="wallet-section-title"><div><h2>Riwayat</h2><p>Setoran, penarikan, dan tukar.</p></div><History size={20} /></div>
            {activity.length ? (
              <div className="wallet-history-list">
                {activity.map((tx) => (
                  <div className="wallet-history-row" key={tx.id}>
                    <div className="wallet-history-icon"><History size={16} /></div>
                    <div className="wallet-history-copy"><b>{typeLabel(tx.tx_type)}</b><small>{tx.asset ?? "Wallet"}</small></div>
                    <div className="wallet-history-value"><b>{tx.crypto_amount ? `${cryptoFmt(Math.abs(tx.crypto_amount))} ${tx.asset ?? ""}` : tx.diamond_delta ? `💎 ${new Intl.NumberFormat("en-US").format(Math.abs(tx.diamond_delta))}` : "Updated"}</b><small>{new Date(tx.created_at).toLocaleString()}</small></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="wallet-empty-history"><WalletCards size={22} /><b>Belum ada riwayat</b><span>Aktivitas wallet akan muncul di sini.</span></div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
