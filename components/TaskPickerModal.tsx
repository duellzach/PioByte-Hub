import React, { useMemo, useState } from 'react';
import { X, Search, Briefcase, Users, ListChecks, CheckSquare, Square, Loader2, Check, Ban } from 'lucide-react';
import type { AvailableTask, GeneralTask } from '../types';
import { PRIORITY_COLORS } from '../constants';

interface Props {
  title: string;
  subtitle?: string;
  loading: boolean;
  assignedTasks: AvailableTask[];
  openTasks: AvailableTask[];
  generalTasks: GeneralTask[];
  /** Currently selected board task / general task, so a re-open shows the truth. */
  selectedTaskId: number | null;
  selectedGeneralTaskId: number | null;
  /** Label for the confirm button, e.g. "Start Working" or "Move Them". */
  confirmLabel: string;
  /** Shown as the dismiss action — "Skip" at check-in, "Cancel" mid-session. */
  dismissLabel: string;
  /** Offer "clear the task" — meaningful mid-session, not at first pick. */
  allowClear?: boolean;
  onDismiss: () => void;
  onConfirm: (taskId: number | null, generalTaskId: number | null) => void;
}

/**
 * The one "what are you working on?" chooser, shared by every flow that sets a
 * live session's task: the check-in prompt, a member switching mid-session, and
 * leadership moving someone onto different work.
 *
 * Assigned tasks lead, but the open list is deliberately just as reachable —
 * helping on a task you don't lead is normal, and the picker shouldn't imply
 * otherwise. The board name rides along on every row because two boards
 * routinely carry tasks with near-identical titles.
 */
const TaskPickerModal: React.FC<Props> = ({
  title, subtitle, loading, assignedTasks, openTasks, generalTasks,
  selectedTaskId, selectedGeneralTaskId, confirmLabel, dismissLabel,
  allowClear = false, onDismiss, onConfirm,
}) => {
  const [taskId, setTaskId] = useState<number | null>(selectedTaskId);
  const [generalTaskId, setGeneralTaskId] = useState<number | null>(selectedGeneralTaskId);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = (haystack: string[]) => !q || haystack.some(h => (h || '').toLowerCase().includes(q));

  const filtered = useMemo(() => ({
    assigned: assignedTasks.filter(t => matches([t.title, t.projectName])),
    open: openTasks.filter(t => matches([t.title, t.projectName])),
    general: generalTasks.filter(g => matches([g.name, g.description || ''])),
  }), [assignedTasks, openTasks, generalTasks, q]);

  const empty = filtered.assigned.length === 0 && filtered.open.length === 0 && filtered.general.length === 0;
  const hasAnything = assignedTasks.length > 0 || openTasks.length > 0 || generalTasks.length > 0;

  const pickTask = (id: number) => {
    setTaskId(taskId === id ? null : id);
    setGeneralTaskId(null);
  };
  const pickGeneral = (id: number) => {
    setGeneralTaskId(generalTaskId === id ? null : id);
    setTaskId(null);
  };

  const TaskRow = ({ task, tone }: { task: AvailableTask; tone: 'blue' | 'orange' }) => {
    const selected = taskId === task.id;
    const ring = tone === 'blue'
      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
      : 'border-orange-500 bg-orange-50 dark:bg-orange-900/30';
    const hover = tone === 'blue'
      ? 'hover:border-blue-300 dark:hover:border-blue-700'
      : 'hover:border-orange-300 dark:hover:border-orange-700';
    return (
      <button
        onClick={() => pickTask(task.id)}
        aria-pressed={selected}
        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
          selected ? ring : `border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700 ${hover} hover:shadow-sm`
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-slate-900 dark:text-white leading-tight line-clamp-2">{task.title}</p>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {task.projectName} • {task.status}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] ?? 'bg-slate-100 text-slate-600'}`}>
              {task.priority}
            </span>
            {task.effort ? <span className="text-[7px] font-black text-slate-400 dark:text-slate-500">{task.effort}pt</span> : null}
          </div>
        </div>
        {selected && (
          <div className={`mt-1.5 flex items-center gap-1 ${tone === 'blue' ? 'text-blue-600' : 'text-orange-600'}`}>
            <CheckSquare size={11} />
            <span className="text-[9px] font-black uppercase">Selected</span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[88vh] flex flex-col">
        <div className="flex justify-between items-start gap-3 p-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h2>
            {subtitle && <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button onClick={onDismiss} aria-label="Close" className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-500 hover:text-red-600 transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {hasAnything && !loading && (
          <div className="px-5 pb-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search tasks or boards..."
                aria-label="Search tasks"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor dark:text-white font-bold text-xs"
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-teamColor" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto px-5 space-y-4">
            {filtered.assigned.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Briefcase size={10} /> Assigned ({filtered.assigned.length})
                </p>
                <div className="space-y-2">
                  {filtered.assigned.map(task => <TaskRow key={task.id} task={task} tone="blue" />)}
                </div>
              </div>
            )}

            {filtered.open.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Users size={10} /> Open to Help On ({filtered.open.length})
                </p>
                <div className="space-y-2">
                  {filtered.open.map(task => <TaskRow key={task.id} task={task} tone="orange" />)}
                </div>
              </div>
            )}

            {filtered.general.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <ListChecks size={10} /> General Tasks ({filtered.general.length})
                </p>
                <div className="space-y-2">
                  {filtered.general.map(gt => (
                    <button
                      key={gt.id}
                      onClick={() => pickGeneral(gt.id)}
                      aria-pressed={generalTaskId === gt.id}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3 ${
                        generalTaskId === gt.id
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30'
                          : 'border-slate-100 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700'
                      }`}
                    >
                      {generalTaskId === gt.id
                        ? <CheckSquare size={16} className="text-violet-600 shrink-0 mt-0.5" />
                        : <Square size={16} className="text-slate-400 shrink-0 mt-0.5" />}
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-white">{gt.name}</p>
                        {gt.description && <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{gt.description}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {empty && (
              <p className="text-center text-slate-400 dark:text-slate-500 py-10 text-xs font-black uppercase tracking-widest">
                {hasAnything ? 'Nothing matches that search' : 'No tasks available'}
              </p>
            )}
          </div>
        )}

        <div className="p-5 pt-4 flex gap-2.5">
          {allowClear && (
            <button
              onClick={() => onConfirm(null, null)}
              title="Clock stays running, no task attached"
              className="flex items-center justify-center gap-1.5 px-3 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 text-[10px] uppercase tracking-widest"
            >
              <Ban size={13} /> Clear
            </button>
          )}
          <button
            onClick={onDismiss}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 text-xs uppercase tracking-widest"
          >
            {dismissLabel}
          </button>
          <button
            onClick={() => onConfirm(taskId, generalTaskId)}
            disabled={taskId === null && generalTaskId === null}
            className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 shadow-lg shadow-green-600/20 text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:shadow-none"
          >
            <Check size={14} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskPickerModal;
