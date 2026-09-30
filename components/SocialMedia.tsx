import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PenSquare, Inbox, CalendarDays, Link2, FileText, Loader2, AlertTriangle, CheckCircle2, Unplug, RefreshCw } from 'lucide-react';
import { api, type SocialPostDto, type SocialStatus } from '../services/api';
import Composer from './social/Composer';
import PostCard from './social/PostCard';
import SocialCalendar from './social/SocialCalendar';
import { PlatformIcon, platformName, card, btnPrimary, btnDanger } from './social/common';
import { useTeamTime } from '../utils/timeFormat';

type Tab = 'compose' | 'mine' | 'review' | 'calendar' | 'accounts';

interface Props {
  currentUser: any;
}

/**
 * Social media manager. Media Managers write and schedule Instagram/Facebook
 * posts; a Coach approves them; the server publishes at the scheduled time
 * (server/social/worker.ts). Route + nav are gated to Media Manager/Coach, and
 * every endpoint re-checks roles server-side (server/routes/social.ts).
 */
const SocialMedia: React.FC<Props> = ({ currentUser }) => {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<SocialStatus | null>(null);
  const [posts, setPosts] = useState<SocialPostDto[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SocialPostDto | null>(null);
  const [composerKey, setComposerKey] = useState(0);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [loadError, setLoadError] = useState('');
  const userId = Number(currentUser?.id);

  // The URL is the source of truth for the tab, so links, reloads and the
  // back button all land on the right one.
  const TABS: Tab[] = ['compose', 'mine', 'review', 'calendar', 'accounts'];
  const requested = params.get('tab') as Tab;
  const tab: Tab = TABS.includes(requested) && (status?.isCoach || !['review', 'accounts'].includes(requested)) ? requested : 'mine';
  const setTab = (t: Tab) => {
    setParams(t === 'mine' ? {} : { tab: t });
    if (t !== 'compose') setEditing(null);
  };

  const flash = (text: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const s = await api.social.status();
      setStatus(s);
      const view = tab === 'review' ? 'queue' : tab === 'calendar' ? 'calendar' : 'mine';
      if (tab !== 'compose' && tab !== 'accounts') setPosts(await api.social.list(view));
      if (s.isCoach) setQueueCount((await api.social.list('queue')).length);
      setLoadError('');
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);
  // Poll while open so publishing progress and new submissions show up.
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') load(true); }, 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  // Result of the Facebook connect redirect (server/routes/social.ts callback).
  useEffect(() => {
    const err = params.get('error');
    const connected = params.get('connected');
    if (err) flash(err, 'error');
    else if (connected !== null) {
      const ig = Number(params.get('instagram') || 0);
      flash(Number(connected) === 0 ? 'No Facebook Pages were shared. Try again and select the team Page.' : `Connected ${connected} Facebook Page${connected === '1' ? '' : 's'}${ig ? ` and ${ig} Instagram account${ig === 1 ? '' : 's'}` : ''}.`, Number(connected) === 0 ? 'error' : 'ok');
    }
    if (err || connected !== null) setParams({ tab: 'accounts' }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changed = (message?: string) => {
    if (message) flash(message);
    load(true);
  };

  if (loadError && !status) {
    return <div className="max-w-xl mx-auto mt-10 text-center text-sm font-bold text-red-500">{loadError}</div>;
  }

  const isCoach = !!status?.isCoach;
  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number; show: boolean }[] = [
    { id: 'mine', label: 'My posts', icon: <FileText size={14} />, show: true },
    { id: 'compose', label: editing ? 'Edit post' : 'New post', icon: <PenSquare size={14} />, show: true },
    { id: 'review', label: 'Review', icon: <Inbox size={14} />, badge: queueCount, show: isCoach },
    { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={14} />, show: true },
    { id: 'accounts', label: 'Accounts', icon: <Link2 size={14} />, show: isCoach },
  ];
  const disconnectedWarning = status && status.accounts.some((a) => a.needsReconnect);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Social Media</h1>
        <p className="text-teamColor font-black text-xs uppercase tracking-widest mt-1">Instagram &amp; Facebook · {isCoach ? 'Review and schedule' : 'Write, schedule, submit'}</p>
      </div>

      {disconnectedWarning && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-bold flex gap-2 items-start">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>A connected account stopped working, so nothing can publish to it. {isCoach ? <button onClick={() => setTab('accounts')} className="underline">Reconnect it</button> : 'A coach needs to reconnect it.'}</span>
        </div>
      )}

      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-x-auto" role="tablist">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { if (t.id === 'compose' && tab !== 'compose') { setEditing(null); setComposerKey((k) => k + 1); } setTab(t.id); }}
            className={`flex-1 min-w-fit px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${tab === t.id ? 'bg-white dark:bg-slate-700 text-teamColor shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
            {t.icon} {t.label}
            {!!t.badge && <span className="ml-0.5 px-1.5 min-w-[1.25rem] rounded-full bg-teamColor text-white text-[10px]">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'compose' && status && (
        <Composer key={editing ? `edit-${editing.id}` : `new-${composerKey}`} accounts={status.accounts} post={editing}
          onDone={(msg) => { flash(msg); setEditing(null); setTab('mine'); }}
          onCancel={editing ? () => { setEditing(null); setTab('mine'); } : undefined} />
      )}

      {(tab === 'mine' || tab === 'review') && (
        loading ? <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div> : (
          <div className="space-y-3">
            {posts.length === 0 ? (
              <div className={`${card} p-10 text-center`}>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{tab === 'review' ? 'Nothing waiting for review' : 'No posts yet'}</p>
                {tab === 'mine' && <button onClick={() => { setEditing(null); setComposerKey((k) => k + 1); setTab('compose'); }} className={`${btnPrimary} mx-auto mt-4`}><PenSquare size={14} /> Write a post</button>}
              </div>
            ) : posts.filter((p) => tab === 'review' || p.status !== 'canceled').map((p) => (
              <PostCard key={p.id} post={p} context={tab === 'review' ? 'queue' : 'mine'} isCoach={isCoach} currentUserId={userId}
                onChanged={changed} onEdit={(post) => { setEditing(post); setTab('compose'); }} />
            ))}
          </div>
        )
      )}

      {tab === 'calendar' && (
        loading ? <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>
          : <SocialCalendar posts={posts} isCoach={isCoach} currentUserId={userId} onChanged={changed} />
      )}

      {tab === 'accounts' && status && isCoach && <AccountsPanel status={status} onChanged={changed} />}

      {toast && (
        <div role="status" className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-2 max-w-[calc(100%-2rem)] ${toast.tone === 'ok' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'}`}>
          {toast.tone === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {toast.text}
        </div>
      )}
    </div>
  );
};

const AccountsPanel: React.FC<{ status: SocialStatus; onChanged: (m?: string) => void }> = ({ status, onChanged }) => {
  const { fmtDateTime } = useTeamTime();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const connect = () => { window.location.href = '/api/social/meta/connect'; };

  const disconnect = async (id: number, name: string) => {
    if (!confirm(`Disconnect ${name}? Scheduled posts to it will fail until it's connected again.`)) return;
    setBusy(id);
    setError('');
    try {
      await api.social.disconnect(id);
      onChanged(`Disconnected ${name}.`);
    } catch (e: any) {
      setError(e?.message || 'Could not disconnect.');
    } finally {
      setBusy(null);
    }
  };

  if (!status.metaConfigured) {
    return (
      <div className={`${card} p-6 space-y-3`}>
        <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Meta isn’t set up yet</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">Publishing needs a Meta developer app. Follow <span className="font-bold">docs/social-media-setup.md</span>, then add these Replit Secrets and restart the app:</p>
        <ul className="text-xs font-mono text-slate-700 dark:text-slate-200 space-y-1 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl">
          <li>META_APP_ID</li><li>META_APP_SECRET</li><li>META_TOKEN_KEY</li><li>APP_BASE_URL</li>
        </ul>
        {status.redirectUri && <p className="text-xs text-slate-500 dark:text-slate-400">Redirect URI for the Meta app: <code className="font-mono text-slate-800 dark:text-slate-100 break-all">{status.redirectUri}</code></p>}
      </div>
    );
  }

  const dupes = (['facebook', 'instagram'] as const).filter((p) => status.accounts.filter((a) => a.platform === p).length > 1);

  return (
    <div className="space-y-4">
      <div className={`${card} p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Connected accounts</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">Sign in with the Facebook account that manages the team Page. Its linked Instagram account comes along automatically.</p>
          </div>
          <button onClick={connect} className={btnPrimary}>{status.accounts.length ? <><RefreshCw size={14} /> Reconnect</> : <><Link2 size={14} /> Connect with Facebook</>}</button>
        </div>
        {dupes.map((p) => (
          <p key={p} className="mt-3 text-xs font-bold text-amber-700 dark:text-amber-400 flex gap-1.5"><AlertTriangle size={14} className="flex-shrink-0" /> More than one {platformName(p)} account is connected. Disconnect the ones the team doesn’t post to — approvals are blocked until there’s just one.</p>
        ))}
        {!status.accounts.some((a) => a.platform === 'instagram') && status.accounts.length > 0 && (
          <p className="mt-3 text-xs font-bold text-amber-700 dark:text-amber-400 flex gap-1.5"><AlertTriangle size={14} className="flex-shrink-0" /> No Instagram account came through. Link the team Instagram (a Business or Creator account) to the Facebook Page in Instagram’s settings, then reconnect.</p>
        )}
        {error && <p className="text-red-500 text-xs font-bold mt-3">{error}</p>}
        <div className="mt-4 space-y-2">
          {status.accounts.length === 0 && <p className="text-xs text-slate-400 font-bold uppercase tracking-widest text-center py-6">Nothing connected yet</p>}
          {status.accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-teamColor/10 text-teamColor flex items-center justify-center flex-shrink-0"><PlatformIcon platform={a.platform} size={17} /></div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-slate-900 dark:text-white truncate">{a.name}</p>
                <p className={`text-[11px] font-bold truncate ${a.needsReconnect ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                  {a.needsReconnect ? `Needs reconnecting${a.lastError ? ` — ${a.lastError}` : ''}` : `${platformName(a.platform)} · connected ${fmtDateTime(a.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                </p>
              </div>
              <button onClick={() => disconnect(a.id, a.name)} disabled={busy === a.id} className={btnDanger} title="Disconnect">
                {busy === a.id ? <Loader2 size={13} className="animate-spin" /> : <Unplug size={13} />}<span className="hidden sm:inline">Disconnect</span>
              </button>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-400 font-bold px-2">Tokens are encrypted on the server and never sent to browsers. Coaches get a notification if a connection stops working.</p>
    </div>
  );
};

export default SocialMedia;
