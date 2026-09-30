import React, { useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, X, ChevronLeft, ChevronRight, Send, Save, Clock, AlertTriangle, Film, Crop } from 'lucide-react';
import { api, type SocialAccountDto, type SocialMediaDto, type SocialPostDto } from '../../services/api';
import { LIMITS, countHashtags, validatePost, describeShape, type SocialPlatform } from '../../shared/social';
import { pacificDateTime } from '../../utils/dates';
import { useTeamTime } from '../../utils/timeFormat';
import { prepareSocialImage, probeVideo } from '../../utils/image';
import PostPreview from './PostPreview';
import { PlatformIcon, platformName, card, input, btnPrimary, btnGhost, wallClockIn } from './common';

interface Uploading { key: string; name: string; progress: number; error?: string }

interface Props {
  accounts: SocialAccountDto[];
  /** Editing an existing post; omit for a new one. */
  post?: SocialPostDto | null;
  onDone: (message: string) => void;
  onCancel?: () => void;
}

const Composer: React.FC<Props> = ({ accounts, post, onDone, onCancel }) => {
  const { homeTz } = useTeamTime();
  const initialWhen = post?.scheduledAt ? wallClockIn(homeTz, post.scheduledAt) : null;

  const [caption, setCaption] = useState(post?.caption ?? '');
  const [platforms, setPlatforms] = useState<SocialPlatform[]>((post?.platforms as SocialPlatform[]) ?? ['instagram', 'facebook']);
  const [media, setMedia] = useState<SocialMediaDto[]>(post?.media ?? []);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [asap, setAsap] = useState(!post?.scheduledAt && !!post);
  const [date, setDate] = useState(initialWhen?.date ?? '');
  const [time, setTime] = useState(initialWhen?.time ?? '17:00');
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const connected = (p: SocialPlatform) => accounts.some((a) => a.platform === p);
  const errors = useMemo(
    () => validatePost({ caption, platforms, media: media.map((m) => ({ ...m, bytes: m.bytes })) }),
    [caption, platforms, media],
  );
  const scheduledAt = (): string | null => {
    if (asap || !date) return null;
    return pacificDateTime(date, time || '00:00', homeTz).toISOString();
  };
  const scheduleError = (() => {
    const when = scheduledAt();
    if (!asap && !date) return 'Pick a date, or choose "As soon as it’s approved".';
    if (when && new Date(when).getTime() < Date.now() + 5 * 60 * 1000) return 'Schedule it at least a few minutes from now.';
    return '';
  })();

  const togglePlatform = (p: SocialPlatform) =>
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setError('');
    setNotice('');
    const list = Array.from(files).slice(0, Math.max(0, LIMITS.maxItems - media.length));
    for (const file of list) {
      const key = `${file.name}-${Math.random()}`;
      setUploading((u) => [...u, { key, name: file.name, progress: 0 }]);
      try {
        let blob: Blob = file;
        let dims: { width?: number; height?: number; durationSec?: number } = {};
        let filename = file.name;
        if (file.type.startsWith('video/')) {
          if (file.size > LIMITS.videoMaxBytes) throw new Error(`Videos must be under ${LIMITS.videoMaxBytes / 1024 / 1024} MB.`);
          dims = await probeVideo(file);
        } else {
          const img = await prepareSocialImage(file);
          blob = img.blob;
          dims = { width: img.width, height: img.height };
          filename = filename.replace(/\.[^.]+$/, '') + '.jpg';
          if (img.cropped) setNotice('Some photos were center-cropped to fit Instagram’s 4:5–1.91:1 range. Check the preview.');
        }
        const uploaded = await api.social.upload(blob, { ...dims, filename }, (f) =>
          setUploading((u) => u.map((x) => (x.key === key ? { ...x, progress: f } : x))),
        );
        setMedia((m) => [...m, uploaded]);
        setUploading((u) => u.filter((x) => x.key !== key));
      } catch (e: any) {
        setUploading((u) => u.map((x) => (x.key === key ? { ...x, error: e?.message || 'Upload failed' } : x)));
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const move = (i: number, d: -1 | 1) =>
    setMedia((m) => {
      const next = [...m];
      const j = i + d;
      if (j < 0 || j >= next.length) return m;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async (submit: boolean) => {
    setError('');
    if (submit && (errors.length || scheduleError)) { setError('Fix the items above before submitting.'); return; }
    setSaving(submit ? 'submit' : 'draft');
    const body = { caption, platforms, mediaIds: media.map((m) => m.id), scheduledAt: scheduledAt(), submit };
    try {
      if (post) await api.social.update(post.id, body);
      else await api.social.create(body);
      onDone(submit ? 'Submitted for a coach to review.' : 'Draft saved.');
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setSaving(null);
    }
  };

  const igTags = countHashtags(caption);
  const editingApproved = post?.status === 'approved';
  const busy = uploading.some((u) => !u.error) || saving !== null;

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div className={`${card} p-5 sm:p-6 space-y-5`}>
        {post?.feedback && (
          <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-700 dark:text-orange-400 mb-1">Coach feedback{post.feedback.by ? ` · ${post.feedback.by}` : ''}</p>
            <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{post.feedback.comment}</p>
          </div>
        )}
        {editingApproved && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs font-bold flex gap-2">
            <AlertTriangle size={16} className="flex-shrink-0" /> This post is already approved. Saving changes takes it off the schedule until a coach approves it again.
          </div>
        )}

        {/* Where */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Post to</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {(['instagram', 'facebook'] as SocialPlatform[]).map((p) => {
              const on = platforms.includes(p);
              return (
                <button key={p} type="button" onClick={() => togglePlatform(p)} aria-pressed={on}
                  className={`px-3.5 py-2 rounded-xl border-2 text-xs font-black flex items-center gap-2 transition-all ${on ? 'border-teamColor bg-teamColor/10 text-teamColor' : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'}`}>
                  <PlatformIcon platform={p} size={15} /> {platformName(p)}
                  {on && <span className="text-[9px] font-bold opacity-70">· {describeShape(p, media)}</span>}
                </button>
              );
            })}
          </div>
          {platforms.filter((p) => !connected(p)).map((p) => (
            <p key={p} className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-2">{platformName(p)} isn’t connected yet — a coach needs to connect it before this can be approved.</p>
          ))}
        </div>

        {/* Media */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Photos &amp; video <span className="normal-case tracking-normal font-bold">({media.length}/{LIMITS.maxItems})</span></label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
            {media.map((m, i) => (
              <div key={m.id} className="relative aspect-square rounded-xl overflow-hidden group bg-slate-100 dark:bg-slate-700">
                {m.kind === 'video'
                  ? <video src={m.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                  : <img src={m.url} alt="" className="w-full h-full object-cover" />}
                {m.kind === 'video' && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold flex items-center gap-1"><Film size={9} />{m.durationSec ? `${m.durationSec}s` : ''}</span>}
                <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                <button type="button" onClick={() => setMedia(media.filter((x) => x.id !== m.id))} aria-label="Remove"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"><X size={13} /></button>
                {media.length > 1 && (
                  <div className="absolute bottom-1 right-1 flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier" className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30"><ChevronLeft size={13} /></button>
                    <button type="button" disabled={i === media.length - 1} onClick={() => move(i, 1)} aria-label="Move later" className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30"><ChevronRight size={13} /></button>
                  </div>
                )}
              </div>
            ))}
            {uploading.map((u) => (
              <div key={u.key} className="relative aspect-square rounded-xl bg-slate-100 dark:bg-slate-700 flex flex-col items-center justify-center p-2 text-center">
                {u.error ? (
                  <>
                    <AlertTriangle size={18} className="text-red-500" />
                    <p className="text-[10px] text-red-600 dark:text-red-400 font-bold mt-1 line-clamp-3">{u.error}</p>
                    <button type="button" onClick={() => setUploading((x) => x.filter((y) => y.key !== u.key))} className="text-[10px] font-black text-slate-500 underline mt-1">Dismiss</button>
                  </>
                ) : (
                  <>
                    <Loader2 size={18} className="animate-spin text-teamColor" />
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 mt-2 overflow-hidden"><div className="h-full bg-teamColor" style={{ width: `${Math.round(u.progress * 100)}%` }} /></div>
                  </>
                )}
              </div>
            ))}
            {media.length + uploading.length < LIMITS.maxItems && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-teamColor hover:text-teamColor flex flex-col items-center justify-center gap-1 transition-all">
                <ImagePlus size={22} />
                <span className="text-[10px] font-black uppercase tracking-widest">Add</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          {notice && <p className="text-[11px] text-sky-600 dark:text-sky-400 font-bold mt-2 flex items-center gap-1.5"><Crop size={12} /> {notice}</p>}
          <p className="text-[11px] text-slate-400 font-bold mt-2">Photos are resized and saved as JPEG. Videos: MP4 or MOV, up to {LIMITS.videoMaxBytes / 1024 / 1024} MB. One video by itself becomes a Reel on Instagram.</p>
        </div>

        {/* Caption */}
        <div>
          <label htmlFor="social-caption" className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Caption</label>
          <textarea id="social-caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={6}
            placeholder="What's happening? Tag sponsors, add #hashtags…" className={`${input} mt-2 font-medium resize-y`} />
          <div className="flex justify-end gap-3 text-[10px] font-black mt-1">
            {platforms.includes('instagram') && (
              <>
                <span className={igTags > LIMITS.igHashtags ? 'text-red-500' : 'text-slate-400'}>{igTags}/{LIMITS.igHashtags} hashtags</span>
                <span className={caption.length > LIMITS.igCaption ? 'text-red-500' : 'text-slate-400'}>{caption.length}/{LIMITS.igCaption}</span>
              </>
            )}
          </div>
        </div>

        {/* When */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">When</label>
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" onClick={() => setAsap(false)} aria-pressed={!asap}
              className={`px-3.5 py-2 rounded-xl border-2 text-xs font-black flex items-center gap-2 ${!asap ? 'border-teamColor bg-teamColor/10 text-teamColor' : 'border-slate-200 dark:border-slate-600 text-slate-500'}`}><Clock size={14} /> Schedule</button>
            <button type="button" onClick={() => setAsap(true)} aria-pressed={asap}
              className={`px-3.5 py-2 rounded-xl border-2 text-xs font-black ${asap ? 'border-teamColor bg-teamColor/10 text-teamColor' : 'border-slate-200 dark:border-slate-600 text-slate-500'}`}>As soon as it’s approved</button>
          </div>
          {!asap && (
            <div className="grid grid-cols-2 gap-2 mt-2 max-w-sm">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} aria-label="Date" />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} aria-label="Time" />
            </div>
          )}
          {!asap && <p className="text-[10px] text-slate-400 font-bold mt-1">Team time ({homeTz.replace('_', ' ')}). A coach still has to approve it before then.</p>}
        </div>

        {(errors.length > 0 || scheduleError) && (
          <ul className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs font-bold space-y-1">
            {[...errors, ...(scheduleError ? [scheduleError] : [])].map((e) => <li key={e} className="flex gap-2"><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />{e}</li>)}
          </ul>
        )}
        {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

        <div className="flex flex-wrap gap-2 justify-end pt-1">
          {onCancel && <button type="button" onClick={onCancel} className={btnGhost}>Cancel</button>}
          {(!post || post.status === 'draft' || post.status === 'changes_requested') && (
            <button type="button" onClick={() => save(false)} disabled={busy} className={btnGhost}>
              {saving === 'draft' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save draft
            </button>
          )}
          <button type="button" onClick={() => save(true)} disabled={busy || errors.length > 0 || !!scheduleError} className={btnPrimary}>
            {saving === 'submit' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {post?.status === 'submitted' ? 'Save changes' : editingApproved ? 'Save & resubmit' : 'Submit for review'}
          </button>
        </div>
      </div>

      <div className={`${card} p-5 h-fit lg:sticky lg:top-4`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">Preview</p>
        {platforms.length === 0
          ? <p className="text-xs text-slate-400 font-bold text-center py-10">Pick an account to preview.</p>
          : <PostPreview caption={caption} media={media} platforms={platforms} />}
      </div>
    </div>
  );
};

export default Composer;
