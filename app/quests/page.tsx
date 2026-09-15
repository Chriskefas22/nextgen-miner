'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';

type Quest = {
  id: number;
  quest_key: string;
  title: string;
  description: string;
  target_count: number | string;
  reward_diamond: number | string;
  progress: number | string;
  claimed_at?: string | null;
  period_key?: string;
};

type QuestSnapshot = {
  period_key: string;
  quests: Quest[];
};

export default function Quests() {
  const [snapshot, setSnapshot] = useState<QuestSnapshot | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('nextgen_quests_snapshot');
    if (error) {
      setMessage(error.message || 'Unable to load quests.');
      return;
    }
    setSnapshot((data ?? { period_key: '', quests: [] }) as QuestSnapshot);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const claim = async (quest: Quest) => {
    if (busyId !== null || quest.claimed_at) return;
    setBusyId(quest.id);
    setMessage('');

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('nextgen_claim_quest', {
        p_quest_id: quest.id,
      });
      if (error) throw error;
      const reward = Number((data as { reward_diamond?: unknown } | null)?.reward_diamond ?? quest.reward_diamond);
      setMessage(`${quest.title}: CLAIMED ✓ +${reward} Diamond`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Quest claim failed.');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">MISSIONS</div>
          <h1 className="page-title">Daily Quests</h1>
          <div className="muted">Progress and claim eligibility are measured by the server.</div>
        </div>
        {snapshot?.period_key ? <div className="muted">Cycle: {snapshot.period_key}</div> : null}
      </div>

      {message ? <div className="glass section" style={{ marginBottom: 14 }}>{message}</div> : null}

      {!snapshot ? (
        <div className="glass section">SYNCING QUEST ENGINE…</div>
      ) : snapshot.quests.length === 0 ? (
        <div className="glass section">
          <div className="eyebrow">NO QUESTS</div>
          <h2>No active quests</h2>
          <p className="muted">The server has not published any enabled daily quests for this cycle.</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {snapshot.quests.map((quest) => {
            const target = Number(quest.target_count || 0);
            const progress = Math.min(target, Math.max(0, Number(quest.progress || 0)));
            const pct = target > 0 ? Math.round((progress / target) * 100) : 0;
            const complete = progress >= target;
            const claimed = Boolean(quest.claimed_at);

            return (
              <section className="glass section" key={quest.id}>
                <div className="section-head">
                  <div>
                    <h2>{quest.title}</h2>
                    <div className="muted">{quest.description}</div>
                  </div>
                  <b>💎 {Number(quest.reward_diamond || 0)}</b>
                </div>

                <div className="muted" style={{ marginTop: 10 }}>
                  Progress {progress} / {target}
                </div>

                <div className="progress" style={{ marginTop: 12 }}>
                  <span style={{ width: `${pct}%` }} />
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  disabled={claimed || !complete || busyId !== null}
                  onClick={() => void claim(quest)}
                >
                  {claimed ? 'CLAIMED ✓' : complete ? 'CLAIM REWARD' : 'IN PROGRESS'}
                </button>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
