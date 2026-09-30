import React, { useEffect, useState } from 'react';
import { Check, CornerUpLeft, Pencil, Undo2, X, Loader2, ExternalLink, RotateCcw, History, CalendarClock, AlertTriangle } from 'lucide-react';
import { api, type SocialPostDto, type SocialPostDetailDto } from '../../services/api';
import { pacificDateTime } from '../../utils/dates';
import { useTeamTime } from '../../utils/timeFormat';
import PostPreview from './PostPreview';
import { StatusBadge, PlatformIcon, platformName, TARGET_LABEL, MediaThumb, card, input, btnPrimary, btnGhost, btnDanger, wallClockIn } from './common';

export type CardContext = 'mine' | 'queue' | 'calendar';

interface Props {
  post: SocialPostDto;
  context: CardContext;
  isCoach: boolean;
  currentUserId: number;
  onChanged: (message?: string) => void;
  onEdit?: (post: SocialPostDto) => void;
}

const EVENT_LABEL: Record<string, string> = {
  created: 'Created',
  edited: 'Edited',
  submitted: 'Submitted for review',
  withdrawn: 'Withdrawn to draft',
  approved: 'Approved',
  sent_back: 'Sent back for changes',
  unscheduled: 'Unscheduled',
  canceled: 'Canceled',
  edited_after_approval: 'Edited after approval — needs re-approval',
  publishing_started: 'Publishing started',
  published_instagram: 'Published to Instagram',
  published_facebook: 'Published to Facebook',
  failed_instagram: 'Instagram publish failed',
  failed_facebook: 'Facebook publish failed',
  retry_instagram: 'Retrying Instagram',
  retry_facebook: 'Retrying Facebook',
};

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-800 w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

const PostCard: React.FC<Props> = ({ post, context, isCoach, currentUserId, onChanged, onEdit }) => {
  const { fmtDateTime, homeTz } = useTeamTime();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'approve' | 'sendback' | 'details' | null>(null);
  const mine = post.authorId === currentUserId;

  const run = async (key: string, fn: () => Promise<unknown>, message?: string) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      setDialog(null);
      onChanged(message);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const when = post.scheduledAt ? fmtDateTime(post.scheduledAt, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'As soon as approved';
  const failedTargets = post.targets.filter((t) => t.status === 'failed');

  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="flex gap-4">
        {post.media.length > 0 ? (
          <button type="button" onClick={() => setDialog('details')} className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-2xl overflow-hidden" aria-label="View post">
            <MediaThumb m={post.media[0]} className="w-full h-full" />
            {post.media.length > 1 && <span className="absolute bottom-1 right-1 px-1.5 rounded bg-black/60 text-white text-[10px] font-bold">+{post.media.length - 1}</span>}
          </button>
        ) : (
          <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 text-[10px] font-black uppercase">Text</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StatusBadge status={post.status} />
            {post.platforms.map((p) => <PlatformIcon key={p} platform={p} size={14} className="text-slate-500 dark:text-slate-400" />)}
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1"><CalendarClock size={12} /> {when}</span>
          </div>
          <p className="text-sm text-slate-800 dark:text-slate-100 line-clamp-2 whitespace-pre-wrap break-words">{post.caption || <span className="italic text-slate-400">No caption</span>}</p>
          <p className="text-[11px] text-slate-400 font-bold mt-1">
            {!mine && <>By {post.authorName} · </>}
            {post.approvedByName && ['approved', 'publishing', 'published', 'partially_published', 'failed'].includes(post.status) ? `Approved by ${post.approvedByName}` : `Updated ${fmtDateTime(post.updatedAt)}`}
          </p>
        </div>
      </div>

      {post.feedback && (
        <div className="mt-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-700 dark:text-orange-400">Coach feedback{post.feedback.by ? ` · ${post.feedback.by}` : ''}: </span>
          <span className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{post.feedback.comment}</span>
        </div>
      )}

      {post.targets.length > 0 && post.status !== 'approved' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.targets.map((t) => (
            <div key={t.id} className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 ${t.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : t.status === 'published' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              <PlatformIcon platform={t.platform} size={12} /> {TARGET_LABEL[t.status] || t.status}
              {t.permalink && <a href={t.permalink} target="_blank" rel="noreferrer" className="underline flex items-center gap-0.5">View <ExternalLink size={10} /></a>}
              {isCoach && t.status === 'failed' && (
                <button onClick={() => run(`retry-${t.id}`, () => api.social.retryTarget(t.id), `Retrying ${platformName(t.platform)}…`)} disabled={!!busy} className="ml-1 underline flex items-center gap-0.5">
                  {busy === `retry-${t.id}` ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />} Retry
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {failedTargets.map((t) => t.lastError && (
        <p key={t.id} className="mt-2 text-[11px] text-red-600 dark:text-red-400 font-bold flex gap-1.5"><AlertTriangle size={12} className="flex-shrink-0 mt-0.5" /> {platformName(t.platform)}: {t.lastError}</p>
      ))}

      {error && <p className="text-red-500 text-xs font-bold mt-2">{error}</p>}

      <div className="flex flex-wrap gap-2 mt-4 justify-end">
        <button onClick={() => setDialog('details')} className={btnGhost}><History size={13} /> Details</button>
        {context === 'mine' && mine && ['draft', 'changes_requested', 'submitted', 'approved'].includes(post.status) && onEdit && (
          <button onClick={() => onEdit(post)} className={btnGhost}><Pencil size={13} /> Edit</button>
        )}
        {context === 'mine' && mine && post.status === 'submitted' && (
          <button onClick={() => run('withdraw', () => api.social.withdraw(post.id), 'Moved back to drafts.')} disabled={!!busy} className={btnGhost}>
            {busy === 'withdraw' ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Withdraw
          </button>
        )}
        {(mine || isCoach) && ['draft', 'changes_requested', 'submitted', 'approved'].includes(post.status) && context !== 'calendar' && (
          <button onClick={() => { if (confirm('Cancel this post? It won’t be published.')) run('cancel', () => api.social.cancel(post.id), 'Post canceled.'); }} disabled={!!busy} className={btnDanger}>
            {busy === 'cancel' ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Cancel post
          </button>
        )}
        {isCoach && context === 'calendar' && post.status === 'approved' && (
          <>
            <button onClick={() => run('unschedule', () => api.social.unschedule(post.id), 'Moved back to the review queue.')} disabled={!!busy} className={btnGhost}>
              {busy === 'unschedule' ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Unschedule
            </button>
            <button onClick={() => setDialog('sendback')} className={btnGhost}><CornerUpLeft size={13} /> Send back</button>
          </>
        )}
        {isCoach && context === 'queue' && post.status === 'submitted' && (
          <>
            <button onClick={() => setDialog('sendback')} className={btnGhost}><CornerUpLeft size={13} /> Send back</button>
            <button onClick={() => setDialog('approve')} className={btnPrimary}><Check size={13} /> Approve</button>
          </>
        )}
      </div>

      {dialog === 'approve' && (
        <ApproveDialog post={post} homeTz={homeTz} busy={busy === 'approve'} error={error}
          onClose={() => { setDialog(null); setError(''); }}
          onApprove={(iso) => run('approve', () => api.social.approve(post.id, iso), iso && new Date(iso).getTime() > Date.now() + 60_000 ? 'Approved and scheduled.' : 'Approved — publishing now.')} />
      )}
      {dialog === 'sendback' && (
        <SendBackDialog busy={busy === 'sendback'} error={error}
          onClose={() => { setDialog(null); setError(''); }}
          onSend={(comment) => run('sendback', () => api.social.sendBack(post.id, comment), 'Sent back to the student.')} />
      )}
      {dialog === 'details' && <DetailsDialog postId={post.id} onClose={() => setDialog(null)} />}
    </div>
  );
};

const ApproveDialog: React.FC<{
  post: SocialPostDto; homeTz: string; busy: boolean; error: string;
  onClose: () => void; onApprove: (iso: string | null) => void;
}> = ({ post, homeTz, busy, error, onClose, onApprove }) => {
  const initial = post.scheduledAt ? wallClockIn(homeTz, post.scheduledAt) : null;
  const [mode, setMode] = useState<'scheduled' | 'now'>(post.scheduledAt ? 'scheduled' : 'now');
  const [date, setDate] = useState(initial?.date ?? '');
  const [time, setTime] = useState(initial?.time ?? '17:00');
  const iso = mode === 'now' || !date ? null : pacificDateTime(date, time || '00:00', homeTz).toISOString();
  const past = iso !== null && new Date(iso).getTime() <= Date.now();

  return (
    <Modal title="Approve post" onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-5">
        <PostPreview caption={post.caption} media={post.media} platforms={post.platforms} />
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">Once approved, this publishes automatically to {post.platforms.map(platformName).join(' and ')} at the time below — nobody needs to press anything else.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('scheduled')} aria-pressed={mode === 'scheduled'} className={`flex-1 px-3 py-2 rounded-xl border-2 text-xs font-black ${mode === 'scheduled' ? 'border-teamColor bg-teamColor/10 text-teamColor' : 'border-slate-200 dark:border-slate-600 text-slate-500'}`}>At a time</button>
            <button type="button" onClick={() => setMode('now')} aria-pressed={mode === 'now'} className={`flex-1 px-3 py-2 rounded-xl border-2 text-xs font-black ${mode === 'now' ? 'border-teamColor bg-teamColor/10 text-teamColor' : 'border-slate-200 dark:border-slate-600 text-slate-500'}`}>Right now</button>
          </div>
          {mode === 'scheduled' && (
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} aria-label="Date" />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} aria-label="Time" />
            </div>
          )}
          {past && <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">That time has already passed — it will publish right away.</p>}
          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
          <button onClick={() => onApprove(iso)} disabled={busy || (mode === 'scheduled' && !date)} className={`${btnPrimary} w-full`}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {mode === 'now' || past ? 'Approve & publish now' : 'Approve & schedule'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const SendBackDialog: React.FC<{ busy: boolean; error: string; onClose: () => void; onSend: (comment: string) => void }> = ({ busy, error, onClose, onSend }) => {
  const [comment, setComment] = useState('');
  return (
    <Modal title="Send back for changes" onClose={onClose}>
      <label htmlFor="sendback-comment" className="text-xs text-slate-600 dark:text-slate-300 font-bold">What should the student change? They’ll see this on the post.</label>
      <textarea id="sendback-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} className={`${input} mt-2 font-medium`} autoFocus />
      {error && <p className="text-red-500 text-xs font-bold mt-2">{error}</p>}
      <button onClick={() => onSend(comment)} disabled={busy || !comment.trim()} className={`${btnPrimary} w-full mt-3`}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <CornerUpLeft size={14} />} Send back
      </button>
    </Modal>
  );
};

const DetailsDialog: React.FC<{ postId: number; onClose: () => void }> = ({ postId, onClose }) => {
  const { fmtDateTime } = useTeamTime();
  const [detail, setDetail] = useState<SocialPostDetailDto | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.social.get(postId).then(setDetail).catch((e) => setError(e?.message || 'Could not load')); }, [postId]);
  return (
    <Modal title="Post details" onClose={onClose} wide>
      {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
      {!detail && !error && <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" /></div>}
      {detail && (
        <div className="grid sm:grid-cols-2 gap-5">
          <PostPreview caption={detail.caption} media={detail.media} platforms={detail.platforms} />
          <div className="space-y-4">
            <div className="flex items-center gap-2"><StatusBadge status={detail.status} /><span className="text-[11px] font-bold text-slate-500">by {detail.authorName}</span></div>
            {detail.targets.length > 0 && (
              <div className="space-y-1.5">
                {detail.targets.map((t) => (
                  <div key={t.id} className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <PlatformIcon platform={t.platform} size={13} /> {TARGET_LABEL[t.status] || t.status}
                    {t.permalink && <a href={t.permalink} target="_blank" rel="noreferrer" className="text-teamColor underline flex items-center gap-0.5">Open <ExternalLink size={10} /></a>}
                  </div>
                ))}
              </div>
            )}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">History</p>
              <ol className="space-y-2 border-l-2 border-slate-100 dark:border-slate-700 pl-3">
                {detail.events.map((e) => (
                  <li key={e.id} className="text-xs">
                    <p className="font-bold text-slate-800 dark:text-slate-100">{EVENT_LABEL[e.action] || e.action}{e.actorName ? ` · ${e.actorName}` : ''}</p>
                    {e.comment && <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap mt-0.5">“{e.comment}”</p>}
                    <p className="text-[10px] text-slate-400 font-bold">{fmtDateTime(e.at)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default PostCard;
