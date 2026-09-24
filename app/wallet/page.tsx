"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock3,
  Gem,
  History,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DepositFlow } from "@/components/wallet/DepositFlow";
import { createClient } from "@/lib/supabase/client";

type Balance = { asset: string; balance: number; reserved_balance: number };
type Net = { asset: string; network: string };
type Activity = {
  id: number;
  tx_type: string;
  diamond_delta: number;
  usd_delta: number;
  asset: string | null;
  network: string | null;
  crypto_amount: number;
  reference_id: string | null;
  note: string | null;
  created_at: string;
};

const FALLBACK = ["BCH", "BNB", "BTC", "DASH", "DGB", "DOGE", "ETH", "FEY", "LTC", "SOL", "TRX", "USDC", "USDT", "ZEC"];
const fmt = (n: number, d = 8) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(n);

function withdrawalError(s: string) {
  if (s.includes("WITHDRAWAL_MINIMUM_1_USD") || s.includes("WITHDRAWAL_AMOUNT_OUT_OF_RANGE")) return "Saldo belum mencapai minimum withdrawal $1.00.";
  if (s.includes("INSUFFICIENT_CRYPTO")) return "Saldo crypto tersedia tidak cukup untuk withdrawal ini.";
  if (s.includes("ASSET_RATE_STALE")) return "Kurs crypto sedang diperbarui. Coba lagi setelah kurs terbaru tersedia.";
  if (s.includes("ASSET_RATE_MISSING")) return "Kurs crypto untuk aset ini belum tersedia.";
  if (s.includes("INVALID_DESTINATION")) return "Alamat penerima tidak valid.";
  if (s.includes("INVALID_NETWORK") || s.includes("UNSUPPORTED_NETWORK")) return "Network tidak tersedia untuk aset ini.";
  return s || "Withdrawal tidak dapat diproses.";
}

function exchangeError(s: string) {
  if (s.includes("ASSET_RATE_STALE")) return "Kurs crypto sedang diperbarui. Coba lagi setelah kurs terbaru tersedia.";
  if (s.includes("ASSET_RATE_MISSING")) return "Kurs crypto untuk aset ini belum tersedia.";
  if (s.includes("INSUFFICIENT_CRYPTO")) return "Saldo crypto tidak mencukupi untuk exchange ini.";
  return s || "Exchange tidak dapat diproses.";
}

function shortType(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\\s)\\S/g, (c) => c.toUpperCase());
}

export default function Wallet() {
  const [tab, setTab] = useState<"deposit" | "withdraw" | "exchange">("deposit");
  const [diamond, setDiamond] = useState<number | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [assets, setAssets] = useState<string[]>(FALLBACK);
  const [nets, setNets] = useState<Net[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const [exAsset, setExAsset] = useState("USDT");
  const [exAmount, setExAmount] = useState("");
  const [exMsg, setExMsg] = useState("");
  const [exOk, setExOk] = useState("");
  const [exBusy, setExBusy] = useState(false);

  const loadWallet = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);

    try {
      const sb = createClient();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) return;

      const [wallet, crypto, supported, networks, tx] = await Promise.all([
        sb.from("nextgen_wallets").select("diamond_balance").eq("user_id", auth.user.id).maybeSingle(),
        sb.from("nextgen_crypto_balances").select("asset,balance,reserved_balance").eq("user_id", auth.user.id).order("asset"),
        sb.from("nextgen_supported_crypto_assets").select("asset").eq("withdrawal_enabled", true).order("asset"),
        sb.from("nextgen_crypto_networks").select("asset,network").eq("enabled", true).order("asset").order("network"),
        sb.from("nextgen_transactions").select("id,tx_type,diamond_delta,usd_delta,asset,network,crypto_amount,reference_id,note,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(8),
      ]);

      setDiamond(Number(wallet.data?.diamond_balance ?? 0));
      setBalances((crypto.data ?? []).map((x: any) => ({
        asset: String(x.asset),
        balance: Number(x.balance ?? 0),
        reserved_balance: Number(x.reserved_balance ?? 0),
      })));
      if (supported.data?.length) setAssets(supported.data.map((x: any) => String(x.asset)));
      setNets((networks.data ?? []).map((x: any) => ({ asset: String(x.asset), network: String(x.network) })));
      setActivity((tx.data ?? []).map((x: any) => ({
        id: Number(x.id),
        tx_type: String(x.tx_type ?? "transaction"),
        diamond_delta: Number(x.diamond_delta ?? 0),
        usd_delta: Number(x.usd_delta ?? 0),
        asset: x.asset ? String(x.asset) : null,
        network: x.network ? String(x.network) : null,
        crypto_amount: Number(x.crypto_amount ?? 0),
        reference_id: x.reference_id ? String(x.reference_id) : null,
        note: x.note ? String(x.note) : null,
        created_at: String(x.created_at),
      })));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const netFor = useCallback((a: string) => nets.filter((x) => x.asset.toUpperCase() === a.toUpperCase()).map((x) => x.network), [nets]);
  const bal = useCallback((a: string) => balances.find((x) => x.asset.toUpperCase() === a.toUpperCase()), [balances]);
  const available = useCallback((a: string) => {
    const b = bal(a);
    return b ? Math.max(0, b.balance - b.reserved_balance) : 0;
  }, [bal]);

  const availableAssets = useMemo(() => balances.filter((b) => available(b.asset) > 0), [balances, available]);
  const totalReserved = useMemo(() => balances.reduce((sum, b) => sum + Math.max(0, b.reserved_balance), 0), [balances]);
  const totalCryptoPositions = balances.filter((b) => b.balance > 0).length;

  useEffect(() => {
    const ns = netFor(asset);
    if (ns.length && !ns.includes(network)) setNetwork(ns[0]);
    else if (!ns.length) setNetwork("");
  }, [asset, network, netFor]);

  const displayActivity = activity.slice(0, 6);

  async function withdraw() {
    setMsg(""); setOk("");
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setMsg("Masukkan jumlah crypto yang valid.");
    if (!destination.trim()) return setMsg("Masukkan alamat penerima.");
    if (!network) return setMsg("Network untuk aset ini belum tersedia.");
    if (n > available(asset)) return setMsg("Jumlah melebihi saldo crypto yang tersedia.");

    setBusy(true);
    try {
      const r = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ asset, network, cryptoAmount: n, destination: destination.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(String(d.error ?? "Withdrawal gagal."));
      setOk("Withdrawal berhasil dicatat sebagai pending.");
      setAmount(""); setDestination("");
      await loadWallet(true);
    } catch (e) {
      setMsg(withdrawalError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function exchange() {
    setExMsg(""); setExOk("");
    const n = Number(exAmount);
    if (!Number.isFinite(n) || n <= 0) return setExMsg("Masukkan jumlah crypto yang valid.");
    if (n > available(exAsset)) return setExMsg("Jumlah melebihi saldo crypto yang tersedia.");

    setExBusy(true);
    try {
      const r = await fetch("/api/wallet/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ asset: exAsset, cryptoAmount: n }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(String(d.error ?? "Exchange gagal."));
      setExOk("Exchange berhasil menjadi " + fmt(Number(d.diamondAmount ?? 0), 2) + " 💎.");
      setExAmount("");
      await loadWallet(true);
    } catch (e) {
      setExMsg(exchangeError(e instanceof Error ? e.message : ""));
    } finally {
      setExBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="wallet-loading-page">
          <Loader2 className="spin" size={22} />
          Loading wallet…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="wallet-page-v2">
        <div className="wallet-v2-head">
          <div>
            <div className="eyebrow">WALLET CORE</div>
            <h1 className="page-title">Wallet</h1>
            <div className="muted">Real crypto balance, secure deposits, withdrawal reserve and Crypto → Diamond.</div>
          </div>
          <button className="wallet-refresh" type="button" onClick={() => void loadWallet(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            Refresh
          </button>
        </div>

        <section className="wallet-overview-grid">
          <div className="wallet-overview-card wallet-overview-primary">
            <div className="wallet-overview-icon"><Gem size={19} /></div>
            <div>
              <span>DIAMOND BALANCE</span>
              <strong>{fmt(diamond ?? 0, 2)}</strong>
              <small>Used inside NextGenMiner</small>
            </div>
          </div>
          <div className="wallet-overview-card">
            <div className="wallet-overview-icon"><WalletCards size={19} /></div>
            <div>
              <span>CRYPTO ASSETS</span>
              <strong>{totalCryptoPositions}</strong>
              <small>{availableAssets.length} with available balance</small>
            </div>
          </div>
          <div className="wallet-overview-card">
            <div className="wallet-overview-icon"><LockKeyhole size={19} /></div>
            <div>
              <span>RESERVED</span>
              <strong>{fmt(totalReserved, 8)}</strong>
              <small>Locked for pending requests</small>
            </div>
          </div>
          <div className="wallet-overview-card">
            <div className="wallet-overview-icon"><ShieldCheck size={19} /></div>
            <div>
              <span>SETTLEMENT</span>
              <strong>SERVER</strong>
              <small>Provider callbacks are verified</small>
            </div>
          </div>
        </section>

        <section className="wallet-balance-shell glass">
          <div className="wallet-balance-head">
            <div>
              <div className="eyebrow">CRYPTO PORTFOLIO</div>
              <h2>Available balances</h2>
            </div>
            <span className="wallet-live-chip"><span /> LIVE</span>
          </div>

          {balances.length ? (
            <div className="wallet-balance-grid-v2">
              {balances.map((b) => {
                const free = available(b.asset);
                return (
                  <div className="wallet-asset-card-v2" key={b.asset}>
                    <div className="wallet-asset-topline">
                      <span className="wallet-asset-token">{b.asset.slice(0, 3)}</span>
                      <b>{b.asset}</b>
                      {free > 0 ? <span className="wallet-available-pill">AVAILABLE</span> : <span className="wallet-zero-pill">ZERO</span>}
                    </div>
                    <strong>{fmt(free)}</strong>
                    <small>Available</small>
                    {b.reserved_balance > 0 && <em>Reserved {fmt(b.reserved_balance)}</em>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="wallet-empty">
              <WalletCards size={22} />
              <b>No crypto balance yet</b>
              <span>Make a deposit to start using your real crypto wallet.</span>
            </div>
          )}
        </section>

        <section className="wallet-main-shell glass">
          <div className="wallet-tabs-v2">
            <button className={tab === "deposit" ? "active" : ""} onClick={() => setTab("deposit")} type="button">
              <ArrowDownToLine size={16} /> Deposit
            </button>
            <button className={tab === "withdraw" ? "active" : ""} onClick={() => setTab("withdraw")} type="button">
              <ArrowUpFromLine size={16} /> Penarikan
            </button>
            <button className={tab === "exchange" ? "active" : ""} onClick={() => setTab("exchange")} type="button">
              <Gem size={16} /> Crypto → 💎
            </button>
          </div>

          {tab === "deposit" && <DepositFlow />}

          {tab === "withdraw" && (
            <div className="wallet-form-v2">
              <div className="wallet-form-head">
                <div>
                  <div className="eyebrow">CRYPTO WITHDRAWAL</div>
                  <h2>Send crypto from your balance</h2>
                  <p className="muted">💎 Diamond cannot be withdrawn. Withdrawal requests reserve crypto until their final status.</p>
                </div>
                <div className="wallet-secure-chip"><ShieldCheck size={15} /> Balance locked server-side</div>
              </div>

              <div className="wallet-asset-picker">
                {assets.map((a) => {
                  const free = available(a);
                  return (
                    <button key={a} className={asset === a ? "selected" : ""} type="button" onClick={() => setAsset(a)}>
                      <span>{a.slice(0, 3)}</span>
                      <b>{a}</b>
                      <small>{fmt(free)}</small>
                    </button>
                  );
                })}
              </div>

              <div className="wallet-form-grid">
                <div className="field">
                  <label>NETWORK</label>
                  <select className="input" value={network} onChange={(e) => setNetwork(e.target.value)} disabled={!netFor(asset).length}>
                    <option value="">Select network</option>
                    {netFor(asset).map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>AVAILABLE {asset}</label>
                  <div className="wallet-value-box">{fmt(available(asset))} {asset}<button type="button" onClick={() => setAmount(String(available(asset)))} disabled={!available(asset)}>MAX</button></div>
                </div>
              </div>

              <div className="field">
                <label>RECIPIENT ADDRESS</label>
                <input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Wallet address penerima" autoComplete="off" />
              </div>
              <div className="field">
                <label>AMOUNT ({asset})</label>
                <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00000000" />
              </div>

              {msg && <div className="wallet-message error">{msg}</div>}
              {ok && <div className="wallet-message success">{ok}</div>}

              <button className="btn btn-primary wallet-full-btn" type="button" disabled={busy || !netFor(asset).length || !available(asset)} onClick={withdraw}>
                {busy ? "Processing…" : "Request Withdrawal"}
              </button>

              <div className="wallet-rule-grid">
                <div><Zap size={15} /><span>Minimum $1.00</span></div>
                <div><LockKeyhole size={15} /><span>Balance reserved first</span></div>
                <div><ShieldCheck size={15} /><span>Server-side validation</span></div>
              </div>
            </div>
          )}

          {tab === "exchange" && (
            <div className="wallet-exchange-v2">
              <div className="wallet-form-v2">
                <div className="wallet-form-head">
                  <div>
                    <div className="eyebrow">ONE-WAY EXCHANGE</div>
                    <h2>Crypto → Diamond</h2>
                    <p className="muted">Convert real crypto into 💎 for miners and hashrate. The direction is intentionally one-way.</p>
                  </div>
                  <div className="wallet-secure-chip"><Gem size={15} /> Non-withdrawable</div>
                </div>

                <div className="field">
                  <label>CRYPTO ASSET</label>
                  <select className="input" value={exAsset} onChange={(e) => setExAsset(e.target.value)}>
                    {assets.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>AVAILABLE</label>
                  <div className="wallet-value-box">{fmt(available(exAsset))} {exAsset}<button type="button" onClick={() => setExAmount(String(available(exAsset)))} disabled={!available(exAsset)}>MAX</button></div>
                </div>
                <div className="field">
                  <label>AMOUNT ({exAsset})</label>
                  <input className="input" value={exAmount} onChange={(e) => setExAmount(e.target.value)} inputMode="decimal" placeholder="0.00000000" />
                </div>
                {exMsg && <div className="wallet-message error">{exMsg}</div>}
                {exOk && <div className="wallet-message success">{exOk}</div>}
                <button className="btn btn-primary wallet-full-btn" type="button" disabled={exBusy || !available(exAsset)} onClick={exchange}>
                  {exBusy ? "Processing…" : "Exchange Crypto → 💎"}
                </button>
              </div>

              <aside className="wallet-exchange-card">
                <div className="wallet-exchange-icon"><Gem size={22} /></div>
                <div className="eyebrow">ECONOMY RULE</div>
                <h3>Diamond is internal</h3>
                <p className="muted">💎 is used for miners, upgrades and website economy. It is not a withdrawal asset.</p>
                <div className="wallet-exchange-line"><span>Crypto in</span><b>Real balance</b></div>
                <div className="wallet-exchange-line"><span>Diamond out</span><b>💎 Internal</b></div>
                <div className="wallet-exchange-line"><span>Reverse exchange</span><b>Not available</b></div>
              </aside>
            </div>
          )}
        </section>

        <section className="wallet-activity-shell glass">
          <div className="wallet-balance-head">
            <div>
              <div className="eyebrow">ACTIVITY</div>
              <h2>Recent wallet transactions</h2>
            </div>
            <History size={18} className="wallet-head-icon" />
          </div>

          {displayActivity.length ? (
            <div className="wallet-activity-list">
              {displayActivity.map((tx) => {
                const positive = Number(tx.crypto_amount) > 0 || Number(tx.usd_delta) > 0 || Number(tx.diamond_delta) > 0;
                return (
                  <div className="wallet-activity-row" key={tx.id}>
                    <div className={positive ? "wallet-activity-icon positive" : "wallet-activity-icon"}>
                      {tx.tx_type.toLowerCase().includes("withdraw") ? <ArrowUpFromLine size={16} /> : <ArrowDownToLine size={16} />}
                    </div>
                    <div className="wallet-activity-copy">
                      <b>{shortType(tx.tx_type)}</b>
                      <small>{tx.asset ? tx.asset + (tx.network ? " • " + tx.network : "") : tx.note || "Wallet transaction"}</small>
                    </div>
                    <div className="wallet-activity-right">
                      <b>{tx.crypto_amount ? fmt(tx.crypto_amount) + " " + (tx.asset || "") : tx.diamond_delta ? "💎 " + fmt(Math.abs(tx.diamond_delta), 2) : "Updated"}</b>
                      <small><Clock3 size={12} /> {new Date(tx.created_at).toLocaleString()}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="wallet-empty wallet-empty-compact">
              <History size={20} />
              <b>No wallet activity yet</b>
              <span>Your deposits, withdrawals and exchanges will appear here.</span>
            </div>
          )}
        </section>

        <div className="wallet-safety-banner">
          <ShieldCheck size={18} />
          <div>
            <b>Security & settlement</b>
            <span>Provider callbacks are verified server-side. Never share API keys, seed phrases or private keys with anyone.</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
