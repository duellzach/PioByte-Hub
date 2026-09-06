import React, { useEffect, useMemo, useState } from 'react';
import { X, Clock, Briefcase, Trophy, ListChecks, Loader2, Download, CalendarDays, Users } from 'lucide-react';
import { api } from '../services/api';
import type { ProductivityDeepDive } from '../types';
import { parseLocalDate } from '../utils/dates';
import { styleFor, HOUR_CATEGORIES } from './hourCategoryStyles';
import DateWindowPicker, { type DateWindow, describeWindow } from './DateWindowPicker';

/** A ledger day is a team-local calendar DATE, not an instant — render it
 *  with the local-noon trick rather than a timezone-converting formatter. */
const dayLabel = (date: string) =>
  parseLocalDate(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

const fmtDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

interface Props {
  userId: string;
  userName: string;
  /** Starting window — inherited from the summary table so the two agree. */
  window: DateWindow;
  onClose: () => void;
}

/**
 * One student's productivity for a date window: hours by category, when they
 * showed up, and — the part boards can't answer — every task they actually put
 * time into, whether or not they were the assignee. Minutes come from the task
 * segment ledger, so a session split across three tasks is attributed three
 * ways instead of collapsing onto whichever task happened to be last.
 */
const MemberProductivityModal: React.FC<Props> = ({ userId, userName, window: initialWindow, onClose }) => {
  const [window, setWindow] = useState<DateWindow>(initialWindow);
  const [data, setData] = useState<ProductivityDeepDive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'tasks' | 'sessions'>('tasks');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.productivity.user(parseInt(userId), window)
      .then(result => { if (!cancelled) setData(result); })
      .catch(e => { if (!cancelled) setError(e?.message || 'Could not load this member\'s productivity.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, window.start, window.end]);

  const categories = useMemo(
    () => HOUR_CATEGORIES
      .map(c => ({ category: c as string, minutes: data?.hours?.[c] || 0 }))
      .filter(c => c.minutes > 0),
    [data],
  );

  const peakDay = useMemo(
    () => (data?.byDay || []).reduce((max, d) => (d.minutes > (max?.minutes ?? 0) ? d : max), null as null | { date: string; minutes: number }),
    [data],
  );

  const exportCSV = () => {
    if (!data) return;
    const headers = ['Task', 'Board', 'Status', 'Role', 'Minutes', 'Hours', 'Stretches', 'Last Worked'];
    const rows = data.contributions.map(c => [
      c.title,
      c.projectName || 'General task',
      c.status || '—',
      c.isAssignee ? 'Assignee' : 'Contributor',
      c.minutes,
      (c.minutes / 60).toFixed(2),
      c.sessions,
      c.lastWorkedAt ? c.lastWorkedAt.slice(0, 10) : '',
    ]);
    const csv = [[`${userName} — ${describeWindow(window)}`], [], headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${userName.replace(/\s+/g, '_')}_productivity.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalMinutes = data?.hours?.total || 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl">

        <div className="flex items-start justify-between gap-3 p-5 border-b-2 border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-teamColor text-white flex items-center justify-center text-lg font-black flex-shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-teamColor uppercase tracking-widest">Productivity</p>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{userName}</h2>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{describeWindow(window)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-red-600 transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60">
          <DateWindowPicker value={window} onChange={setWindow} />
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-teamColor" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center py-16 px-6">
            <p className="text-center text-sm font-bold text-red-500">{error}</p>
          </div>
        ) : !data ? null : (
          <div className="flex-1 overflow-auto p-5 space-y-5">

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: 'Hours', value: fmtDuration(totalMinutes), icon: <Clock size={12} />, tone: 'text-green-600 dark:text-green-400' },
                { label: 'Sessions', value: String(data.sessions.length), icon: <CalendarDays size={12} />, tone: 'text-blue-600 dark:text-blue-400' },
                { label: 'Tasks Worked', value: String(data.contributions.length), icon: <Briefcase size={12} />, tone: 'text-amber-600 dark:text-amber-400' },
                { label: 'Completed', value: String(data.tasksCompleted.length), icon: <Trophy size={12} />, tone: 'text-teamColor' },
              ].map(stat => (
                <div key={stat.label} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <p className="flex items-center gap-1 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.icon} {stat.label}</p>
                  <p className={`text-lg font-black mt-0.5 ${stat.tone}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {categories.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">Hours by Category</p>
                <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-3">
                  {categories.map(({ category, minutes }) => (
                    <div
                      key={category}
                      className={`${styleFor(category).dot} rounded-full`}
                      style={{ width: `${(minutes / totalMinutes) * 100}%` }}
                      title={`${styleFor(category).label}: ${fmtDuration(minutes)}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(({ category, minutes }) => {
                    const s = styleFor(category);
                    return (
                      <span key={category} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold ${s.bg} ${s.text}`}>
                        {s.icon} {s.label} <span className="font-black">{fmtDuration(minutes)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {data.byDay.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-baseline justify-between mb-2.5">
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Days Attended</p>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    {data.byDay.length} day{data.byDay.length !== 1 ? 's' : ''}
                    {peakDay ? ` • best ${fmtDuration(peakDay.minutes)}` : ''}
                  </p>
                </div>
                {/* Capped width so a window with two or three days reads as a
                    bar chart rather than a couple of giant blocks. */}
                <div className="flex items-end gap-[3px] h-16 overflow-x-auto pb-0.5">
                  {data.byDay.map(day => (
                    <div
                      key={day.date}
                      className="flex-1 min-w-[6px] max-w-[28px] bg-teamColor/70 hover:bg-teamColor rounded-t transition-colors"
                      style={{ height: `${Math.max(6, (day.minutes / (peakDay?.minutes || 1)) * 100)}%` }}
                      title={`${day.date}: ${fmtDuration(day.minutes)}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setTab('tasks')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${tab === 'tasks' ? 'bg-teamColor text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}
                >
                  Tasks Contributed To ({data.contributions.length})
                </button>
                <button
                  onClick={() => setTab('sessions')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${tab === 'sessions' ? 'bg-teamColor text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}
                >
                  Sessions ({data.sessions.length})
                </button>
                {tab === 'tasks' && data.contributions.length > 0 && (
                  <button
                    onClick={exportCSV}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-700 transition-all"
                  >
                    <Download size={11} /> CSV
                  </button>
                )}
              </div>

              {tab === 'tasks' ? (
                data.contributions.length === 0 ? (
                  <p className="text-center text-slate-400 dark:text-slate-500 py-10 text-xs font-bold uppercase tracking-widest">
                    No task time recorded in this window
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.contributions.map(c => (
                      <div key={`${c.taskId ?? 'g'}-${c.generalTaskId ?? c.taskId}`} className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-700/40 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${c.taskId ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' : 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300'}`}>
                            {c.taskId ? <Briefcase size={13} /> : <ListChecks size={13} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{c.title}</p>
                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate">
                              {c.projectName || 'General task'}
                              {c.status ? ` • ${c.status}` : ''}
                              {` • ${c.sessions} stretch${c.sessions !== 1 ? 'es' : ''}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-wider ${c.isAssignee ? 'bg-teamColor/10 text-teamColor' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300'}`}>
                            {c.isAssignee ? 'Assignee' : 'Helper'}
                          </span>
                          <span className="text-xs font-black text-green-600 dark:text-green-400 whitespace-nowrap">{fmtDuration(c.minutes)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : data.sessions.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-slate-500 py-10 text-xs font-bold uppercase tracking-widest">
                  No sessions in this window
                </p>
              ) : (
                <div className="space-y-2">
                  {data.sessions.map(session => {
                    const s = styleFor(session.kind);
                    return (
                      <div key={session.id} className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-slate-700/40 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100">{dayLabel(session.date)}</p>
                          {session.taskTitle && (
                            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate">{session.taskTitle}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex items-center gap-1 text-[8px] font-black px-2 py-1 rounded uppercase ${s.bg} ${s.text}`}>{s.icon} {s.label}</span>
                          <span className="text-xs font-black text-green-600 dark:text-green-400 whitespace-nowrap">{fmtDuration(session.minutes)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {data.tasksActive.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Users size={11} /> Currently Assigned ({data.tasksActive.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.tasksActive.map(t => (
                    <span key={t.id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 max-w-full">
                      <span className="truncate">{t.title}</span>
                      <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">{t.status}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberProductivityModal;
