import React from 'react';
import type { SocialMediaDto } from '../../services/api';

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  submitted: { label: 'Waiting for review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  changes_requested: { label: 'Changes requested', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  approved: { label: 'Scheduled', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  publishing: { label: 'Publishing', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  published: { label: 'Published', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  partially_published: { label: 'Partly published', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  failed: { label: 'Failed', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  canceled: { label: 'Canceled', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
};

export const TARGET_LABEL: Record<string, string> = {
  queued: 'Scheduled',
  creating_container: 'Processing',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
  canceled: 'Canceled',
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const m = STATUS_META[status] || { label: status, cls: STATUS_META.draft.cls };
  return <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${m.cls}`}>{m.label}</span>;
};

/** Brand marks — lucide dropped its brand icons, so these are hand-drawn. */
export const InstagramIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);

export const FacebookIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
  </svg>
);

export const PlatformIcon: React.FC<{ platform: string; size?: number; className?: string }> = ({ platform, ...rest }) =>
  platform === 'instagram' ? <InstagramIcon {...rest} /> : <FacebookIcon {...rest} />;

export const platformName = (p: string) => (p === 'instagram' ? 'Instagram' : 'Facebook');

export const MediaThumb: React.FC<{ m: Pick<SocialMediaDto, 'kind' | 'url'>; className?: string }> = ({ m, className = '' }) =>
  m.kind === 'video'
    ? <video src={m.url} className={`object-cover bg-black ${className}`} muted playsInline preload="metadata" />
    : <img src={m.url} alt="" className={`object-cover bg-slate-100 dark:bg-slate-700 ${className}`} loading="lazy" />;

export const card = 'bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700';
export const input = 'w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-sm font-bold outline-none focus:border-teamColor dark:text-white';
export const btnPrimary = 'px-4 py-2.5 bg-teamColor text-white font-black rounded-xl hover:opacity-90 disabled:opacity-50 transition-all uppercase tracking-widest text-[11px] flex items-center justify-center gap-2';
export const btnGhost = 'px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-all uppercase tracking-widest text-[11px] flex items-center justify-center gap-2';
export const btnDanger = 'px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-black rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-all uppercase tracking-widest text-[11px] flex items-center justify-center gap-2';

/** YYYY-MM-DD and HH:MM for an instant, as seen in `tz`. */
export function wallClockIn(tz: string, iso: string | Date): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
