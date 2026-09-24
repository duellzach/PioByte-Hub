import React, { useEffect, useState } from 'react';
import { Target, DollarSign, Clock, ClipboardCheck, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { api } from '../services/api';
import { CategoryBadge } from './hourCategoryStyles';

export const fmtMoney = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
export const fmtHours = (mins: number) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};
export const pct = (a: number, b: number) => (b <= 0 ? (a > 0 ? 100 : 0) : Math.min(100, Math.round((a / b) * 100)));

export const Bar: React.FC<{ label: string; value: string; percent: number; done?: boolean }> = ({ label, value, percent, done }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide truncate">{label}</span>
      <span className={`text-[11px] font-black tabular-nums ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
        {value}{done ? ' ✓' : ''}
      </span>
    </div>
    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-teamColor'}`} style={{ width: `${percent}%` }} />
    </div>
  </div>
);

const RequirementsCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [data, setData] = useState<any | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Checklist starts collapsed; the choice is remembered per browser.
  const [checklistOpen, setChecklistOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('reqChecklistOpen') === '1'; } catch { return false; }
  });
  const toggleChecklist = () => {
    setChecklistOpen(open => {
      try { localStorage.setItem('reqChecklistOpen', open ? '0' : '1'); } catch {}
      return !open;
    });
  };

  useEffect(() => {
    api.requirements.mine().then(setData).catch(() => setData(null)).finally(() => setLoaded(true));
  }, []);

  if (!loaded || !data) return null;
  // Class Members who aren't on the club have no requirements — no card.
  if (data.track === 'none') return null;
  const fundraisingOn = data.fundraising?.enabled;
  const hourReqs = (data.hours || []).filter((h: any) => (h.phases || []).length > 0);
  const checklist: any[] = data.checklist || [];
  if (!fundraisingOn && hourReqs.length === 0 && checklist.length === 0) return null; // nothing configured → hide

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl md:rounded-[28px] border-2 border-slate-100 dark:border-slate-700 p-5 flex flex-col gap-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-teamColor/10 text-teamColor rounded-xl flex items-center justify-center"><Target size={18} /></div>
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">My Requirements</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{data.track === 'mentor' ? 'Coach & mentor requirements' : 'Your season progress'}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto kanban-scroll space-y-3.5 -mr-1 pr-1">
        {checklist.length > 0 && (
          <div className="space-y-1.5">
            <button
              onClick={toggleChecklist}
              aria-expanded={checklistOpen}
              className="w-full flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-teamColor transition-colors"
            >
              <ClipboardCheck size={11} /> Checklist
              <span className={`ml-auto tabular-nums ${checklist.every(c => c.completed) ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                {checklist.filter(c => c.completed).length}/{checklist.length}
              </span>
              <ChevronDown size={12} className={`transition-transform ${checklistOpen ? 'rotate-180' : ''}`} />
            </button>
            {/* Read-only: only a coach can tick these off. */}
            {checklistOpen && checklist.map((c: any) => (
              <div key={c.id} className="flex items-start gap-2" title={c.completed ? 'Completed' : 'A coach will check this off once done'}>
                {c.completed
                  ? <CheckSquare size={15} className="text-emerald-500 shrink-0 mt-px" />
                  : <Square size={15} className="text-slate-300 dark:text-slate-600 shrink-0 mt-px" />}
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${c.completed ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{c.label}</p>
                  {c.description && <p className="text-[10px] text-slate-400 dark:text-slate-500">{c.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {fundraisingOn && (() => {
          const f = data.fundraising;
          const p = pct(f.raisedCents, f.goalCents);
          const done = f.goalCents > 0 && f.raisedCents >= f.goalCents;
          return (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest"><DollarSign size={11} /> Fundraising</div>
              <Bar
                label="Raised"
                value={`${fmtMoney(f.raisedCents)} of ${fmtMoney(f.goalCents)}`}
                percent={p}
                done={done}
              />
              {f.pendingCents > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">+{fmtMoney(f.pendingCents)} pending verification</p>
              )}
            </div>
          );
        })()}

        {hourReqs.map((h: any) => {
          // Only show per-bar area badges when phases actually differ — a
          // uniform requirement (the common case) doesn't need the extra noise.
          const mixed = new Set(h.phases.map((p: any) => (p.categories || []).join(','))).size > 1;
          return (
            <div key={h.key} className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest"><Clock size={11} /> {h.label}</div>
              {h.combinePhases && h.combined ? (
                <Bar
                  label="Logged"
                  value={`${fmtHours(h.combined.earnedMinutes)} of ${fmtHours(h.combined.requiredMinutes)}`}
                  percent={pct(h.combined.earnedMinutes, h.combined.requiredMinutes)}
                  done={h.combined.requiredMinutes > 0 && h.combined.earnedMinutes >= h.combined.requiredMinutes}
                />
              ) : (
                h.phases.map((ph: any, i: number) => {
                  const done = ph.requiredMinutes > 0 && ph.earnedMinutes >= ph.requiredMinutes;
                  return (
                    <div key={i} className="space-y-1">
                      <Bar
                        label={h.phases.length > 1 ? ph.label : 'Logged'}
                        value={`${fmtHours(ph.earnedMinutes)} of ${fmtHours(ph.requiredMinutes)}`}
                        percent={pct(ph.earnedMinutes, ph.requiredMinutes)}
                        done={done}
                      />
                      {mixed && (ph.categories || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {ph.categories.map((c: string) => <CategoryBadge key={c} category={c} />)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RequirementsCard;
