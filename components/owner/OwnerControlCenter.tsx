'use client';

import { useCallback, useEffect, useState } from 'react';

type MessageState = {
  type: 'success' | 'error' | '';
  text: string;
};

type PendingDeposit = {
  id: number;
  user_id: string;
  asset: string;
  network: string;
  amount: number | string;
  usd_amount: number | string;
  diamond_amount: number | string;
  status: string;
  created_at: string;
  tx_hash?: string | null;
  reference_code?: string | null;
};

function formatNumber(
  value: number | string | null | undefined
) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return String(value ?? '-');
  }

  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: 8,
  });
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function OwnerControlCenter() {
  const [targetUserId, setTargetUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const [busy, setBusy] = useState(false);

  const [message, setMessage] =
    useState<MessageState>({
      type: '',
      text: '',
    });

  const [deposits, setDeposits] =
    useState<PendingDeposit[]>([]);

  const [depositsLoading, setDepositsLoading] =
    useState(false);

  const [depositsError, setDepositsError] =
    useState('');

  async function adjustDiamond(
    direction: 'add' | 'remove'
  ) {
    setMessage({
      type: '',
      text: '',
    });

    const userId = targetUserId.trim();
    const reason = note.trim();
    const numericAmount = Number(amount);

    if (!userId) {
      setMessage({
        type: 'error',
        text: 'Target User ID wajib diisi.',
      });

      return;
    }

    if (
      !numericAmount ||
      numericAmount <= 0
    ) {
      setMessage({
        type: 'error',
        text: 'Jumlah 💎 harus lebih besar dari 0.',
      });

      return;
    }

    if (!Number.isFinite(numericAmount)) {
      setMessage({
        type: 'error',
        text: 'Jumlah 💎 tidak valid.',
      });

      return;
    }

    if (!reason) {
      setMessage({
        type: 'error',
        text: 'Alasan perubahan wajib diisi.',
      });

      return;
    }

    if (reason.length < 3) {
      setMessage({
        type: 'error',
        text: 'Alasan minimal 3 karakter.',
      });

      return;
    }

    if (reason.length > 500) {
      setMessage({
        type: 'error',
        text: 'Alasan maksimal 500 karakter.',
      });

      return;
    }

    const delta =
      direction === 'add'
        ? numericAmount
        : -numericAmount;

    setBusy(true);

    try {
      const response = await fetch(
        '/api/owner/diamond',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetUserId: userId,
            delta,
            note: reason,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Perubahan Diamond gagal diproses.'
        );
      }

      setMessage({
        type: 'success',
        text:
          direction === 'add'
            ? `Berhasil menambahkan ${numericAmount.toLocaleString()} 💎.`
            : `Berhasil mengurangi ${numericAmount.toLocaleString()} 💎.`,
      });

      setAmount('');
      setNote('');
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Terjadi kesalahan.',
      });
    } finally {
      setBusy(false);
    }
  }

  const loadPendingDeposits =
    useCallback(async () => {
      setDepositsLoading(true);
      setDepositsError('');

      try {
        const response = await fetch(
          '/api/owner/deposits/pending?limit=100',
          {
            cache: 'no-store',
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'Gagal mengambil deposit PENDING.'
          );
        }

        setDeposits(
          Array.isArray(data?.deposits)
            ? data.deposits
            : []
        );
      } catch (error) {
        setDeposits([]);

        setDepositsError(
          error instanceof Error
            ? error.message
            : 'Gagal mengambil deposit PENDING.'
        );
      } finally {
        setDepositsLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadPendingDeposits();
  }, [loadPendingDeposits]);

  return (
    <main className="owner-control-page">
      <div className="owner-control-container">

        {/* =====================================================
            HEADER
        ====================================================== */}

        <header className="owner-header">
          <div>
            <span className="owner-badge">
              OWNER ONLY
            </span>

            <h1>
              Owner Control Center
            </h1>

            <p>
              Central control untuk operasional
              NextGen Miner.
            </p>
          </div>

          <div className="owner-identity">
            <span>
              Owner Account
            </span>

            <strong>
              angellhinoc@gmail.com
            </strong>
          </div>
        </header>

        {/* =====================================================
            DIAMOND CONTROL
        ====================================================== */}

        <section className="owner-card diamond-card">
          <div className="card-heading">
            <span className="section-label">
              FINANCE CONTROL
            </span>

            <h2>
              💎 Diamond Control
            </h2>

            <p>
              Tambahkan atau kurangi Diamond
              pengguna melalui protected Owner RPC.
            </p>
          </div>

          <div className="form-grid">

            <div className="field">
              <label htmlFor="targetUserId">
                Target User ID
              </label>

              <input
                id="targetUserId"
                type="text"
                value={targetUserId}
                onChange={(event) =>
                  setTargetUserId(
                    event.target.value
                  )
                }
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                autoComplete="off"
                disabled={busy}
              />
            </div>

            <div className="field">
              <label htmlFor="diamondAmount">
                Jumlah 💎
              </label>

              <input
                id="diamondAmount"
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                placeholder="Contoh: 10000"
                inputMode="decimal"
                disabled={busy}
              />
            </div>

          </div>

          <div className="field">
            <label htmlFor="diamondNote">
              Alasan / Catatan
            </label>

            <textarea
              id="diamondNote"
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
              placeholder="Contoh: Bonus manual Owner"
              maxLength={500}
              disabled={busy}
            />

            <div className="character-count">
              {note.length}/500
            </div>
          </div>

          <div className="action-row">

            <button
              type="button"
              className="action-button add-button"
              disabled={busy}
              onClick={() =>
                adjustDiamond('add')
              }
            >
              {busy
                ? 'Memproses...'
                : '➕ Tambah 💎'}
            </button>

            <button
              type="button"
              className="action-button remove-button"
              disabled={busy}
              onClick={() =>
                adjustDiamond('remove')
              }
            >
              {busy
                ? 'Memproses...'
                : '➖ Kurangi 💎'}
            </button>

          </div>

          {message.text && (
            <div
              className={`owner-message ${message.type}`}
              role="status"
            >
              {message.text}
            </div>
          )}

          <div className="security-note">
            <strong>
              Protected operation
            </strong>

            <span>
              Browser tidak mengubah saldo
              secara langsung. Semua perubahan
              melewati Owner RPC dan dicatat ke
              transaction ledger serta Owner audit.
            </span>
          </div>
        </section>

        {/* =====================================================
            DEPOSIT REVIEW
        ====================================================== */}

        <section className="owner-card">

          <div className="card-heading finance-heading">

            <div>
              <span className="section-label">
                FINANCE
              </span>

              <h2>
                📥 Deposit Review
              </h2>

              <p>
                Read-only tahap verifikasi:
                menampilkan deposit PENDING dari
                Owner-protected endpoint.
              </p>
            </div>

            <button
              type="button"
              className="refresh-button"
              onClick={() =>
                void loadPendingDeposits()
              }
              disabled={depositsLoading}
            >
              {depositsLoading
                ? 'Memuat...'
                : '↻ Refresh'}
            </button>

          </div>

          <div className="review-safety">

            <strong>
              🔒 APPROVE / REJECT belum aktif
            </strong>

            <span>
              Tahap ini hanya membaca data
              PENDING. Tidak ada perubahan wallet
              atau saldo yang dilakukan.
            </span>

          </div>

          {depositsLoading &&
            deposits.length === 0 && (
              <div className="empty-state">
                Memuat deposit PENDING...
              </div>
            )}

          {depositsError && (
            <div className="owner-message error">
              {depositsError}
            </div>
          )}

          {!depositsLoading &&
            !depositsError &&
            deposits.length === 0 && (
              <div className="empty-state">
                Tidak ada deposit PENDING saat ini.
              </div>
            )}

          {deposits.length > 0 && (
            <div className="deposit-list">

              <div className="deposit-summary">
                <strong>
                  {deposits.length}
                </strong>

                <span>
                  deposit PENDING ditampilkan
                  (maks. 100 pada tampilan ini).
                </span>
              </div>

              {deposits.map((deposit) => (
                <article
                  className="deposit-item"
                  key={deposit.id}
                >

                  <div className="deposit-topline">

                    <strong>
                      Deposit #{deposit.id}
                    </strong>

                    <span className="pending-badge">
                      {String(
                        deposit.status
                      ).toUpperCase()}
                    </span>

                  </div>

                  <div className="deposit-grid">

                    <div>
                      <span>
                        User ID
                      </span>

                      <strong className="mono">
                        {deposit.user_id}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Asset
                      </span>

                      <strong>
                        {deposit.asset}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Network
                      </span>

                      <strong>
                        {deposit.network}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Crypto Amount
                      </span>

                      <strong>
                        {formatNumber(
                          deposit.amount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        USD
                      </span>

                      <strong>
                        $
                        {formatNumber(
                          deposit.usd_amount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        💎 Diamond
                      </span>

                      <strong>
                        {formatNumber(
                          deposit.diamond_amount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Created
                      </span>

                      <strong>
                        {formatDate(
                          deposit.created_at
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Reference
                      </span>

                      <strong className="mono">
                        {deposit.reference_code ||
                          '-'}
                      </strong>
                    </div>

                  </div>

                  <div className="deposit-hash">

                    <span>
                      TX Hash
                    </span>

                    <strong className="mono">
                      {deposit.tx_hash ||
                        'Belum diisi'}
                    </strong>

                  </div>

                </article>
              ))}

            </div>
          )}

        </section>

        {/* =====================================================
            WITHDRAWAL REVIEW
        ====================================================== */}

        <section className="owner-card">

          <div className="card-heading">

            <span className="section-label">
              FINANCE
            </span>

            <h2>
              📤 Withdrawal Review
            </h2>

            <p>
              Owner-only pending withdrawal
              read path sudah disiapkan, tetapi UI
              approval belum diaktifkan.
            </p>

          </div>

          <div className="coming-note">
            🔒 Tahap berikutnya: audit read-path
            withdrawal sebelum APPROVE / REJECT
            diaktifkan.
          </div>

        </section>

        {/* =====================================================
            ANNOUNCEMENT
        ====================================================== */}

        <section className="owner-card">

          <div className="card-heading">

            <span className="section-label">
              COMMUNICATION
            </span>

            <h2>
              📢 Announcement
            </h2>

            <p>
              Komunikasi resmi Owner kepada member.
            </p>

          </div>

          <div className="module-grid">

            <div className="module-item">

              <span className="module-icon">
                👤
              </span>

              <div>
                <strong>
                  Personal Announcement
                </strong>

                <p>
                  Mengirim pengumuman kepada satu
                  pengguna.
                </p>
              </div>

              <span className="module-status">
                OWNER
              </span>

            </div>

            <div className="module-item">

              <span className="module-icon">
                🌐
              </span>

              <div>
                <strong>
                  Global Announcement
                </strong>

                <p>
                  Mengirim pengumuman kepada seluruh
                  member.
                </p>
              </div>

              <span className="module-status">
                OWNER
              </span>

            </div>

          </div>

          <div className="coming-note">
            Announcement UI akan dihubungkan ke
            protected Owner RPC.
          </div>

        </section>

        {/* =====================================================
            OWNER POLICY
        ====================================================== */}

        <section className="owner-card simplified-card">

          <div className="card-heading">

            <span className="section-label">
              OWNER POLICY
            </span>

            <h2>
              Control Scope
            </h2>

            <p>
              Owner Control Center sengaja
              disederhanakan.
            </p>

          </div>

          <div className="policy-list">

            <div className="policy-row">
              <span>💎</span>

              <strong>
                Diamond Add / Remove
              </strong>

              <span className="enabled">
                ENABLED
              </span>
            </div>

            <div className="policy-row">
              <span>📢</span>

              <strong>
                Personal / Global Announcement
              </strong>

              <span className="enabled">
                ENABLED
              </span>
            </div>

            <div className="policy-row disabled-row">
              <span>🚫</span>

              <strong>
                Gift Hashrate
              </strong>

              <span>
                REMOVED
              </span>
            </div>

            <div className="policy-row disabled-row">
              <span>🚫</span>

              <strong>
                Block / Unblock User
              </strong>

              <span>
                REMOVED
              </span>
            </div>

            <div className="policy-row disabled-row">
              <span>🚫</span>

              <strong>
                Gift Miner
              </strong>

              <span>
                REMOVED
              </span>
            </div>

            <div className="policy-row disabled-row">
              <span>🚫</span>

              <strong>
                Admin Role
              </strong>

              <span>
                REMOVED
              </span>
            </div>

          </div>

        </section>

      </div>

      <style jsx>{`

        .owner-control-page {
          min-height: 100vh;
          padding: 32px 20px 60px;
          background:
            radial-gradient(
              circle at top,
              rgba(80, 120, 255, 0.08),
              transparent 42%
            ),
            #070910;
          color: #ffffff;
        }

        .owner-control-container {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
        }

        .owner-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 24px;
        }

        .owner-badge {
          display: inline-flex;
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid
            rgba(255, 255, 255, 0.18);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
        }

        h1 {
          margin: 10px 0 8px;
          font-size: clamp(28px, 5vw, 42px);
          line-height: 1.05;
        }

        .owner-header p,
        .card-heading p {
          margin: 0;
          color: rgba(255, 255, 255, 0.58);
          line-height: 1.6;
        }

        .owner-identity {
          min-width: 220px;
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid
            rgba(255, 255, 255, 0.1);
        }

        .owner-identity span {
          display: block;
          margin-bottom: 5px;
          color: rgba(255, 255, 255, 0.48);
          font-size: 12px;
        }

        .owner-identity strong {
          display: block;
          font-size: 13px;
          word-break: break-word;
        }

        .owner-card {
          margin-top: 20px;
          padding: 24px;
          border: 1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.035);
          box-shadow:
            0 18px 50px
              rgba(0, 0, 0, 0.18);
        }

        .diamond-card {
          border-color:
            rgba(100, 160, 255, 0.22);
        }

        .card-heading {
          margin-bottom: 22px;
        }

        .finance-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .section-label {
          display: block;
          margin-bottom: 7px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          color: rgba(255, 255, 255, 0.42);
        }

        h2 {
          margin: 0 0 7px;
          font-size: 22px;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(0, 1fr);
          gap: 14px;
          margin-bottom: 14px;
        }

        .field {
          position: relative;
          margin-bottom: 14px;
        }

        label {
          display: block;
          margin-bottom: 7px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.72);
        }

        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.22);
          color: #ffffff;
          padding: 12px 13px;
          outline: none;
        }

        textarea {
          min-height: 100px;
          resize: vertical;
        }

        input:focus,
        textarea:focus {
          border-color:
            rgba(120, 170, 255, 0.55);
        }

        input:disabled,
        textarea:disabled {
          opacity: 0.6;
        }

        .character-count {
          margin-top: 5px;
          text-align: right;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
        }

        .action-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .action-button,
        .refresh-button {
          border: 1px solid
            rgba(255, 255, 255, 0.14);
          border-radius: 12px;
          padding: 11px 15px;
          color: #ffffff;
          background: rgba(255, 255, 255, 0.06);
          cursor: pointer;
          font-weight: 700;
        }

        .action-button:disabled,
        .refresh-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .add-button {
          border-color:
            rgba(100, 220, 150, 0.3);
        }

        .remove-button {
          border-color:
            rgba(255, 110, 110, 0.3);
        }

        .refresh-button {
          white-space: nowrap;
        }

        .owner-message {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.5;
        }

        .owner-message.success {
          border: 1px solid
            rgba(100, 220, 150, 0.25);
          background:
            rgba(100, 220, 150, 0.07);
        }

        .owner-message.error {
          border: 1px solid
            rgba(255, 110, 110, 0.25);
          background:
            rgba(255, 110, 110, 0.07);
        }

        .security-note,
        .review-safety {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 16px;
          padding: 13px 14px;
          border-radius: 12px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background:
            rgba(255, 255, 255, 0.025);
        }

        .security-note span,
        .review-safety span {
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
          line-height: 1.55;
        }

        .review-safety {
          margin-top: 0;
          margin-bottom: 16px;
          border-color:
            rgba(255, 190, 90, 0.2);
        }

        .review-safety strong {
          font-size: 13px;
        }

        .deposit-summary {
          display: flex;
          gap: 6px;
          align-items: baseline;
          margin-bottom: 12px;
          color: rgba(255, 255, 255, 0.58);
          font-size: 12px;
        }

        .deposit-summary strong {
          color: #ffffff;
          font-size: 18px;
        }

        .deposit-item {
          margin-top: 12px;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid
            rgba(255, 255, 255, 0.09);
          background: rgba(0, 0, 0, 0.16);
        }

        .deposit-topline {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 14px;
        }

        .pending-badge {
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid
            rgba(255, 190, 90, 0.24);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .deposit-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .deposit-grid div,
        .deposit-hash {
          min-width: 0;
        }

        .deposit-grid span,
        .deposit-hash span {
          display: block;
          margin-bottom: 4px;
          color: rgba(255, 255, 255, 0.38);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .deposit-grid strong,
        .deposit-hash strong {
          display: block;
          font-size: 12px;
          line-height: 1.5;
          word-break: break-word;
        }

        .deposit-hash {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.07);
        }

        .mono {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
        }

        .empty-state,
        .coming-note {
          padding: 14px;
          border-radius: 12px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background:
            rgba(255, 255, 255, 0.025);
          color: rgba(255, 255, 255, 0.52);
          font-size: 13px;
          line-height: 1.5;
        }

        .module-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .module-item {
          display: grid;
          grid-template-columns:
            auto 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 15px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          background:
            rgba(255, 255, 255, 0.025);
        }

        .module-icon {
          font-size: 22px;
        }

        .module-item strong {
          font-size: 13px;
        }

        .module-item p {
          margin: 4px 0 0;
          color: rgba(255, 255, 255, 0.48);
          font-size: 12px;
          line-height: 1.45;
        }

        .module-status {
          font-size: 10px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.42);
        }

        .coming-note {
          margin-top: 14px;
        }

        .policy-list {
          display: grid;
          gap: 8px;
        }

        .policy-row {
          display: grid;
          grid-template-columns:
            auto 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 12px 13px;
          border-radius: 12px;
          background:
            rgba(255, 255, 255, 0.025);
        }

        .policy-row strong {
          font-size: 12px;
        }

        .policy-row span:last-child {
          font-size: 10px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.4);
        }

        .policy-row .enabled {
          color: rgba(120, 220, 160, 0.9);
        }

        .disabled-row {
          opacity: 0.5;
        }

        @media (max-width: 760px) {
          .owner-header,
          .finance-heading {
            flex-direction: column;
          }

          .owner-identity {
            width: 100%;
            box-sizing: border-box;
            min-width: 0;
          }

          .form-grid,
          .module-grid,
          .deposit-grid {
            grid-template-columns: 1fr;
          }

          .owner-card {
            padding: 18px;
          }
        }

      `}</style>
    </main>
  );
}
