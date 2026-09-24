 "use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const presets = [1, 5, 10, 20, 50, 100];

export function DepositFlow() {
  const [amount, setAmount] = useState(20);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [returned, setReturned] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturned(params.get("deposit") === "success");
  }, []);

  const depositAmount = Number(custom || amount);
  const validAmount = Number.isFinite(depositAmount) && depositAmount >= 0.01;

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
        const details = typeof invokeError.context === "object" ? invokeError.context : null;
        throw new Error(
          details && "error" in details && typeof (details as any).error === "string"
            ? String((details as any).error)
            : invokeError.message || "Gagal membuat pembayaran.",
        );
      }

      const paymentUrl = String(data?.provider_payment_url ?? data?.payment_url ?? "");
      if (!paymentUrl) throw new Error("OxaPay tidak mengembalikan halaman pembayaran.");

      window.location.assign(paymentUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat pembayaran.");
      setBusy(false);
    }
  }

  return (
    <div className="deposit-simple">
      <div className="deposit-simple-hero">
        <div className="deposit-simple-icon"><WalletCards size={23} /></div>
        <div>
          <div className="eyebrow">SETORAN</div>
          <h2>Tambah saldo</h2>
          <p>Pilih nominal lalu lanjut ke pembayaran.</p>
        </div>
      </div>

      {returned && (
        <div className="deposit-returned">
          <CheckCircle2 size={18} />
          <div><b>Kembali dari OxaPay</b><span>Pembayaran sedang diproses. Periksa saldo beberapa saat lagi.</span></div>
        </div>
      )}

      <div className="deposit-simple-card">
        <div className="deposit-simple-label">JUMLAH SETORAN (USD)</div>
        <div className="deposit-quick-grid">
          {presets.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => { setAmount(value); setCustom(""); setError(""); }}
              className={!custom && amount === value ? "active" : ""}
            >
              ${value}
            </button>
          ))}
        </div>

        <label className="deposit-custom-wrap">
          <span>Nominal lain</span>
          <div className="deposit-custom-input">
            <b>$</b>
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="Contoh: 25"
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setError(""); }}
            />
          </div>
        </label>

        <div className="deposit-simple-summary">
          <div><span>Setoran</span><strong>${validAmount ? depositAmount.toFixed(2) : "0.00"}</strong></div>
          <div><span>Pembayaran</span><strong>OxaPay</strong></div>
          <div><span>Crypto</span><strong>Pilih di OxaPay</strong></div>
        </div>

        {error && <div className="wallet-simple-message error">{error}</div>}

        <button
          className="deposit-continue-btn"
          type="button"
          disabled={busy || !validAmount}
          onClick={() => void continueToOxaPay()}
        >
          {busy ? <><Loader2 className="spin" size={18} /> Menyiapkan…</> : <>Lanjut ke pembayaran <ArrowRight size={18} /></>}
        </button>
      </div>
    </div>
  );
}
