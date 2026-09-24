"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DepositActivity = {
  id: number;
  tx_type: string;
  crypto_amount: number;
  asset: string | null;
  network: string | null;
  note: string | null;
  created_at: string;
};

const PRESETS = [5, 10, 20, 50, 100, 500];
const DIAMONDS_PER_USD = 10_000;

function fmtNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DepositFlow() {
  const [mode, setMode] = useState<"new" | "history">("new");
  const [amount, setAmount] = useState(20);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [returned, setReturned] = useState(false);
  const [history, setHistory] = useState<DepositActivity[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);

  const depositAmount = Number(custom || amount);
  const validAmount = Number.isFinite(depositAmount) && depositAmount >= 0.01;
  const diamondPreview = validAmount ? depositAmount * DIAMONDS_PER_USD : 0;

  const loadHistory = useCallback(async () => {
    setHistoryBusy(true);
    try {
      const sb = createClient();
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) return;

      const { data } = await sb
        .from("nextgen_transactions")
        .select("id,tx_type,crypto_amount,asset,network,note,created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setHistory(
        (data ?? [])
          .filter((row: any) => {
            const type = String(row.tx_type ?? "").toLowerCase();
            const note = String(row.note ?? "").toLowerCase();
            return (
              type.includes("deposit") ||
              type.includes("topup") ||
              note.includes("oxapay") ||
              note.includes("deposit")
            );
          })
          .slice(0, 8)
          .map((row: any) => ({
            id: Number(row.id),
            tx_type: String(row.tx_type ?? "Deposit"),
            crypto_amount: Number(row.crypto_amount ?? 0),
            asset: row.asset ? String(row.asset) : null,
            network: row.network ? String(row.network) : null,
            note: row.note ? String(row.note) : null,
            created_at: String(row.created_at),
          })),
      );
    } finally {
      setHistoryBusy(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("deposit") === "success") {
      setReturned(true);
      void loadHistory();
    }
  }, [loadHistory]);

  useEffect(() => {
    if (mode === "history") void loadHistory();
  }, [loadHistory, mode]);

  function choosePreset(value: number) {
    setAmount(value);
    setCustom("");
    setError("");
  }

  async function continueToOxaPay() {
    if (!validAmount) {
      setError("Minimum setoran adalah $0.01.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: invokeError } = await supabase.functions.invoke(
        "oxapay-create-invoice",
        { body: { usd_amount: Number(depositAmount.toFixed(2)) } },
      );

      if (invokeError) {
        throw Error(invokeError.message || "Gagal membuat pembayaran OxaPay.");
      }

      const paymentUrl = String(
        data?.provider_payment_url ?? data?.payment_url ?? "",
      );

      if (!paymentUrl) {
        throw Error("OxaPay tidak mengembalikan halaman pembayaran.");
      }

      window.location.assign(paymentUrl);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gagal membuat pembayaran OxaPay.",
      );
      setBusy(false);
    }
  }

  const statusCopy = useMemo(
    () =>
      returned
        ? "Pembayaran sudah kembali dari OxaPay dan sedang diverifikasi server."
        : "Bayar lewat OxaPay. Pilihan crypto dan network ditangani di halaman pembayaran.",
    [returned],
  );

  return (
    <div className="deposit-mobile-flow">
      <div className="deposit-mobile-header">
        <div className="deposit-mobile-title-row">
          <div className="deposit-mobile-title-icon">
            <WalletCards size={20} />
          </div>
          <div>
            <div className="eyebrow">WALLET / SETORAN</div>
            <h2>Tambah saldo</h2>
            <p>{statusCopy}</p>
          </div>
        </div>

        {returned ? (
          <div className="deposit-return-banner">
            <CheckCircle2 size={18} />
            <div>
              <b>Kembali dari OxaPay</b>
              <span>Saldo akan muncul setelah callback pembayaran lolos verifikasi.</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="deposit-mobile-tabs" role="tablist" aria-label="Deposit views">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "new"}
          className={mode === "new" ? "active" : ""}
          onClick={() => setMode("new")}
        >
          Setoran baru
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "history"}
          className={mode === "history" ? "active" : ""}
          onClick={() => setMode("history")}
        >
          Riwayat
        </button>
      </div>

      {mode === "new" ? (
        <>
          <div className="deposit-mobile-metrics">
            <div>
              <span>MINIMUM</span>
              <b>$0.01</b>
            </div>
            <div>
              <span>DIAMOND RATE</span>
              <b>10,000 💎 / $1</b>
            </div>
          </div>

          <section className="deposit-mobile-card amount-card">
            <div className="deposit-mobile-card-head">
              <div>
                <span>JUMLAH SETORAN (USD)</span>
                <b>Berapa yang ingin Anda masukkan?</b>
              </div>
              <span className="deposit-status-pill">OxaPay</span>
            </div>

            <div className="deposit-preset-grid">
              {PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => choosePreset(value)}
                  className={!custom && amount === value ? "active" : ""}
                >
                  ${value}
                </button>
              ))}
            </div>

            <label className="deposit-custom-label" htmlFor="deposit-custom">
              Nominal lain
            </label>
            <div className="deposit-custom-box">
              <span>$</span>
              <input
                id="deposit-custom"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="Contoh: 25"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  setError("");
                }}
              />
            </div>
          </section>

          <section className="deposit-mobile-card deposit-preview-card">
            <div className="deposit-preview-row">
              <span>Setoran</span>
              <strong>{validAmount ? `$${depositAmount.toFixed(2)}` : "$0.00"}</strong>
            </div>
            <div className="deposit-preview-row">
              <span>Metode pembayaran</span>
              <strong>OxaPay</strong>
            </div>
            <div className="deposit-preview-row">
              <span>Crypto</span>
              <strong>Pilih di OxaPay</strong>
            </div>
            <div className="deposit-preview-row accent">
              <span>Potensi credit 💎</span>
              <strong>{fmtNumber(diamondPreview)} 💎</strong>
            </div>
          </section>

          <section className="deposit-mobile-card deposit-info-card">
            <div className="deposit-info-icon">i</div>
            <div>
              <b>Anda tidak perlu memasukkan hash transaksi.</b>
              <p>Setelah menekan tombol pembayaran, OxaPay menangani pilihan coin, network, alamat, QR, dan status pembayaran.</p>
            </div>
          </section>

          <section className="deposit-mobile-card deposit-coins-card">
            <div className="deposit-mobile-card-head compact">
              <div>
                <span>PILIH CRYPTO</span>
                <b>Dilakukan di OxaPay</b>
              </div>
            </div>
            <div className="deposit-coin-strip" aria-label="Example supported cryptocurrencies">
              <span><i>₿</i>BTC</span>
              <span><i>Ξ</i>ETH</span>
              <span><i>₮</i>USDT</span>
              <span><i>BNB</i>BNB</span>
              <span><i>SOL</i>SOL</span>
            </div>
          </section>

          {error ? <div className="wallet-message error">{error}</div> : null}

          <div className="deposit-mobile-desktop-action">
            <button
              className="deposit-mobile-continue"
              type="button"
              disabled={busy || !validAmount}
              onClick={() => void continueToOxaPay()}
            >
              {busy ? (
                <>
                  <Loader2 className="spin" size={18} />
                  Menyiapkan pembayaran…
                </>
              ) : (
                <>
                  Lanjut ke pembayaran
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>

          <div className="deposit-security-row">
            <span><ShieldCheck size={14} /> Hosted checkout</span>
            <span><ShieldCheck size={14} /> HMAC + provider verification</span>
            <span><ShieldCheck size={14} /> Idempotent settlement</span>
          </div>
        </>
      ) : (
        <section className="deposit-mobile-card history-card">
          <div className="deposit-history-head">
            <div>
              <span>RIWAYAT SETORAN</span>
              <b>Pembayaran terakhir</b>
            </div>
            <button type="button" onClick={() => void loadHistory()} disabled={historyBusy}>
              <RefreshCw size={15} className={historyBusy ? "spin" : ""} />
            </button>
          </div>

          {historyBusy && !history.length ? (
            <div className="deposit-history-empty"><Loader2 className="spin" size={18} /> Memuat riwayat…</div>
          ) : history.length ? (
            <div className="deposit-history-list">
              {history.map((row) => (
                <div className="deposit-history-item" key={row.id}>
                  <div className="deposit-history-icon"><CheckCircle2 size={17} /></div>
                  <div className="deposit-history-main">
                    <b>{row.tx_type.replaceAll("_", " ")}</b>
                    <small>
                      {row.asset ?? "Crypto"}{row.network ? ` • ${row.network}` : ""}
                      {row.note ? ` • ${row.note}` : ""}
                    </small>
                  </div>
                  <div className="deposit-history-right">
                    <b>{row.crypto_amount > 0 ? `+${row.crypto_amount}` : "Pending"}</b>
                    <small><Clock3 size={11} /> {formatDate(row.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="deposit-history-empty">
              <WalletCards size={20} />
              <b>Belum ada riwayat setoran</b>
              <span>Setoran OxaPay yang sudah tercatat akan muncul di sini.</span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
