import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, List, CalendarDays } from 'lucide-react';
import type { SocialPostDto } from '../../services/api';
import { useTeamTime } from '../../utils/timeFormat';
import PostCard from './PostCard';
import { PlatformIcon, STATUS_META, card, wallClockIn } from './common';

interface Props {
  posts: SocialPostDto[];
  isCoach: boolean;
  currentUserId: number;
  onChanged: (message?: string) => void;
}

const DOT: Record<string, string> = {
  approved: 'bg-sky-500',
  publishing: 'bg-indigo-500',
  published: 'bg-emerald-500',
  partially_published: 'bg-amber-500',
  failed: 'bg-red-500',
};

/** Scheduled and published posts, by day in the team's timezone. */
const SocialCalendar: React.FC<Props> = ({ posts, isCoach, currentUserId, onChanged }) => {
  const { homeTz, fmtTime } = useTeamTime();
  const [mode, setMode] = useState<'month' | 'list'>('month');
  const today = wallClockIn(homeTz, new Date()).date;
  const [month, setMonth] = useState(today.slice(0, 7)); // YYYY-MM
  const [selected, setSelected] = useState<string | null>(null);

  // When it went out (or will): the schedule, else the first publish, else approval.
  const whenOf = (p: SocialPostDto) =>
    p.scheduledAt || p.targets.map((t) => t.publishedAt).filter(Boolean).sort()[0] || p.approvedAt || p.updatedAt;
  const dayOf = (p: SocialPostDto) => wallClockIn(homeTz, whenOf(p)!).date;
  const byDay = useMemo(() => {
    const m = new Map<string, SocialPostDto[]>();
    for (const p of posts) {
      const d = dayOf(p);
      m.set(d, [...(m.get(d) || []), p]);
    }
    for (const list of m.values()) list.sort((a, b) => String(whenOf(a)).localeCompare(String(whenOf(b))));
    return m;
  }, [posts, homeTz]);

  const [y, mo] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  const shift = (d: number) => {
    const n = new Date(Date.UTC(y, mo - 1 + d, 1));
    setMonth(`${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`);
    setSelected(null);
  };

  const upcoming = [...posts]
    .filter((p) => mode === 'list')
    .sort((a, b) => String(whenOf(a)).localeCompare(String(whenOf(b))));
  const selectedPosts = selected ? byDay.get(selected) || [] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {mode === 'month' ? (
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" aria-label="Previous month"><ChevronLeft size={16} /></button>
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white min-w-[9rem] text-center">
              {first.toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </h2>
            <button onClick={() => shift(1)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
        ) : <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">All scheduled &amp; published</h2>}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
          <button onClick={() => setMode('month')} aria-pressed={mode === 'month'} className={`p-1.5 rounded-lg ${mode === 'month' ? 'bg-white dark:bg-slate-800 text-teamColor shadow-sm' : 'text-slate-500'}`} aria-label="Month view"><CalendarDays size={15} /></button>
          <button onClick={() => setMode('list')} aria-pressed={mode === 'list'} className={`p-1.5 rounded-lg ${mode === 'list' ? 'bg-white dark:bg-slate-800 text-teamColor shadow-sm' : 'text-slate-500'}`} aria-label="List view"><List size={15} /></button>
        </div>
      </div>

      {mode === 'month' && (
        <>
          <div className={`${card} p-2 sm:p-3`}>
            <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={`x${i}`} />;
                const list = byDay.get(d) || [];
                const isSel = d === selected;
                return (
                  <button key={d} onClick={() => setSelected(isSel ? null : d)}
                    className={`min-h-[3.5rem] sm:min-h-[5.5rem] rounded-xl p-1 sm:p-1.5 text-left flex flex-col gap-0.5 border-2 transition-all ${isSel ? 'border-teamColor' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50'} ${d === today ? 'bg-teamColor/5' : ''}`}>
                    <span className={`text-[11px] font-black ${d === today ? 'text-teamColor' : 'text-slate-500 dark:text-slate-400'}`}>{Number(d.slice(8))}</span>
                    <span className="sm:hidden flex flex-wrap gap-0.5">{list.map((p) => <span key={p.id} className={`w-1.5 h-1.5 rounded-full ${DOT[p.status] || 'bg-slate-400'}`} />)}</span>
                    <span className="hidden sm:flex flex-col gap-0.5 w-full">
                      {list.slice(0, 3).map((p) => (
                        <span key={p.id} className="flex items-center gap-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT[p.status] || 'bg-slate-400'}`} />
                          {fmtTime(whenOf(p)!, { hour: 'numeric', minute: '2-digit' })}
                          {p.platforms.map((pl) => <PlatformIcon key={pl} platform={pl} size={9} />)}
                        </span>
                      ))}
                      {list.length > 3 && <span className="text-[10px] font-bold text-slate-400">+{list.length - 3} more</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {Object.entries(DOT).map(([s, c]) => <span key={s} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${c}`} />{STATUS_META[s]?.label}</span>)}
          </div>
          {selected && (
            <div className="space-y-3">
              {selectedPosts.length === 0
                ? <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-widest py-4">Nothing on this day</p>
                : selectedPosts.map((p) => <PostCard key={p.id} post={p} context="calendar" isCoach={isCoach} currentUserId={currentUserId} onChanged={onChanged} />)}
            </div>
          )}
        </>
      )}

      {mode === 'list' && (
        <div className="space-y-3">
          {upcoming.length === 0
            ? <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-widest py-8">Nothing scheduled yet</p>
            : upcoming.map((p) => <PostCard key={p.id} post={p} context="calendar" isCoach={isCoach} currentUserId={currentUserId} onChanged={onChanged} />)}
        </div>
      )}
    </div>
  );
};

export default SocialCalendar;
