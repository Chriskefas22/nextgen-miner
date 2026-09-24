"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, WalletCards } from "lucide-react";
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
        e instanceof Error
          ? e.message
          : "Gagal membuat pembayaran OxaPay.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="deposit-simple">
      <style jsx>{`
        .deposit-simple{display:grid;gap:12px;max-width:720px;margin:0 auto}
        .deposit-simple-hero{display:flex;align-items:center;gap:12px;padding:4px 2px 10px}
        .deposit-simple-icon{width:48px;height:48px;flex:0 0 48px;display:grid;place-items:center;border-radius:15px;background:linear-gradient(135deg,#1f63ff,#7c35ff);color:#fff;box-shadow:0 0 28px rgba(91,70,255,.22)}
        .deposit-simple-hero h2{font:900 18px/1.15 Orbitron,sans-serif;margin:3px 0 6px}
        .deposit-simple-hero p{margin:0;color:#7896a9;font-size:10px;line-height:1.5}
        .deposit-simple-card{padding:16px;border:1px solid rgba(70,132,190,.22);border-radius:18px;background:linear-gradient(145deg,rgba(7,18,32,.98),rgba(3,10,18,.98));box-shadow:0 16px 36px rgba(0,0,0,.18)}
        .deposit-simple-label{color:#7795aa;font-size:9px;font-weight:900;letter-spacing:.13em;margin-bottom:9px}
        .deposit-quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .deposit-quick-grid button{min-height:44px;border:1px solid rgba(54,121,169,.24);border-radius:11px;background:#06121f;color:#a4bac7;font-weight:900;font-size:11px;cursor:pointer;transition:.16s ease}
        .deposit-quick-grid button:hover{transform:translateY(-1px);border-color:rgba(66,213,255,.34);color:#fff}
        .deposit-quick-grid button.active{color:#fff;border-color:rgba(143,110,255,.56);background:linear-gradient(135deg,#245fff,#8738ff);box-shadow:0 7px 24px rgba(73,69,255,.18)}
        .deposit-custom-wrap{margin-top:12px}
        .deposit-custom-wrap label{display:block;color:#7895a8;font-size:9px;font-weight:900;margin-bottom:6px}
        .deposit-custom-input{display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid rgba(54,120,164,.26);border-radius:11px;background:#030a14}
        .deposit-custom-input:focus-within{border-color:rgba(62,215,255,.45);box-shadow:0 0 0 3px rgba(62,215,255,.06)}
        .deposit-custom-input span{color:#88a6b7;font-weight:900}
        .deposit-custom-input input{width:100%;min-width:0;padding:12px 0;border:0;outline:0;background:transparent;color:#f0fbff;font-size:13px}
        .deposit-simple-summary{display:grid;gap:7px;margin-top:13px}
        .deposit-simple-summary>div{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 11px;border-radius:11px;background:rgba(8,20,34,.74);border:1px solid rgba(53,112,151,.16)}
        .deposit-simple-summary span{color:#718ea2;font-size:9px}
        .deposit-simple-summary strong{color:#eefaff;font-size:10px}
        .deposit-continue-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:13px;min-height:48px;border:0;border-radius:13px;background:linear-gradient(135deg,#2764ff,#8738ff);color:#fff;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 11px 30px rgba(70,71,255,.2)}
        .deposit-continue-btn:hover:not(:disabled){transform:translateY(-1px)}
        .deposit-continue-btn:disabled{opacity:.58;cursor:not-allowed}
        .deposit-simple-trust{display:flex;flex-wrap:wrap;justify-content:center;gap:9px;margin-top:10px}
        .deposit-simple-trust span{display:inline-flex;align-items:center;gap:4px;color:#70a895;font-size:8px;font-weight:800}
        .deposit-returned{display:flex;align-items:flex-start;gap:9px;padding:11px 12px;border-radius:12px;border:1px solid rgba(53,243,180,.18);background:rgba(53,243,180,.05);color:#8fe6c7}
        .deposit-returned svg{margin-top:1px}
        .deposit-returned b,.deposit-returned span{display:block}
        .deposit-returned b{font-size:10px;color:#b7f4de}
        .deposit-returned span{margin-top:3px;color:#719c91;font-size:8px;line-height:1.45}
        .deposit-simple-help{padding:12px 13px;border-radius:13px;border:1px solid rgba(53,124,171,.16);background:rgba(6,16,28,.55)}
        .deposit-simple-help b{font-size:10px;color:#dff4fa}
        .deposit-simple-help p{margin:5px 0 0;color:#708e9f;font-size:9px;line-height:1.55}
        @media(max-width:430px){
          .deposit-simple-hero{align-items:flex-start}
          .deposit-simple-hero h2{font-size:16px}
          .deposit-quick-grid{grid-template-columns:repeat(2,1fr)}
          .deposit-simple-card{padding:13px}
        }
      `}</style>

      <div className="deposit-simple-hero">
        <div className="deposit-simple-icon">
          <WalletCards size={24} />
        </div>
        <div>
          <div className="eyebrow">SETORAN CRYPTO</div>
          <h2>Tambah saldo dengan mudah</h2>
          <p>Masukkan nominal. Kami akan membuka halaman pembayaran OxaPay untuk pilihan crypto dan network.</p>
        </div>
      </div>

      {returned && (
        <div className="deposit-returned">
          <CheckCircle2 size={18} />
          <div>
            <b>Kembali dari OxaPay</b>
            <span>Pembayaran sedang diverifikasi server. Refresh Wallet untuk melihat saldo terbaru.</span>
          </div>
        </div>
      )}

      <div className="deposit-simple-card">
        <div className="deposit-simple-label">JUMLAH SETORAN (USD)</div>

        <div className="deposit-quick-grid">
          {presets.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => choosePreset(value)}
              className={!custom && amount === value ? "active" : ""}
            >
              {"$" + value}
            </button>
          ))}
        </div>

        <div className="deposit-custom-wrap">
          <label htmlFor="deposit-custom">Nominal lain</label>
          <div className="deposit-custom-input">
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
        </div>

        <div className="deposit-simple-summary">
          <div>
            <span>Setoran</span>
            <strong>{"$" + (validAmount ? depositAmount.toFixed(2) : "0.00")}</strong>
          </div>
          <div>
            <span>Pembayaran</span>
            <strong>OxaPay</strong>
          </div>
          <div>
            <span>Crypto</span>
            <strong>Dipilih di OxaPay</strong>
          </div>
        </div>

        {error && <div className="wallet-message error">{error}</div>}

        <button
          className="deposit-continue-btn"
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

        <div className="deposit-simple-trust">
          <span><ShieldCheck size={14} /> OxaPay hosted checkout</span>
          <span><ShieldCheck size={14} /> Verifikasi server-side</span>
          <span><ShieldCheck size={14} /> Tanpa transaction hash</span>
        </div>
      </div>

      <div className="deposit-simple-help">
        <b>Bagaimana prosesnya?</b>
        <p>
          Setelah menekan tombol di atas, Anda langsung masuk ke halaman OxaPay.
          Di sana Anda dapat memilih BTC, ETH, USDT, BNB, SOL, dan opsi pembayaran
          lain yang tersedia untuk invoice. NextGenMiner hanya menambahkan saldo
          setelah callback pembayaran diverifikasi.
        </p>
      </div>
    </div>
  );
}
