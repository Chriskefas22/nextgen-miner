'use client';

import {
  Camera,
  CheckCircle2,
  Clock3,
  Edit3,
  Gauge,
  Mail,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { ChangeEvent, CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';

type Snapshot = {
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  metadata: Record<string, unknown>;
  diamond_balance: number;
  total_miners: number;
  active_miners: number;
  total_hashrate: number;
  highest_level: number;
  referrals: number;
  assets: number;
  rooms: number;
};

const DEFAULT_AVATAR = '/branding/nextgen-miner-logo.svg';

function number(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(value: number, digits = 2) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
  }).format(value);
}

function hash(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MH/s`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)} KH/s`;
  return `${fmt(value, 0)} H/s`;
}

function relativeMembership(createdAt: string) {
  const start = new Date(createdAt).getTime();
  const now = Date.now();
  const totalDays = Math.max(0, Math.floor((now - start) / 86_400_000));

  if (totalDays < 1) return 'Joined today';

  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;

  if (months === 0) return `${totalDays} day${totalDays === 1 ? '' : 's'} active`;
  if (days === 0) return `${months} month${months === 1 ? '' : 's'} active`;
  return `${months} month${months === 1 ? '' : 's'} · ${days} day${days === 1 ? '' : 's'} active`;
}

function displayNameOf(snapshot: Snapshot) {
  const meta = snapshot.metadata ?? {};
  return String(
    meta.display_name ||
      meta.full_name ||
      meta.name ||
      meta.username ||
      snapshot.email.split('@')[0] ||
      'Miner',
  );
}

function avatarOf(snapshot: Snapshot) {
  const meta = snapshot.metadata ?? {};
  return String(meta.avatar_url || meta.picture || '');
}

export default function ProfilePage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function loadProfile() {
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data, error: snapshotError } = await supabase.rpc('nextgen_profile_snapshot');

    if (snapshotError) {
      setSnapshot(null);
      setError('Unable to load profile data. Please refresh and try again.');
      setLoading(false);
      return;
    }

    const next = data as Snapshot;
    setSnapshot(next);
    setName(displayNameOf(next));
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setError('Authentication required.');
        setLoading(false);
        return;
      }

      await loadProfile();
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const nameValue = snapshot ? displayNameOf(snapshot) : 'Miner';
  const avatarUrl = snapshot ? avatarOf(snapshot) : '';
  const activeDays = snapshot
    ? Math.max(0, Math.floor((Date.now() - new Date(snapshot.created_at).getTime()) / 86_400_000))
    : 0;

  const completion = useMemo(() => {
    if (!snapshot) return { percent: 0, completed: 0, total: 5 };

    const items = [
      Boolean(snapshot.email_confirmed_at),
      Boolean(nameValue.trim()),
      Boolean(avatarUrl),
      snapshot.total_miners > 0,
      snapshot.rooms > 0,
    ];

    const completed = items.filter(Boolean).length;

    return {
      percent: Math.round((completed / items.length) * 100),
      completed,
      total: items.length,
    };
  }, [snapshot, nameValue, avatarUrl]);

  const miningProgress = snapshot
    ? Math.min(100, Math.round((Math.max(snapshot.highest_level, 0) / 10) * 100))
    : 0;

  async function saveName(event: FormEvent) {
    event.preventDefault();

    const trimmed = name.trim().replace(/\s+/g, ' ');

    if (!trimmed) {
      setNotice('Enter a valid display name.');
      return;
    }

    setSavingName(true);
    setNotice('');

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        display_name: trimmed,
        full_name: trimmed,
      },
    });

    if (updateError) {
      setNotice(updateError.message);
      setSavingName(false);
      return;
    }

    await loadProfile();
    setEditorOpen(false);
    setNotice('Profile name updated.');
    setSavingName(false);
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setNotice('Use JPG, PNG, WEBP, or GIF.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice('Photo must be 5 MB or smaller.');
      return;
    }

    setUploading(true);
    setNotice('');

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setNotice('Authentication required.');
      setUploading(false);
      return;
    }

    const previousPath = String(snapshot?.metadata?.avatar_path || '');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      setNotice(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path);

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        avatar_url: publicData.publicUrl,
        avatar_path: path,
      },
    });

    if (updateError) {
      await supabase.storage.from('avatars').remove([path]);
      setNotice(updateError.message);
      setUploading(false);
      return;
    }

    if (previousPath && previousPath !== path) {
      await supabase.storage.from('avatars').remove([previousPath]);
    }

    await loadProfile();
    setNotice('Profile photo updated.');
    setUploading(false);
  }

  if (loading) {
    return (
      <AppShell>
        <div className="profile-page">
          <div className="profile-skeleton hero" />
          <div className="profile-skeleton-row">
            <div className="profile-skeleton card" />
            <div className="profile-skeleton card" />
            <div className="profile-skeleton card" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!snapshot) {
    return (
      <AppShell>
        <div className="profile-page">
          <section className="profile-error glass">
            <div className="profile-error-icon"><UserRound size={24} /></div>
            <div>
              <div className="eyebrow">PROFILE</div>
              <h1>Profile unavailable</h1>
              <p>{error || 'Unable to load profile data.'}</p>
              <button className="btn btn-primary" type="button" onClick={loadProfile}>
                Try Again
              </button>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="profile-page">
        <header className="profile-page-head">
          <div>
            <div className="eyebrow">PROFILE · MEMBER CENTER</div>
            <h1 className="page-title">Your Profile</h1>
            <p className="muted">
              Manage your identity, account progress, and mining milestones from one place.
            </p>
          </div>
          <span className="profile-status-badge"><i /> ACTIVE MEMBER</span>
        </header>

        {notice ? (
          <div className="profile-toast" role="status">
            <Sparkles size={15} />
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice">
              <X size={14} />
            </button>
          </div>
        ) : null}

        <section className="profile-hero glass">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                <img src={DEFAULT_AVATAR} alt="" className="profile-default-avatar" />
              )}
            </div>
            <button
              type="button"
              className="profile-avatar-edit"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Change profile photo"
              title="Change profile photo"
            >
              {uploading ? <Clock3 size={14} /> : <Camera size={14} />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={handlePhoto}
            />
          </div>

          <div className="profile-identity">
            <div className="profile-name-line">
              <h2>{nameValue}</h2>
              <span className="verified-chip"><CheckCircle2 size={13} /> VERIFIED</span>
            </div>
            <p className="profile-email"><Mail size={14} /> {snapshot.email}</p>
            <div className="profile-meta">
              <span><Clock3 size={13} /> {relativeMembership(snapshot.created_at)}</span>
              <span>
                Joined {new Date(snapshot.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary profile-edit-btn"
            onClick={() => setEditorOpen((value) => !value)}
          >
            <Edit3 size={15} />
            Edit Profile
          </button>

          {editorOpen ? (
            <form className="profile-editor" onSubmit={saveName}>
              <div className="profile-editor-head">
                <div>
                  <small>PROFILE EDITOR</small>
                  <strong>Update your public display</strong>
                </div>
                <button type="button" onClick={() => setEditorOpen(false)} aria-label="Close editor">
                  <X size={16} />
                </button>
              </div>

              <div className="profile-editor-grid">
                <label className="field">
                  <span>Display name</span>
                  <input
                    className="input"
                    value={name}
                    maxLength={36}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your display name"
                  />
                </label>

                <div className="profile-photo-control">
                  <span>Profile photo</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload size={15} />
                    {uploading ? 'Uploading…' : 'Choose Photo'}
                  </button>
                </div>

                <button className="btn btn-primary" type="submit" disabled={savingName}>
                  {savingName ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="profile-stats-grid">
          <article className="profile-stat glass">
            <span className="profile-stat-icon"><Clock3 size={17} /></span>
            <div>
              <small>MEMBERSHIP AGE</small>
              <strong>{activeDays}</strong>
              <em>days</em>
            </div>
          </article>
          <article className="profile-stat glass">
            <span className="profile-stat-icon"><Gauge size={17} /></span>
            <div>
              <small>ACTIVE MINERS</small>
              <strong>{snapshot.active_miners}</strong>
              <em>online</em>
            </div>
          </article>
          <article className="profile-stat glass">
            <span className="profile-stat-icon">💎</span>
            <div>
              <small>DIAMOND BALANCE</small>
              <strong>{fmt(snapshot.diamond_balance, 0)}</strong>
              <em>available</em>
            </div>
          </article>
          <article className="profile-stat glass">
            <span className="profile-stat-icon"><Sparkles size={17} /></span>
            <div>
              <small>TOTAL HASHRATE</small>
              <strong>{hash(snapshot.total_hashrate)}</strong>
              <em>live capacity</em>
            </div>
          </article>
        </section>

        <div className="profile-main-grid">
          <section className="glass profile-panel">
            <div className="profile-panel-head">
              <div>
                <div className="eyebrow">ACCOUNT PROGRESS</div>
                <h2>Profile Completion</h2>
              </div>
              <strong>{completion.percent}%</strong>
            </div>

            <div className="profile-progress">
              <span style={{ width: `${completion.percent}%` }} />
            </div>

            <div className="profile-progress-copy">
              <span>{completion.completed} of {completion.total} essentials complete</span>
              <span>{completion.percent >= 100 ? 'All set' : 'Keep building'}</span>
            </div>

            <div className="profile-check-list">
              <div className={snapshot.email_confirmed_at ? 'complete' : ''}>
                <span>
                  {snapshot.email_confirmed_at ? <CheckCircle2 size={15} /> : <Mail size={15} />}
                </span>
                <div>
                  <b>Email verified</b>
                  <small>
                    {snapshot.email_confirmed_at ? 'Security check complete' : 'Verify your email'}
                  </small>
                </div>
              </div>

              <div className={nameValue ? 'complete' : ''}>
                <span>{nameValue ? <CheckCircle2 size={15} /> : <UserRound size={15} />}</span>
                <div>
                  <b>Display name</b>
                  <small>{nameValue ? 'Identity is configured' : 'Add your name'}</small>
                </div>
              </div>

              <div className={avatarUrl ? 'complete' : ''}>
                <span>{avatarUrl ? <CheckCircle2 size={15} /> : <Camera size={15} />}</span>
                <div>
                  <b>Profile photo</b>
                  <small>
                    {avatarUrl
                      ? 'Custom photo added'
                      : 'Use the NextGen Miner default or upload one'}
                  </small>
                </div>
              </div>

              <div className={snapshot.total_miners > 0 ? 'complete' : ''}>
                <span>
                  {snapshot.total_miners > 0 ? <CheckCircle2 size={15} /> : <Gauge size={15} />}
                </span>
                <div>
                  <b>Mining setup</b>
                  <small>
                    {snapshot.total_miners > 0
                      ? `${snapshot.total_miners} miner${snapshot.total_miners === 1 ? '' : 's'} owned`
                      : 'Get your first miner'}
                  </small>
                </div>
              </div>

              <div className={snapshot.rooms > 0 ? 'complete' : ''}>
                <span>
                  {snapshot.rooms > 0 ? <CheckCircle2 size={15} /> : <ShieldCheck size={15} />}
                </span>
                <div>
                  <b>Room deployment</b>
                  <small>
                    {snapshot.rooms > 0
                      ? `${snapshot.rooms} room${snapshot.rooms === 1 ? '' : 's'} available`
                      : 'Open your first mining room'}
                  </small>
                </div>
              </div>
            </div>
          </section>

          <section className="glass profile-panel">
            <div className="profile-panel-head">
              <div>
                <div className="eyebrow">MINING PROGRESSION</div>
                <h2>Current Milestone</h2>
              </div>
              <strong>LV.{snapshot.highest_level}/10</strong>
            </div>

            <div className="profile-level-visual">
              <div
                className="profile-level-ring"
                style={{ '--progress': `${miningProgress * 3.6}deg` } as CSSProperties}
              >
                <div>
                  <small>HIGHEST</small>
                  <b>LV.{snapshot.highest_level}</b>
                </div>
              </div>

              <div className="profile-level-copy">
                <span>Upgrade progress</span>
                <strong>{miningProgress}%</strong>
                <div className="profile-progress">
                  <span style={{ width: `${miningProgress}%` }} />
                </div>
                <small>
                  Next milestone: Level {Math.min(10, Math.max(1, snapshot.highest_level + 1))}
                </small>
              </div>
            </div>

            <div className="profile-mini-grid">
              <div><small>MINERS</small><b>{snapshot.total_miners}</b></div>
              <div><small>ROOMS</small><b>{snapshot.rooms}</b></div>
              <div><small>REFERRALS</small><b>{snapshot.referrals}</b></div>
              <div><small>ASSETS</small><b>{snapshot.assets}</b></div>
            </div>
          </section>
        </div>

        <section className="glass profile-security">
          <div className="profile-security-icon"><ShieldCheck size={20} /></div>
          <div>
            <div className="eyebrow">ACCOUNT SECURITY</div>
            <h2>Identity &amp; Access</h2>
            <p>
              Your profile name and photo are stored with your authenticated account.
              Wallet and mining actions remain protected by server-side validation.
            </p>
          </div>
          <span className="profile-security-state"><i /> SECURE</span>
        </section>
      </div>
    </AppShell>
  );
}
