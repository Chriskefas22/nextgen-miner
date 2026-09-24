"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Copy,
  ExternalLink,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type O = {
  id: string;
  asset: string;
  network: string;
  destination: string;
  warningMessage: string | null;
  firstDepositNote: string | null;
  displayName: string;
  minDeposit: number;
  confirmationsRequired: number;
};

const IDS: Record<string, string> = {
  BCH: "bitcoin-cash",
  BNB: "binancecoin",
  BTC: "bitcoin",
  DASH: "dash",
  DGB: "digibyte",
  DOGE: "dogecoin",
  ETH: "ethereum",
  FEY: "feyorra",
  LTC: "litecoin",
  SOL: "solana",
  TRX: "tron",
  USDC: "usd-coin",
  USDT: "tether",
  ZEC: "zcash",
};

const nominal = [1, 5, 10, 25, 50, 100];

function formatCrypto(value: number | null, asset: string) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumSignificantDigits: asset === "BTC" || asset === "ETH" ? 9 : 12,
  });
}

export function DepositFlow() {
  const [opts, setOpts] = useState<O[]>([]);
  const [sel, setSel] = useState<O | null>(null);
  const [usd, setUsd] = useState(1);
  const [custom, setCustom] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hash, setHash] = useState("");
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [oxapayUrl, setOxapayUrl] = useState("");
  const [oxapayTrackId, setOxapayTrackId] = useState("");

  useEffect(() => {
    let live = true;

    fetch("/api/deposit/options", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Unable to load assets");
        if (live) setOpts(d.options || []);
      })
      .catch((e) => live && setError(e.message || "Unable to load deposit assets."))
      .finally(() => live && setLoading(false));

    return () => {
      live = false;
    };
  }, []);

  const uniqueOptions = useMemo(() => {
    const seen = new Set<string>();
    const result: O[] = [];

    for (const option of opts) {
      const asset = option.asset.toUpperCase();

      if (asset === "USDT") {
        if (seen.has("USDT_OXAPAY")) continue;
        seen.add("USDT_OXAPAY");
        result.push({
          ...option,
          id: "oxapay-usdt",
          network: "OxaPay hosted checkout",
          destination: "",
          displayName: option.displayName || "Tether",
        });
        continue;
      }

      const key = asset + ":" + option.network;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(option);
    }

    return result;
  }, [opts]);

  useEffect(() => {
    if (!sel) {
      setPrice(null);
      setAt(null);
      setQr("");
      setOxapayUrl("");
      setOxapayTrackId("");
      return;
    }

    if (sel.asset === "USDT" && sel.id === "oxapay-usdt") return;

    let live = true;
    const id = IDS[sel.asset];

    if (!id) {
      setError("Price source is not configured for " + sel.asset + ".");
      return () => {
        live = false;
      };
    }

    fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=" + id + "&vs_currencies=usd",
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((d) => {
        const p = Number(d?.[id]?.usd);
        if (!p) throw Error("No valid USD quote");
        if (live) {
          setPrice(p);
          setAt(Date.now());
        }
      })
      .catch((e) => live && setError(e.message || "Unable to load crypto rate."))
      .finally(() => live && setLoading(false));

    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(sel.destination, { width: 280, margin: 2 }),
      )
      .then((u) => live && setQr(u))
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [sel]);

  const amount = useMemo(() => {
    const n = custom ? Number(custom) : usd;
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [custom, usd]);

  const crypto = price && amount > 0 ? amount / price : null;
  const fresh = !!at && Date.now() - at < 60000;
  const isOxaPay = sel?.asset === "USDT" && sel.id === "oxapay-usdt";

  function selectAsset(option: O) {
    setSel(option);
    setError("");
    setDone(false);
    setHash("");
    setOxapayUrl("");
    setOxapayTrackId("");
  }

  function back() {
    setSel(null);
    setDone(false);
    setHash("");
    setError("");
    setOxapayUrl("");
    setOxapayTrackId("");
  }

  async function createOxaPayInvoice() {
    if (!amount || amount < 0.01) {
      setError("Minimum deposit is $0.01.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: invokeError } = await supabase.functions.invoke(
        "oxapay-create-invoice",
        { body: { usd_amount: amount } },
      );

      if (invokeError) {
        throw Error(invokeError.message || "Unable to create OxaPay invoice.");
      }

      const paymentUrl = String(
        data?.provider_payment_url ?? data?.payment_url ?? "",
      );
      const trackId = String(
        data?.provider_track_id ?? data?.track_id ?? "",
      );

      if (!paymentUrl || !trackId) {
        throw Error("OxaPay returned an incomplete payment session.");
      }

      setOxapayUrl(paymentUrl);
      setOxapayTrackId(trackId);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to create OxaPay invoice.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitManual() {
    if (!sel || !crypto || !price || !at || !fresh || !hash.trim()) {
      setError("Lengkapi nominal, kurs terbaru, dan transaction hash.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const r = await fetch("/api/deposit/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          asset: sel.asset,
          network: sel.network,
          amount: crypto,
          usdAmount: amount,
          quoteId: IDS[sel.asset],
          quotePrice: price,
          quoteTimestamp: at,
          txHash: hash.trim(),
        }),
      });

      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Deposit submission failed");
      setDone(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Deposit submission failed",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="deposit-flow">
        <div className="wallet-loading">
          <Loader2 className="spin" size={18} />
          Loading deposit options…
        </div>
      </div>
    );
  }

  if (error && !uniqueOptions.length) {
    return (
      <div className="deposit-flow">
        <div className="wallet-message error">{error}</div>
      </div>
    );
  }

  if (!sel) {
    return (
      <div className="deposit-flow">
        <div className="wallet-section-head">
          <div>
            <div className="eyebrow">ADD REAL CRYPTO</div>
            <h2>Select deposit asset</h2>
            <p className="muted">
              Choose an asset below. USDT uses the OxaPay hosted checkout;
              other assets keep the existing verified manual flow.
            </p>
          </div>
          <div className="wallet-secure-chip">
            <ShieldCheck size={15} />
            Server verified
          </div>
        </div>

        <div className="deposit-method-grid">
          {uniqueOptions.map((o) => {
            const oxa = o.asset === "USDT" && o.id === "oxapay-usdt";
            return (
              <button
                className="deposit-asset-card"
                key={o.id}
                onClick={() => selectAsset(o)}
                type="button"
              >
                <span
                  className={
                    "deposit-asset-icon " + (oxa ? "is-oxa" : "")
                  }
                >
                  {oxa ? "O" : o.asset.slice(0, 3)}
                </span>
                <span className="deposit-asset-copy">
                  <b>{o.asset}</b>
                  <small>{oxa ? "OxaPay hosted checkout" : o.network}</small>
                </span>
                <span className="deposit-asset-arrow">›</span>
              </button>
            );
          })}
        </div>

        {!uniqueOptions.length && (
          <div className="wallet-empty">
            <Sparkles size={20} />
            <b>No deposit destination is active yet.</b>
            <span>
              Enable a verified asset destination in Supabase before accepting
              deposits.
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="deposit-flow">
      <button className="deposit-back" onClick={back} type="button">
        <ArrowLeft size={17} /> Back to assets
      </button>

      <div className="deposit-payment-card">
        <div className="deposit-payment-head">
          <div>
            <div className="eyebrow">
              {isOxaPay ? "OXAPAY CHECKOUT" : "MANUAL DEPOSIT"}
            </div>
            <h2>{sel.displayName || sel.asset}</h2>
            <span className="muted">
              {isOxaPay
                ? "USDT • Hosted payment page"
                : sel.asset + " • " + sel.network}
            </span>
          </div>
          <span className="deposit-step">
            {isOxaPay ? "PROVIDER" : "LIVE RATE"}
          </span>
        </div>

        <div className="deposit-payment-grid">
          <div className="deposit-payment-left">
            <div className="deposit-label">SELECT DEPOSIT NOMINAL</div>
            <div className="deposit-amounts">
              {nominal.map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setUsd(v);
                    setCustom("");
                    setError("");
                  }}
                  className={!custom && usd === v ? "active" : ""}
                  type="button"
                >
                  ${v.toFixed(2)}
                </button>
              ))}
            </div>

            <div className="deposit-field">
              <label>CUSTOM AMOUNT (USD)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  setError("");
                }}
                inputMode="decimal"
              />
            </div>

            <div className="deposit-summary">
              <div>
                <span>Deposit amount</span>
                <b>${amount.toFixed(2)}</b>
              </div>
              <div>
                <span>Crypto amount</span>
                <b>
                  {isOxaPay
                    ? "Calculated securely by server"
                    : formatCrypto(crypto, sel.asset) + " " + sel.asset}
                </b>
              </div>
              <div>
                <span>Diamond credit</span>
                <b>💎 {(amount * 10000).toLocaleString()}</b>
              </div>
            </div>

            <div className="deposit-trust-row">
              <span>
                <ShieldCheck size={14} /> Server-side validation
              </span>
              <span>
                <CircleCheck size={14} /> Idempotent settlement
              </span>
            </div>
          </div>

          <div className="deposit-payment-right">
            {isOxaPay ? (
              <div className="oxa-checkout-panel">
                <div className="oxa-logo-mark">O</div>
                <div className="eyebrow">PAYMENT PROVIDER</div>
                <h3>OxaPay hosted payment</h3>
                <p className="muted">
                  Complete the USDT payment on OxaPay. NextGenMiner credits the
                  balance only after the server verifies the provider callback.
                </p>

                {!oxapayUrl ? (
                  <button
                    className="btn btn-primary wallet-full-btn"
                    disabled={busy || amount < 0.01}
                    onClick={createOxaPayInvoice}
                    type="button"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="spin" size={16} /> Creating
                        payment…
                      </>
                    ) : (
                      "Create OxaPay Payment"
                    )}
                  </button>
                ) : (
                  <div className="oxa-ready">
                    <div className="oxa-ready-row">
                      <span className="status-dot live" />
                      <div>
                        <b>Payment session ready</b>
                        <small>Track ID: {oxapayTrackId}</small>
                      </div>
                    </div>
                    <a
                      className="btn btn-primary wallet-full-btn"
                      href={oxapayUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open OxaPay Checkout <ExternalLink size={16} />
                    </a>
                    <div className="wallet-message info">
                      Do not create a second invoice for the same deposit. After
                      payment, return to NextGenMiner and refresh your wallet.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="deposit-qr">
                  {qr ? (
                    <img src={qr} alt={sel.asset + " deposit QR"} />
                  ) : (
                    <span>Generating QR…</span>
                  )}
                </div>

                <div className="deposit-address-title">DEPOSIT ADDRESS</div>
                <div className="deposit-address">
                  <code>{sel.destination}</code>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(sel.destination);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    type="button"
                    aria-label="Copy deposit address"
                  >
                    {copied ? <Check size={17} /> : <Copy size={17} />}
                  </button>
                </div>

                <div className="deposit-warning">
                  <ShieldAlert size={16} />
                  <span>
                    {sel.warningMessage ||
                      "Send only " +
                        sel.asset +
                        " on " +
                        sel.network +
                        "."}
                  </span>
                </div>

                {sel.firstDepositNote && (
                  <div className="deposit-note">{sel.firstDepositNote}</div>
                )}

                <div className="deposit-field">
                  <label>TRANSACTION HASH</label>
                  <input
                    value={hash}
                    onChange={(e) => setHash(e.target.value)}
                    placeholder="Paste transaction hash"
                    autoComplete="off"
                  />
                </div>

                {error && <div className="wallet-message error">{error}</div>}

                {done ? (
                  <div className="wallet-message success">
                    Deposit submitted. The balance remains pending until
                    verification.
                  </div>
                ) : (
                  <button
                    className="btn btn-primary wallet-full-btn"
                    disabled={busy || !fresh || !crypto}
                    onClick={submitManual}
                    type="button"
                  >
                    {busy ? "Submitting…" : "Submit Deposit"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="deposit-footer-note">
          <span>
            <ShieldCheck size={14} /> Never share private keys or API credentials.
          </span>
          <span>
            Minimum deposit: ${Math.max(0.01, Number(sel.minDeposit || 0.01)).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
