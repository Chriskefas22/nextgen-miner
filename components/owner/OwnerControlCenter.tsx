'use client';

import { useState } from 'react';

export default function OwnerControlCenter() {
  const [targetUserId, setTargetUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function adjustDiamond(delta: number) {
    setMessage('');

    if (!targetUserId || !amount || !note.trim()) {
      setMessage(
        'User ID, jumlah 💎, dan alasan wajib diisi.'
      );
      return;
    }

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setMessage('Jumlah 💎 tidak valid.');
      return;
    }

    setBusy(true);

    try {
      const response = await fetch('/api/owner/diamond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId,
          delta: delta * value,
          note,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Gagal memproses perubahan Diamond.'
        );
      }

      setMessage(
        `Berhasil. Audit ID: ${data.auditId}`
      );

      setAmount('');
      setNote('');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: 24,
      }}
    >
      <h1>Owner Control Center</h1>

      <p>
        OWNER ONLY — minernextgen@gmail.com
      </p>

      <section
        style={{
          marginTop: 24,
          padding: 20,
          border:
            '1px solid rgba(255,255,255,.15)',
          borderRadius: 16,
        }}
      >
        <h2>💎 Diamond Adjustment</h2>

        <p>
          Perubahan saldo hanya melalui protected
          Owner RPC dan selalu dicatat ke ledger +
          audit.
        </p>

        <input
          value={targetUserId}
          onChange={(event) =>
            setTargetUserId(event.target.value)
          }
          placeholder="Target user UUID"
          style={{
            width: '100%',
            marginBottom: 10,
            padding: 12,
          }}
        />

        <input
          value={amount}
          onChange={(event) =>
            setAmount(event.target.value)
          }
          placeholder="Jumlah Diamond"
          inputMode="decimal"
          style={{
            width: '100%',
            marginBottom: 10,
            padding: 12,
          }}
        />

        <textarea
          value={note}
          onChange={(event) =>
            setNote(event.target.value)
          }
          placeholder="Alasan / catatan"
          style={{
            width: '100%',
            minHeight: 90,
            marginBottom: 10,
            padding: 12,
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            disabled={busy}
            onClick={() => adjustDiamond(1)}
          >
            ➕ Tambah 💎
          </button>

          <button
            disabled={busy}
            onClick={() => adjustDiamond(-1)}
          >
            ➖ Kurangi 💎
          </button>
        </div>

        {message && (
          <p style={{ marginTop: 14 }}>
            {message}
          </p>
        )}
      </section>

      <section
        style={{
          marginTop: 20,
          padding: 20,
          border:
            '1px solid rgba(255,255,255,.15)',
          borderRadius: 16,
        }}
      >
        <h2>Owner Modules</h2>

        <ul>
          <li>
            Deposit approval / rejection
          </li>

          <li>
            Withdrawal approval / rejection
          </li>

          <li>Gift Miner</li>

          <li>Gift Hashrate</li>

          <li>Block / Unblock user</li>

          <li>
            Personal / global announcement
          </li>

          <li>User management</li>
        </ul>

        <p>
          Modul-modul ini akan dihubungkan ke
          backend Owner setelah endpoint
          masing-masing selesai diaudit.
        </p>
      </section>
    </main>
  );
}
