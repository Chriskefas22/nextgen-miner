import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function num(v: unknown, d = 2) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d }) : '0';
}
function money(v: unknown, d = 8) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: d })}` : '$0.00';
}
function badge(status: string) {
  if (['HEALTHY','ACTIVE'].includes(status)) return 'badge green';
  if (['WARNING','CAPACITY_GUARDED'].includes(status)) return 'badge gold';
  return 'badge';
}

export default async function StarterMiningAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/auth/login');
  const { data: owner } = await sb.rpc('nextgen_is_owner');
  if (owner !== true) redirect('/dashboard');

  const { data, error } = await sb.rpc('nextgen_owner_starter_mining_dashboard');
  const s = (data ?? {}) as Record<string, any>;
  const status = String(s.status ?? 'UNAVAILABLE');
  const claimed = Number(s.claimed_slots ?? 0);
  const cap = Number(s.max_free_users ?? 1000);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">OWNER CONTROL · STARTER MINING</div>
          <h1 className="page-title">Starter Mining Reserve</h1>
          <div className="muted">Promotional Entry GPU reserve, live accrual capacity, 24h recharge state, and liability protection.</div>
        </div>
        <div className={badge(status)}>{status}</div>
      </div>

      {error ? (
        <section className="glass section">
          <div className="eyebrow">CONTROL PLANE</div>
          <h2>Unavailable</h2>
          <p className="muted">The owner-only starter mining dashboard could not be loaded.</p>
        </section>
      ) : (
        <>
          <div className="grid grid-4">
            <div className="glass stat"><label>Reserve balance</label><b>{money(s.reserve_balance_usd)}</b></div>
            <div className="glass stat"><label>Target 30D reserve</label><b>{money(s.target_30d_reserve_usd)}</b></div>
            <div className="glass stat"><label>Minimum 7D reserve</label><b>{money(s.minimum_7d_reserve_usd)}</b></div>
            <div className="glass stat"><label>Coverage</label><b>{num(s.coverage_days,2)} days</b></div>
          </div>

          <div className="grid grid-4" style={{ marginTop: 14 }}>
            <div className="glass stat"><label>Entry GPU target</label><b>{money(s.target_daily_per_entry_gpu_usd)}</b></div>
            <div className="glass stat"><label>Target / 1,000 H/s / day</label><b>{money(s.target_reward_usd_per_1000_hash_day,4)}</b></div>
            <div className="glass stat"><label>Capacity multiplier</label><b>{num(s.capacity_multiplier,4)}×</b></div>
            <div className="glass stat"><label>Daily free liability</label><b>{money(s.target_daily_liability_usd)}</b></div>
          </div>

          <div className="grid grid-4" style={{ marginTop: 14 }}>
            <div className="glass stat"><label>Free users active</label><b>{num(s.active_free_users,0)} / {num(cap,0)}</b></div>
            <div className="glass stat"><label>Free miners active</label><b>{num(s.active_free_miners,0)}</b></div>
            <div className="glass stat"><label>Settled today</label><b>{money(s.settled_today_usd)}</b></div>
            <div className="glass stat"><label>Settled 30D</label><b>{money(s.settled_30d_usd)}</b></div>
          </div>

          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <section className="glass section">
              <div className="eyebrow">PROMOTION CAPACITY</div>
              <h2>Entry GPU campaign</h2>
              <div className="list-row"><span>Campaign slots</span><b>{num(claimed,0)} / {num(cap,0)}</b></div>
              <div className="list-row"><span>Remaining slots</span><b>{num(s.remaining_slots,0)}</b></div>
              <div className="list-row"><span>Entry GPU hashrate</span><b>{num(s.entry_gpu_hashrate,2)} H/s</b></div>
              <div className="list-row"><span>Fallback Basic CPU</span><b>{num(s.fallback_basic_cpu_hashrate,2)} H/s</b></div>
              <div className="list-row"><span>Full-rate reserve threshold</span><b>{money(s.target_30d_reserve_usd)}</b></div>
            </section>

            <section className="glass section">
              <div className="eyebrow">RECHARGE CONTROL</div>
              <h2>24-hour mining lifecycle</h2>
              <div className="list-row"><span>Active cycles</span><b>{num(s.active_cycles,0)}</b></div>
              <div className="list-row"><span>Paused cycles</span><b>{num(s.paused_cycles,0)}</b></div>
              <div className="list-row"><span>Expired / unsettled</span><b>{num(s.expired_unsettled_cycles,0)}</b></div>
              <p className="muted" style={{ marginTop: 12 }}>Active miners accrue only inside their recharge window. Expired sessions are paused and settled server-side before renewal.</p>
            </section>
          </div>

          <section className="glass section" style={{ marginTop: 14 }}>
            <div className="eyebrow">ECONOMIC GUARD</div>
            <h2>Reserve policy</h2>
            <p className="muted">The starter rail is fully funded only when the reserve covers the target free-user liability horizon. Below full coverage, the live reward rate is throttled by the capacity multiplier. Below the 7-day floor, new 24h renewals are blocked rather than creating unfunded debt.</p>
            <div className="grid grid-4" style={{ marginTop: 12 }}>
              <div className="glass stat"><label>Target horizon</label><b>{num(s.target_coverage_days,0)} days</b></div>
              <div className="glass stat"><label>Warning horizon</label><b>{num(s.warning_coverage_days,0)} days</b></div>
              <div className="glass stat"><label>Minimum horizon</label><b>{num(s.minimum_coverage_days,0)} days</b></div>
              <div className="glass stat"><label>Reserve funded</label><b>{s.reserve_balance_usd > 0 ? 'YES' : 'NO'}</b></div>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
