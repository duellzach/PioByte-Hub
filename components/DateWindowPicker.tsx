import React, { useMemo } from 'react';
import { CalendarRange } from 'lucide-react';
import { localDatePT, teamYearRange } from '../utils/dates';
import { useTeamSettings } from '../contexts/TeamSettingsContext';

/**
 * An inclusive team-local date window. Both bounds are `YYYY-MM-DD` or null
 * ("unbounded on that side"), matching the wire format every windowed endpoint
 * takes — see `server/routes/productivity.ts`.
 */
export interface DateWindow {
  start: string | null;
  end: string | null;
  /** Which preset produced this window; 'custom' once either date is hand-edited. */
  preset: PresetKey;
}

export type PresetKey = 'week' | 'month' | 'quarter' | 'season' | 'all' | 'custom';

const PRESETS: { key: PresetKey; label: string; days?: number }[] = [
  { key: 'week', label: '7 Days', days: 7 },
  { key: 'month', label: '30 Days', days: 30 },
  { key: 'quarter', label: '90 Days', days: 90 },
  { key: 'season', label: 'Season' },
  { key: 'all', label: 'All Time' },
];

/** Shift a `YYYY-MM-DD` by whole days without tripping over timezones. */
function shiftDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Resolve a preset into concrete bounds. "Season" is the team year (July 1 –
 * June 30) already used by the Home hours card, so the two agree.
 */
export function windowForPreset(preset: PresetKey, tz: string): DateWindow {
  const today = localDatePT(new Date(), tz);
  switch (preset) {
    case 'season': {
      const { start, end } = teamYearRange(new Date(), tz);
      return { start, end, preset };
    }
    case 'all':
      return { start: null, end: null, preset };
    case 'custom':
      return { start: null, end: null, preset };
    default: {
      const days = PRESETS.find(p => p.key === preset)?.days ?? 7;
      // Inclusive of today, so "7 Days" is today plus the six before it.
      return { start: shiftDays(today, -(days - 1)), end: today, preset };
    }
  }
}

/** The default window everywhere: the current season, not all of history. */
export const defaultWindow = (tz: string): DateWindow => windowForPreset('season', tz);

/** Human-readable window, for headings and CSV export notes. */
export function describeWindow(w: DateWindow): string {
  if (!w.start && !w.end) return 'All time';
  if (w.start && !w.end) return `Since ${w.start}`;
  if (!w.start && w.end) return `Through ${w.end}`;
  return `${w.start} → ${w.end}`;
}

interface Props {
  value: DateWindow;
  onChange: (w: DateWindow) => void;
  /** Rendered to the right of the controls — e.g. an export button. */
  children?: React.ReactNode;
}

const DateWindowPicker: React.FC<Props> = ({ value, onChange, children }) => {
  const { settings } = useTeamSettings();
  const tz = settings.timezone || 'America/Los_Angeles';
  const today = useMemo(() => localDatePT(new Date(), tz), [tz]);

  const setCustom = (patch: Partial<Pick<DateWindow, 'start' | 'end'>>) =>
    onChange({ start: value.start, end: value.end, ...patch, preset: 'custom' });

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        <CalendarRange size={13} className="text-slate-400 flex-shrink-0" />
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => onChange(windowForPreset(p.key, tz))}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              value.preset === p.key
                ? 'bg-teamColor text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className={`flex items-center gap-1 pl-1.5 ml-0.5 border-l-2 ${value.preset === 'custom' ? 'border-teamColor' : 'border-slate-200 dark:border-slate-600'}`}>
          <input
            type="date"
            value={value.start || ''}
            max={value.end || today}
            onChange={e => setCustom({ start: e.target.value || null })}
            aria-label="Window start date"
            className="px-2 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-200 outline-none focus:border-teamColor"
          />
          <span className="text-[10px] font-black text-slate-300 dark:text-slate-500">→</span>
          <input
            type="date"
            value={value.end || ''}
            min={value.start || undefined}
            onChange={e => setCustom({ end: e.target.value || null })}
            aria-label="Window end date"
            className="px-2 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-200 outline-none focus:border-teamColor"
          />
        </div>
      </div>
      {children}
    </div>
  );
};

export default DateWindowPicker;
