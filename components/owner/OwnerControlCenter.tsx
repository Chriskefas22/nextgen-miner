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

type ReviewAction = 'approve' | 'reject';

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

  const [reviewingDepositId, setReviewingDepositId] =
    useState<number | null>(null);

  const [reviewNote, setReviewNote] =
    useState<Record<number, string>>({});

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
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
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

  async function reviewDeposit(
    deposit: PendingDeposit,
    action: ReviewAction
  ) {
    if (reviewingDepositId !== null) {
      return;
    }

    const actionLabel =
      action === 'approve'
        ? 'APPROVE'
        : 'REJECT';

    const confirmation = window.confirm(
      action === 'approve'
        ? `APPROVE Deposit #${deposit.id}?\n\n` +
            `User: ${deposit.user_id}\n` +
            `Asset: ${deposit.asset}\n` +
            `Network: ${deposit.network}\n` +
            `USD: $${formatNumber(deposit.usd_amount)}\n` +
            `Diamond: ${formatNumber(deposit.diamond_amount)} 💎\n\n` +
            `APPROVE akan mengkredit wallet melalui protected Owner RPC.`
        : `REJECT Deposit #${deposit.id}?\n\n` +
            `Deposit akan ditandai REJECTED dan tidak mendapatkan kredit 💎.`
    );

    if (!confirmation) {
      return;
    }

    const actionNote =
      reviewNote[deposit.id]?.trim() || '';

    if (actionNote.length > 500) {
      window.alert(
        'Catatan maksimal 500 karakter.'
      );
      return;
    }

    setReviewingDepositId(deposit.id);

    setMessage({
      type: '',
      text: '',
    });

    try {
      const response = await fetch(
        '/api/owner/deposits/review',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            depositId: deposit.id,
            action,
            note: actionNote || null,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Gagal ${actionLabel} deposit.`
        );
      }

      setMessage({
        type: 'success',
        text:
          action === 'approve'
            ? `Deposit #${deposit.id} berhasil di-APPROVE.`
            : `Deposit #${deposit.id} berhasil di-REJECT.`,
      });

      setReviewNote((current) => {
        const next = { ...current };
        delete next[deposit.id];
        return next;
      });

      await loadPendingDeposits();
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : `Gagal ${actionLabel} deposit.`,
      });
    } finally {
      setReviewingDepositId(null);
    }
  }

  return (
    <main className="owner-control-page">
      <div className="owner-control-container">

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

        <section className="owner-card diamond-card">
          <div className="card-heading">
            <span className="section-label">
              FINANCE CONTROL
            </span>

            <h2>💎 Diamond Control</h2>

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
                void adjustDiamond('add')
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
                void adjustDiamond('remove')
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

        <section className="owner-card">
          <div className="card-heading finance-heading">
            <div>
              <span className="section-label">
                FINANCE
              </span>

              <h2>📥 Deposit Review</h2>

              <p>
                Review deposit PENDING melalui
                protected Owner endpoint.
              </p>
            </div>

            <button
              type="button"
              className="refresh-button"
              onClick={() =>
                void loadPendingDeposits()
              }
              disabled={
                depositsLoading ||
                reviewingDepositId !== null
              }
            >
              {depositsLoading
                ? 'Memuat...'
                : '↻ Refresh'}
            </button>
          </div>

          <div className="review-safety">
            <strong>
              🔐 OWNER-ONLY REVIEW
            </strong>

            <span>
              APPROVE dan REJECT hanya dapat
              diproses melalui protected server
              route dan Owner RPC.
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
                  (maks. 100).
                </span>
              </div>

              {deposits.map((deposit) => {
                const reviewing =
                  reviewingDepositId === deposit.id;

                return (
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
                        <span>User ID</span>
                        <strong className="mono">
                          {deposit.user_id}
                        </strong>
                      </div>

                      <div>
                        <span>Asset</span>
                        <strong>
                          {deposit.asset}
                        </strong>
                      </div>

                      <div>
                        <span>Network</span>
                        <strong>
                          {deposit.network}
                        </strong>
                      </div>

                      <div>
                        <span>Crypto Amount</span>
                        <strong>
                          {formatNumber(
                            deposit.amount
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>USD</span>
                        <strong>
                          $
                          {formatNumber(
                            deposit.usd_amount
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>💎 Diamond</span>
                        <strong>
                          {formatNumber(
                            deposit.diamond_amount
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Created</span>
                        <strong>
                          {formatDate(
                            deposit.created_at
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Reference</span>
                        <strong className="mono">
                          {deposit.reference_code ||
                            '-'}
                        </strong>
                      </div>
                    </div>

                    <div className="deposit-hash">
                      <span>TX Hash</span>
                      <strong className="mono">
                        {deposit.tx_hash ||
                          'Belum diisi'}
                      </strong>
                    </div>

                    <div className="review-note">
                      <label
                        htmlFor={`review-note-${deposit.id}`}
                      >
                        Owner Note
                      </label>

                      <textarea
                        id={`review-note-${deposit.id}`}
                        value={
                          reviewNote[deposit.id] ||
                          ''
                        }
                        onChange={(event) =>
                          setReviewNote(
                            (current) => ({
                              ...current,
                              [deposit.id]:
                                event.target.value,
                            })
                          )
                        }
                        placeholder="Catatan review opsional..."
                        maxLength={500}
                        disabled={reviewing}
                      />

                      <div className="character-count">
                        {
                          (
                            reviewNote[
                              deposit.id
                            ] || ''
                          ).length
                        }
                        /500
                      </div>
                    </div>

                    <div className="review-actions">
                      <button
                        type="button"
                        className="review-button approve-button"
                        disabled={
                          reviewing ||
                          reviewingDepositId !== null
                        }
                        onClick={() =>
                          void reviewDeposit(
                            deposit,
                            'approve'
                          )
                        }
                      >
                        {reviewing
                          ? 'Memproses...'
                          : '✅ APPROVE'}
                      </button>

                      <button
                        type="button"
                        className="review-button reject-button"
                        disabled={
                          reviewing ||
                          reviewingDepositId !== null
                        }
                        onClick={() =>
                          void reviewDeposit(
                            deposit,
                            'reject'
                          )
                        }
                      >
                        {reviewing
                          ? 'Memproses...'
                          : '❌ REJECT'}
                      </button>
                    </div>

                    {reviewing && (
                      <div className="processing-note">
                        🔒 Review sedang diproses.
                        Jangan menutup halaman.
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="owner-card">
          <div className="card-heading">
            <span className="section-label">
              FINANCE
            </span>

            <h2>📤 Withdrawal Review</h2>

            <p>
              Owner-only pending withdrawal
              read path sudah disiapkan.
            </p>
          </div>

          <div className="coming-note">
            🔒 Tahap berikutnya: audit read-path
            withdrawal sebelum APPROVE / REJECT
            diaktifkan.
          </div>
        </section>

        <section className="owner-card">
          <div className="card-heading">
            <span className="section-label">
              COMMUNICATION
            </span>

            <h2>📢 Announcement</h2>

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
        </section>

        <section className="owner-card policy-card">
          <div className="card-heading">
            <span className="section-label">
              SECURITY POLICY
            </span>

            <h2>🛡️ Owner Policy</h2>
          </div>

          <div className="policy-list">
            <div className="policy-row">
              <span>
                💎 Diamond Adjustment
              </span>
              <strong>ENABLED</strong>
            </div>

            <div className="policy-row">
              <span>
                📢 Personal Announcement
              </span>
              <strong>ENABLED</strong>
            </div>

            <div className="policy-row">
              <span>
                🌐 Global Announcement
              </span>
              <strong>ENABLED</strong>
            </div>

            <div className="policy-row">
              <span>🎁 Gift Miner</span>
              <strong className="disabled-status">
                DISABLED
              </strong>
            </div>

            <div className="policy-row">
              <span>⚡ Give Hashrate</span>
              <strong className="disabled-status">
                DISABLED
              </strong>
            </div>

            <div className="policy-row">
              <span>🚫 Block / Ban</span>
              <strong className="disabled-status">
                DISABLED
              </strong>
            </div>

            <div className="policy-row">
              <span>👤 Admin Role</span>
              <strong className="disabled-status">
                DISABLED
              </strong>
            </div>
          </div>

          <div className="security-note">
            <strong>
              Owner-only architecture
            </strong>

            <span>
              Tidak ada Admin, Moderator, atau
              Staff role. Privileged actions wajib
              diverifikasi di backend/database.
            </span>
          </div>
        </section>
      </div>

      <style jsx>{`
        .owner-control-page {
          min-height: 100vh;
          padding: 32px 20px 60px;
        }

        .owner-control-container {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
        }

        .owner-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }

        .owner-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .08em;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.14);
        }

        h1 {
          margin: 10px 0 8px;
          font-size: clamp(28px, 5vw, 42px);
          line-height: 1.05;
        }

        h2 {
          margin: 7px 0;
          font-size: 22px;
        }

        p {
          margin: 0;
          opacity: .72;
          line-height: 1.6;
        }

        .owner-identity {
          min-width: 220px;
          padding: 16px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.035);
        }

        .owner-identity span,
        .owner-identity strong {
          display: block;
        }

        .owner-identity span {
          font-size: 11px;
          opacity: .55;
          margin-bottom: 5px;
        }

        .owner-identity strong {
          font-size: 13px;
          word-break: break-word;
        }

        .owner-card {
          margin-bottom: 20px;
          padding: 22px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.09);
          background: rgba(255,255,255,.035);
          box-shadow: 0 14px 50px rgba(0,0,0,.12);
        }

        .diamond-card {
          border-color: rgba(255,255,255,.14);
        }

        .card-heading {
          margin-bottom: 20px;
        }

        .finance-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .section-label {
          display: block;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .12em;
          opacity: .5;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }

        .field,
        .review-note {
          position: relative;
        }

        .field label,
        .review-note label {
          display: block;
          margin-bottom: 7px;
          font-size: 12px;
          font-weight: 700;
          opacity: .72;
        }

        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(255,255,255,.11);
          border-radius: 12px;
          background: rgba(0,0,0,.16);
          color: inherit;
          padding: 12px 13px;
          outline: none;
          font: inherit;
        }

        textarea {
          min-height: 88px;
          resize: vertical;
        }

        input:focus,
        textarea:focus {
          border-color: rgba(255,255,255,.28);
        }

        .character-count {
          text-align: right;
          margin-top: 5px;
          font-size: 10px;
          opacity: .4;
        }

        .action-row,
        .review-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 15px;
        }

        button {
          font: inherit;
        }

        .action-button,
        .review-button,
        .refresh-button {
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 11px;
          padding: 11px 15px;
          cursor: pointer;
          font-weight: 800;
          transition:
            transform .15s ease,
            opacity .15s ease,
            background .15s ease;
        }

        button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        button:disabled {
          cursor: not-allowed;
          opacity: .45;
        }

        .add-button,
        .approve-button {
          background: rgba(60, 180, 100, .14);
        }

        .remove-button,
        .reject-button {
          background: rgba(220, 70, 70, .14);
        }

        .refresh-button {
          background: rgba(255,255,255,.06);
          white-space: nowrap;
        }

        .owner-message {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 11px;
          font-size: 13px;
          border: 1px solid rgba(255,255,255,.1);
        }

        .owner-message.success {
          background: rgba(60,180,100,.1);
        }

        .owner-message.error {
          background: rgba(220,70,70,.1);
        }

        .security-note,
        .review-safety,
        .coming-note,
        .processing-note {
          margin-top: 16px;
          padding: 13px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.025);
        }

        .security-note strong,
        .security-note span,
        .review-safety strong,
        .review-safety span {
          display: block;
        }

        .security-note strong,
        .review-safety strong {
          font-size: 12px;
          margin-bottom: 4px;
        }

        .security-note span,
        .review-safety span {
          font-size: 11px;
          line-height: 1.55;
          opacity: .62;
        }

        .empty-state {
          padding: 30px 15px;
          text-align: center;
          border-radius: 13px;
          border: 1px dashed rgba(255,255,255,.12);
          opacity: .6;
        }

        .deposit-list {
          display: grid;
          gap: 14px;
          margin-top: 16px;
        }

        .deposit-summary {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          opacity: .65;
        }

        .deposit-summary strong {
          font-size: 18px;
          opacity: 1;
        }

        .deposit-item {
          padding: 17px;
          border-radius: 15px;
          border: 1px solid rgba(255,255,255,.09);
          background: rgba(0,0,0,.12);
        }

        .deposit-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 15px;
        }

        .pending-badge {
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
          background: rgba(230,170,50,.12);
          border: 1px solid rgba(230,170,50,.2);
        }

        .deposit-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .deposit-grid > div {
          min-width: 0;
          padding: 10px;
          border-radius: 10px;
          background: rgba(255,255,255,.025);
        }

        .deposit-grid span,
        .deposit-hash span {
          display: block;
          font-size: 10px;
          opacity: .45;
          margin-bottom: 5px;
        }

        .deposit-grid strong {
          display: block;
          font-size: 12px;
          word-break: break-word;
        }

        .mono {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          font-size: 10px !important;
        }

        .deposit-hash {
          margin-top: 12px;
          padding: 10px;
          border-radius: 10px;
          background: rgba(255,255,255,.025);
        }

        .deposit-hash strong {
          display: block;
          word-break: break-all;
          line-height: 1.5;
        }

        .review-note {
          margin-top: 15px;
        }

        .review-actions {
          margin-top: 12px;
        }

        .review-button {
          min-width: 130px;
        }

        .processing-note {
          font-size: 11px;
          opacity: .65;
        }

        .module-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .module-item {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 15px;
          border-radius: 13px;
          border: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.025);
        }

        .module-icon {
          font-size: 22px;
        }

        .module-item strong {
          font-size: 13px;
        }

        .module-item p {
          margin-top: 3px;
          font-size: 11px;
        }

        .module-status {
          font-size: 9px;
          font-weight: 900;
          opacity: .5;
        }

        .policy-list {
          display: grid;
          gap: 2px;
        }

        .policy-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,.06);
          font-size: 13px;
        }

        .policy-row strong {
          font-size: 10px;
          letter-spacing: .08em;
        }

        .disabled-status {
          opacity: .35;
        }

        @media (max-width: 800px) {
          .owner-header {
            flex-direction: column;
          }

          .owner-identity {
            width: 100%;
            box-sizing: border-box;
          }

          .form-grid,
          .deposit-grid,
          .module-grid {
            grid-template-columns: 1fr;
          }

          .finance-heading {
            flex-direction: column;
          }

          .refresh-button {
            width: 100%;
          }

          .review-button {
            flex: 1;
          }
        }

        @media (max-width: 520px) {
          .owner-control-page {
            padding: 20px 12px 40px;
          }

          .owner-card {
            padding: 16px;
          }

          .deposit-topline {
            align-items: flex-start;
            flex-direction: column;
          }

          .review-actions {
            flex-direction: column;
          }

          .review-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
