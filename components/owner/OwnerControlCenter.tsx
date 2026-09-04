'use client';

import { useState } from 'react';

type MessageState = {
  type: 'success' | 'error' | '';
  text: string;
};

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

    if (!numericAmount || numericAmount <= 0) {
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

  return (
    <main className="owner-control-page">
      <div className="owner-control-container">
        {/* HEADER */}

        <header className="owner-header">
          <div>
            <span className="owner-badge">
              OWNER ONLY
            </span>

            <h1>Owner Control Center</h1>

            <p>
              Central control untuk operasional
              NextGen Miner.
            </p>
          </div>

          <div className="owner-identity">
            <span>Owner Account</span>
            <strong>
              angellhinoc@gmail.com
            </strong>
          </div>
        </header>

        {/* DIAMOND CONTROL */}

        <section className="owner-card diamond-card">
          <div className="card-heading">
            <div>
              <span className="section-label">
                FINANCE CONTROL
              </span>

              <h2>💎 Diamond Control</h2>

              <p>
                Tambahkan atau kurangi Diamond
                pengguna melalui protected Owner
                RPC.
              </p>
            </div>
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
            <strong>Protected operation</strong>

            <span>
              Browser tidak mengubah saldo secara
              langsung. Semua perubahan melewati
              Owner RPC dan dicatat ke transaction
              ledger serta Owner audit.
            </span>
          </div>
        </section>

        {/* FINANCE */}

        <section className="owner-card">
          <div className="card-heading">
            <div>
              <span className="section-label">
                FINANCE
              </span>

              <h2>📥 Deposit & 📤 Withdrawal</h2>

              <p>
                Area review transaksi pengguna.
              </p>
            </div>
          </div>

          <div className="module-grid">
            <div className="module-item">
              <span className="module-icon">
                📥
              </span>

              <div>
                <strong>
                  Deposit Review
                </strong>

                <p>
                  Melihat deposit PENDING dan
                  melakukan APPROVE atau REJECT.
                </p>
              </div>

              <span className="module-status">
                OWNER
              </span>
            </div>

            <div className="module-item">
              <span className="module-icon">
                📤
              </span>

              <div>
                <strong>
                  Withdrawal Review
                </strong>

                <p>
                  Melihat withdrawal PENDING dan
                  melakukan APPROVE atau REJECT.
                </p>
              </div>

              <span className="module-status">
                OWNER
              </span>
            </div>
          </div>

          <div className="coming-note">
            Finance review UI akan dihubungkan
            setelah endpoint Owner review selesai
            dipasang.
          </div>
        </section>

        {/* ANNOUNCEMENT */}

        <section className="owner-card">
          <div className="card-heading">
            <div>
              <span className="section-label">
                COMMUNICATION
              </span>

              <h2>📢 Announcement</h2>

              <p>
                Komunikasi resmi Owner kepada member.
              </p>
            </div>
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

        {/* DISABLED FEATURES */}

        <section className="owner-card simplified-card">
          <div className="card-heading">
            <div>
              <span className="section-label">
                OWNER POLICY
              </span>

              <h2>Control Scope</h2>

              <p>
                Owner Control Center sengaja
                disederhanakan.
              </p>
            </div>
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
              <span>REMOVED</span>
            </div>

            <div className="policy-row disabled-row">
              <span>🚫</span>
              <strong>
                Block / Unblock User
              </strong>
              <span>REMOVED</span>
            </div>

            <div className="policy-row disabled-row">
              <span>🚫</span>
              <strong>
                Gift Miner
              </strong>
              <span>REMOVED</span>
            </div>

            <div className="policy-row disabled-row">
              <span>🚫</span>
              <strong>Admin Role</strong>
              <span>REMOVED</span>
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
          background: rgba(0, 0, 0, 0.28);
          color: #ffffff;
          outline: none;
          font: inherit;
        }

        input {
          height: 48px;
          padding: 0 14px;
        }

        textarea {
          min-height: 100px;
          padding: 13px 14px;
          resize: vertical;
        }

        input:focus,
        textarea:focus {
          border-color:
            rgba(120, 170, 255, 0.55);
        }

        input:disabled,
        textarea:disabled {
          opacity: 0.55;
        }

        .character-count {
          text-align: right;
          margin-top: -8px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
        }

        .action-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .action-button {
          min-height: 46px;
          padding: 0 18px;
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          color: #ffffff;
          font-weight: 800;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.07);
        }

        .action-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.12);
        }

        .action-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .add-button {
          border-color:
            rgba(80, 220, 150, 0.28);
        }

        .remove-button {
          border-color:
            rgba(255, 100, 100, 0.28);
        }

        .owner-message {
          margin-top: 15px;
          padding: 12px 14px;
          border-radius: 11px;
          font-size: 13px;
        }

        .owner-message.success {
          background: rgba(70, 200, 130, 0.1);
          border: 1px solid
            rgba(70, 200, 130, 0.2);
        }

        .owner-message.error {
          background: rgba(255, 80, 80, 0.1);
          border: 1px solid
            rgba(255, 80, 80, 0.2);
        }

        .security-note {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 18px;
          padding: 13px 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.025);
          color: rgba(255, 255, 255, 0.48);
          font-size: 12px;
          line-height: 1.5;
        }

        .security-note strong {
          color: rgba(255, 255, 255, 0.78);
        }

        .module-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(0, 1fr);
          gap: 12px;
        }

        .module-item {
          display: grid;
          grid-template-columns:
            auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          padding: 15px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.025);
        }

        .module-icon {
          font-size: 24px;
        }

        .module-item strong {
          display: block;
          margin-bottom: 4px;
        }

        .module-item p {
          margin: 0;
          color: rgba(255, 255, 255, 0.45);
          font-size: 12px;
          line-height: 1.5;
        }

        .module-status {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.38);
        }

        .coming-note {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.025);
          color: rgba(255, 255, 255, 0.4);
          font-size: 12px;
        }

        .policy-list {
          display: flex;
          flex-direction: column;
        }

        .policy-row {
          display: grid;
          grid-template-columns:
            28px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.06);
          font-size: 13px;
        }

        .policy-row:last-child {
          border-bottom: 0;
        }

        .policy-row > span:first-child {
          text-align: center;
        }

        .policy-row > span:last-child {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.32);
        }

        .policy-row .enabled {
          color: rgba(90, 220, 150, 0.8);
        }

        .disabled-row {
          opacity: 0.4;
        }

        @media (max-width: 760px) {
          .owner-header {
            flex-direction: column;
          }

          .owner-identity {
            width: 100%;
            box-sizing: border-box;
          }

          .form-grid,
          .module-grid {
            grid-template-columns: 1fr;
          }

          .owner-card {
            padding: 18px;
          }

          .action-row {
            flex-direction: column;
          }

          .action-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
