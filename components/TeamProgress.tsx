import React, { useEffect, useMemo, useState } from 'react';
import { Target, Loader2, CheckSquare, Square, BarChart2 } from 'lucide-react';
import { api } from '../services/api';
import { fmtHours, fmtMoney, pct } from './RequirementsCard';

interface Props {
  /** Only Coaches may tick checklist items; everyone else sees them read-only. */
  isCoach: boolean;
  onOpenStudent: (userId: number, name: string) => void;
}

interface Goal {
  key: string;
  label: string;
  kind: 'hours' | 'fundraising' | 'checklist';
  done: boolean;
  percent: number;
  detail: string;
  itemId?: number;
}

/**
 * Flatten one student's /requirements payload into a list of goals. Only goals
 * with a real target count — a phase with 0 required minutes isn't a goal.
 */
function goalsOf(r: any): Goal[] {
  const goals: Goal[] = [];
  for (const h of r.hours || []) {
    if (h.combinePhases && h.combined) {
      if (h.combined.requiredMinutes > 0) {
        goals.push({
          key: `h:${h.key}`,
          label: h.label,
          kind: 'hours',
          done: h.combined.earnedMinutes >= h.combined.requiredMinutes,
          percent: pct(h.combined.earnedMinutes, h.combined.requiredMinutes),
          detail: `${fmtHours(h.combined.earnedMinutes)} / ${fmtHours(h.combined.requiredMinutes)}`,
        });
      }
    } else {
      for (const ph of h.phases || []) {
        if (!(ph.requiredMinutes > 0)) continue;
        goals.push({
          key: `h:${h.key}:${ph.label}`,
          label: (h.phases || []).length > 1 ? `${h.label} · ${ph.label}` : h.label,
          kind: 'hours',
          done: ph.earnedMinutes >= ph.requiredMinutes,
          percent: pct(ph.earnedMinutes, ph.requiredMinutes),
          detail: `${fmtHours(ph.earnedMinutes)} / ${fmtHours(ph.requiredMinutes)}`,
        });
      }
    }
  }
  const f = r.fundraising;
  if (f?.enabled && f.goalCents > 0) {
    goals.push({
      key: 'fundraising',
      label: 'Fundraising',
      kind: 'fundraising',
      done: f.raisedCents >= f.goalCents,
      percent: pct(f.raisedCents, f.goalCents),
      detail: `${fmtMoney(f.raisedCents)} / ${fmtMoney(f.goalCents)}`,
    });
  }
  for (const c of r.checklist || []) {
    goals.push({
      key: `c:${c.id}`,
      label: c.label,
      kind: 'checklist',
      done: !!c.completed,
      percent: c.completed ? 100 : 0,
      detail: c.completed ? 'Done' : 'Not done',
      itemId: c.id,
    });
  }
  return goals;
}

/**
 * Every student's progress toward the requirements for being on the team:
 * hour goals, fundraising, and the coach-ticked membership checklist.
 */
const TeamProgress: React.FC<Props> = ({ isCoach, onOpenStudent }) => {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [sort, setSort] = useState<'name' | 'remaining'>('name');
  const [saving, setSaving] = useState<string | null>(null);
  // Students and Coaches/Mentors have different requirements, so different columns.
  const [track, setTrack] = useState<'member' | 'mentor'>('member');

  useEffect(() => {
    api.requirements.team()
      .then(setRows)
      .catch(e => { setRows([]); setError(e?.message || 'Could not load team progress'); });
  }, []);

  const table = useMemo(() => {
    const withGoals = (rows || []).filter(r => (r.track || 'member') === track).map(r => {
      const goals = goalsOf(r.requirements);
      return { ...r, goals, remaining: goals.filter(g => !g.done).length };
    });
    const filtered = onlyIncomplete ? withGoals.filter(r => r.remaining > 0) : withGoals;
    return [...filtered].sort((a, b) =>
      sort === 'remaining' ? b.remaining - a.remaining || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
  }, [rows, onlyIncomplete, sort, track]);

  // Column set comes from the union across students (per-student overrides
  // can change a target, but not which goals exist).
  const columns = useMemo(() => {
    const seen = new Map<string, { key: string; label: string; kind: Goal['kind'] }>();
    for (const r of table) for (const g of r.goals) if (!seen.has(g.key)) seen.set(g.key, { key: g.key, label: g.label, kind: g.kind });
    return [...seen.values()];
  }, [table]);

  const toggle = async (userId: number, goal: Goal) => {
    if (!isCoach || goal.itemId === undefined) return;
    const id = `${userId}:${goal.itemId}`;
    setSaving(id);
    setError('');
    try {
      await api.requirements.setChecklist(userId, goal.itemId, !goal.done);
      setRows(prev => (prev || []).map(r => r.userId !== userId ? r : {
        ...r,
        requirements: {
          ...r.requirements,
          checklist: (r.requirements.checklist || []).map((c: any) => c.id === goal.itemId ? { ...c, completed: !goal.done } : c),
        },
      }));
    } catch (e: any) {
      setError(e?.message || 'Could not update checklist');
    } finally {
      setSaving(null);
    }
  };

  const eligibleCount = table.filter(r => r.remaining === 0).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b-2 border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3 min-w-0">
          <Target size={16} className="text-teamColor flex-shrink-0" />
          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Requirement Progress</span>
          {rows && (
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">
              {eligibleCount}/{table.length} complete
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
            {([['member', 'Students'], ['mentor', 'Coaches & Mentors']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTrack(key)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${track === key ? 'bg-white dark:bg-slate-800 text-teamColor shadow-sm' : 'text-slate-500 dark:text-slate-300'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer">
            <input type="checkbox" checked={onlyIncomplete} onChange={e => setOnlyIncomplete(e.target.checked)} className="accent-teamColor" />
            Not yet complete
          </label>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as any)}
            className="px-2 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-black uppercase text-slate-600 dark:text-slate-200 outline-none"
          >
            <option value="name">Sort: Name</option>
            <option value="remaining">Sort: Most remaining</option>
          </select>
        </div>
      </div>

      {error && <p className="px-5 pt-3 text-xs font-bold text-red-500">{error}</p>}

      {!rows ? (
        <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-teamColor" /></div>
      ) : columns.length === 0 ? (
        <p className="text-center text-slate-400 dark:text-slate-500 py-10 text-xs font-bold uppercase tracking-widest px-4">
          No requirements configured — set them up in Control Panel → Requirements / Membership Checklist
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60">
                <th className="px-4 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">{track === 'member' ? 'Student' : 'Name'}</th>
                <th className="px-3 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                {columns.map(c => (
                  <th key={c.key} className={`px-3 py-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap ${c.kind === 'checklist' ? 'text-center' : ''}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map(r => (
                <tr key={r.userId} className="border-b border-slate-50 dark:border-slate-700/60 hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-slate-800 z-10">
                    <button onClick={() => onOpenStudent(r.userId, r.name)} className="flex items-center gap-1.5 font-black text-slate-800 dark:text-slate-100 hover:text-teamColor whitespace-nowrap" title="Open performance view">
                      {r.name} <BarChart2 size={11} className="opacity-50" />
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase whitespace-nowrap ${r.remaining === 0 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}>
                      {r.remaining === 0 ? 'Complete ✓' : `${r.remaining} remaining`}
                    </span>
                  </td>
                  {columns.map(c => {
                    const g: Goal | undefined = r.goals.find((x: Goal) => x.key === c.key);
                    if (!g) return <td key={c.key} className="px-3 py-2.5 text-slate-300">—</td>;
                    if (g.kind === 'checklist') {
                      const busy = saving === `${r.userId}:${g.itemId}`;
                      return (
                        <td key={c.key} className="px-3 py-2.5 text-center">
                          <button
                            disabled={!isCoach || busy}
                            onClick={() => toggle(r.userId, g)}
                            title={isCoach ? (g.done ? 'Mark not done' : 'Mark done') : 'Only Coaches can change this'}
                            className={`inline-flex ${isCoach ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
                          >
                            {busy ? <Loader2 size={16} className="animate-spin text-teamColor" />
                              : g.done ? <CheckSquare size={16} className="text-emerald-500" />
                              : <Square size={16} className="text-slate-300 dark:text-slate-600" />}
                          </button>
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className="px-3 py-2.5 min-w-[120px]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-[10px] font-black tabular-nums whitespace-nowrap ${g.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>{g.detail}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div className={`h-full rounded-full ${g.done ? 'bg-emerald-500' : 'bg-teamColor'}`} style={{ width: `${g.percent}%` }} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TeamProgress;
