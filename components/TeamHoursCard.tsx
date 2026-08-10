import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { HOUR_CATEGORIES, HOUR_CATEGORY_LABELS, styleFor } from './hourCategoryStyles';

interface TimeEntryLike {
  status: string;
  roundedMinutes?: number | null;
  kind?: string | null;
}

const fmtHours = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/**
 * Team-wide hours counter, broken down by category (shop/competition/meeting/
 * volunteer/outreach/other). Visible to everyone on the homepage — it reads
 * from the already-loaded time_entries in app state, so it needs no extra
 * fetch and no role gating.
 */
const TeamHoursCard: React.FC<{ timeEntries: TimeEntryLike[]; className?: string }> = ({ timeEntries, className = '' }) => {
  const { totalMinutes, byCategory } = useMemo(() => {
    const minutesByCategory: Record<string, number> = {};
    let total = 0;
    for (const e of timeEntries) {
      if (e.status !== 'completed' || !e.roundedMinutes) continue;
      const category = e.kind || 'shop';
      minutesByCategory[category] = (minutesByCategory[category] || 0) + e.roundedMinutes;
      total += e.roundedMinutes;
    }
    return { totalMinutes: total, byCategory: minutesByCategory };
  }, [timeEntries]);

  const rows = HOUR_CATEGORIES
    .map((cat) => ({ cat, minutes: byCategory[cat] || 0 }))
    .filter((r) => r.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl md:rounded-[28px] border-2 border-slate-100 dark:border-slate-700 p-5 space-y-3.5 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-teamColor/10 text-teamColor rounded-xl flex items-center justify-center"><Clock size={18} /></div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Team Hours</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">All confirmed time, by category</p>
        </div>
        <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums flex-shrink-0">{fmtHours(totalMinutes)}</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold italic">No confirmed hours logged yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(({ cat, minutes }) => {
            const style = styleFor(cat);
            const percent = totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0;
            return (
              <div key={cat} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide ${style.text}`}>
                    {style.icon} {HOUR_CATEGORY_LABELS[cat]}
                  </span>
                  <span className="text-[11px] font-black tabular-nums text-slate-500 dark:text-slate-400">{fmtHours(minutes)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className={`h-full rounded-full ${style.dot}`} style={{ width: `${Math.max(percent, minutes > 0 ? 2 : 0)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamHoursCard;
