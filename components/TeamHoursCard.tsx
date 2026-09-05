import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { HOUR_CATEGORIES, HOUR_CATEGORY_LABELS, styleFor } from './hourCategoryStyles';
import { api } from '../services/api';
import { teamYearRange, formatLocalDate } from '../utils/dates';
import { useTeamSettings } from '../contexts/TeamSettingsContext';

const fmtHours = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/**
 * Team-wide hours counter, broken down by category (shop/competition/meeting/
 * volunteer/outreach/other/class/fundraising). Visible to everyone on the
 * homepage. Scoped to the current team year (July 1 – June 30, resetting each
 * year) and backed by the server-side hours ledger, so it agrees with every
 * other total in the app — including competition hours.
 */
const TeamHoursCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { settings } = useTeamSettings();
  const [totals, setTotals] = useState<(Record<string, number> & { total: number }) | null>(null);
  const range = teamYearRange(new Date(), settings.timezone);

  useEffect(() => {
    let cancelled = false;
    api.hours.teamTotals(range).then((t) => { if (!cancelled) setTotals(t); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  const totalMinutes = totals?.total || 0;
  const rows = HOUR_CATEGORIES
    .map((cat) => ({ cat, minutes: totals?.[cat] || 0 }))
    .filter((r) => r.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl md:rounded-[28px] border-2 border-slate-100 dark:border-slate-700 p-5 flex flex-col gap-3.5 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-teamColor/10 text-teamColor rounded-xl flex items-center justify-center"><Clock size={18} /></div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Team Hours</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
            {formatLocalDate(range.start, { month: 'short', year: 'numeric' })} – {formatLocalDate(range.end, { month: 'short', year: 'numeric' })}
          </p>
        </div>
        <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums flex-shrink-0">{fmtHours(totalMinutes)}</span>
      </div>

      {!totals ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold italic">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold italic">No confirmed hours logged yet.</p>
      ) : (
        <div className="flex-1 flex flex-col justify-evenly gap-2">
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
