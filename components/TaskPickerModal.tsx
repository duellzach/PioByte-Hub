import React, { useMemo, useState } from 'react';
import { X, Search, Briefcase, Users, ListChecks, CheckSquare, Square, Loader2, Check, Ban, CalendarClock, HelpCircle, CircleCheck, Circle, MoreHorizontal, ArrowLeft, Link2, MessageSquare, ExternalLink } from 'lucide-react';
import type { AvailableTask, GeneralTask } from '../types';
import { PRIORITY_COLORS } from '../constants';

interface Props {
  title: string;
  subtitle?: string;
  loading: boolean;
  assignedTasks: AvailableTask[];
  openTasks: AvailableTask[];
  generalTasks: GeneralTask[];
  /** Resolves assignee ids to names for the task details. */
  userNameFor?: (userId: number) => string;
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
  title, subtitle, loading, assignedTasks, openTasks, generalTasks, userNameFor,
  selectedTaskId, selectedGeneralTaskId, confirmLabel, dismissLabel,
  allowClear = false, onDismiss, onConfirm,
}) => {
  const [taskId, setTaskId] = useState<number | null>(selectedTaskId);
  const [generalTaskId, setGeneralTaskId] = useState<number | null>(selectedGeneralTaskId);
  const [query, setQuery] = useState('');
  const [board, setBoard] = useState('');
  // The task whose full details are open (the ⋯ button on a row).
  const [detailTask, setDetailTask] = useState<AvailableTask | null>(null);

  // A task can live on more than one board at once, mirroring the Kanban
  // view: a department board shows every task tagged with that department
  // regardless of project, and a project board shows every non-department-only
  // task in that project. So a task with departments keeps its project
  // membership *plus* one membership per department, unless it's marked
  // department-only, in which case it drops off its project board entirely
  // and lives only on its department board(s). Keyed with a prefix so a
  // project and a department that happen to share a name never collide.
  const boardKeysFor = (t: AvailableTask): string[] => {
    const deptKeys = (t.departments || []).map(d => `dept:${d}`);
    return t.deptOnly ? deptKeys : [`proj:${t.projectName}`, ...deptKeys];
  };
  const boardLabelForKey = (key: string) => key.startsWith('dept:') ? `⬡ ${key.slice(5)}` : key.slice(5);
  // The row subtitle shows every board a task belongs to, so a task visible
  // on both its project and a department board doesn't look mislabeled.
  const boardLabelsFor = (t: AvailableTask) => boardKeysFor(t).map(boardLabelForKey).join(' + ') || t.projectName;

  // Assigned tasks always float to the top regardless of the board filter —
  // the filter narrows what else is offered, not the student's own work.
  // General Tasks aren't tied to any board, so they drop out once a specific
  // board is chosen; they still show under "All Boards".
  const boards = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; isDept: boolean }>();
    for (const t of [...assignedTasks, ...openTasks]) {
      for (const key of boardKeysFor(t)) {
        if (!byKey.has(key)) byKey.set(key, { key, label: boardLabelForKey(key), isDept: key.startsWith('dept:') });
      }
    }
    const all = Array.from(byKey.values());
    const projects = all.filter(b => !b.isDept).sort((a, b) => a.label.localeCompare(b.label));
    const depts = all.filter(b => b.isDept).sort((a, b) => a.label.localeCompare(b.label));
    return { projects, depts };
  }, [assignedTasks, openTasks]);
  const boardCount = boards.projects.length + boards.depts.length;

  const q = query.trim().toLowerCase();
  const matches = (haystack: string[]) => !q || haystack.some(h => (h || '').toLowerCase().includes(q));

  const filtered = useMemo(() => ({
    assigned: assignedTasks.filter(t => matches([t.title, boardLabelsFor(t), t.description || ''])),
    open: openTasks.filter(t => (!board || boardKeysFor(t).includes(board)) && matches([t.title, boardLabelsFor(t), t.description || ''])),
    general: generalTasks.filter(g => !board && matches([g.name, g.description || ''])),
  }), [assignedTasks, openTasks, generalTasks, q, board]);

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

  const dueInfo = (due?: string | null) => {
    if (!due) return null;
    const d = new Date(due.length === 10 ? `${due}T12:00:00` : due);
    if (isNaN(d.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const days = Math.round((day.getTime() - today.getTime()) / 86400000);
    const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return {
      label: days < 0 ? `Overdue · ${label}` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due ${label}`,
      tone: days < 0 ? 'text-red-600 dark:text-red-400' : days <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400',
    };
  };

  const TaskRow = ({ task, tone }: { task: AvailableTask; tone: 'blue' | 'orange' }) => {
    const selected = taskId === task.id;
    const ring = tone === 'blue'
      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
      : 'border-orange-500 bg-orange-50 dark:bg-orange-900/30';
    const hover = tone === 'blue'
      ? 'hover:border-blue-300 dark:hover:border-blue-700'
      : 'hover:border-orange-300 dark:hover:border-orange-700';
    const due = dueInfo(task.dueDate);
    const assigneeNames = userNameFor ? (task.assignees || []).map(userNameFor).filter(Boolean) : [];
    const criteria = task.successCriteria || [];
    const description = (task.description || '').trim();
    return (
      <div
        className={`relative rounded-xl border-2 transition-all ${
          selected ? ring : `border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700 ${hover} hover:shadow-sm`
        }`}
      >
        <button
          onClick={() => pickTask(task.id)}
          aria-pressed={selected}
          className="w-full text-left p-3 pr-11"
        >
          <p className="text-[11px] font-black text-slate-900 dark:text-white leading-tight line-clamp-2">{task.title}</p>
          <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] ?? 'bg-slate-100 text-slate-600'}`}>
              {task.priority}
            </span>
            {task.effort ? <span>{task.effort}pt •</span> : null}
            <span className="truncate">{boardLabelsFor(task)} • {task.status}</span>
          </p>
          {description && (
            <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-2 whitespace-pre-line">{description}</p>
          )}
          {(due || assigneeNames.length > 0 || task.helpRequested || criteria.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-[9px] font-bold">
              {due && <span className={`flex items-center gap-1 ${due.tone}`}><CalendarClock size={10} /> {due.label}</span>}
              {assigneeNames.length > 0 && (
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 min-w-0">
                  <Users size={10} className="shrink-0" /> <span className="truncate">{assigneeNames.join(', ')}</span>
                </span>
              )}
              {criteria.length > 0 && (
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <CircleCheck size={10} /> {criteria.filter(c => c.completed).length}/{criteria.length}
                </span>
              )}
              {task.helpRequested && <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400"><HelpCircle size={10} /> Help wanted</span>}
            </div>
          )}
          {selected && (
            <div className={`mt-1.5 flex items-center gap-1 ${tone === 'blue' ? 'text-blue-600' : 'text-orange-600'}`}>
              <CheckSquare size={11} />
              <span className="text-[9px] font-black uppercase">Selected</span>
            </div>
          )}
        </button>
        {/* A sibling, not nested — a button inside the row button is invalid
            HTML and would also select the task. */}
        <button
          onClick={() => setDetailTask(task)}
          aria-label={`View full details for ${task.title}`}
          title="View full task"
          className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-400 hover:text-teamColor hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    );
  };

  const TaskDetails = ({ task }: { task: AvailableTask }) => {
    const due = dueInfo(task.dueDate);
    const fmtDay = (d?: string | null) => {
      if (!d) return null;
      const dt = new Date(d.length === 10 ? `${d}T12:00:00` : d);
      return isNaN(dt.getTime()) ? null : dt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const names = (ids?: (number | string)[]) => (userNameFor ? (ids || []).map(id => userNameFor(Number(id))).filter(Boolean) : []);
    const assignees = names(task.assignees);
    const contributors = names(task.contributors).filter(n => !assignees.includes(n));
    const criteria = task.successCriteria || [];
    const links = (task.attachments || []).filter(a => a?.url);
    const comments = [...(task.comments || [])].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    const description = (task.description || '').trim();
    const Label = ({ children }: { children: React.ReactNode }) => (
      <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{children}</p>
    );
    return (
      <div className="flex-1 overflow-auto px-5 space-y-4">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">{task.title}</h3>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">{boardLabelsFor(task)}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[8px] font-black px-2 py-0.5 rounded uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{task.status}</span>
            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] ?? 'bg-slate-100 text-slate-600'}`}>{task.priority}</span>
            {task.effort ? <span className="text-[8px] font-black px-2 py-0.5 rounded uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{task.effort} pts</span> : null}
            {task.helpRequested && <span className="text-[8px] font-black px-2 py-0.5 rounded uppercase bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">Help wanted</span>}
          </div>
        </div>

        <div>
          <Label>Description</Label>
          {description
            ? <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-line break-words">{description}</p>
            : <p className="text-xs italic text-slate-400">No description.</p>}
        </div>

        {criteria.length > 0 && (
          <div>
            <Label>Success criteria · {criteria.filter(c => c.completed).length}/{criteria.length}</Label>
            <ul className="space-y-1">
              {criteria.map(c => (
                <li key={c.id} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  {c.completed
                    ? <CircleCheck size={12} className="text-emerald-500 shrink-0 mt-px" />
                    : <Circle size={12} className="text-slate-300 dark:text-slate-500 shrink-0 mt-px" />}
                  <span className={c.completed ? 'line-through opacity-60' : ''}>{c.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(task.startDate || task.dueDate) && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{fmtDay(task.startDate) || '—'}</p></div>
            <div><Label>Due</Label><p className={`text-[11px] font-bold ${due?.tone ?? 'text-slate-700 dark:text-slate-200'}`}>{due?.label || '—'}</p></div>
          </div>
        )}

        {(assignees.length > 0 || contributors.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Assigned</Label><p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{assignees.join(', ') || '—'}</p></div>
            {contributors.length > 0 && <div><Label>Contributors</Label><p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{contributors.join(', ')}</p></div>}
          </div>
        )}

        {links.length > 0 && (
          <div>
            <Label>Links</Label>
            <div className="space-y-1">
              {links.map(a => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] font-bold text-teamColor hover:underline break-all">
                  <Link2 size={11} className="shrink-0" /> {a.label || a.url} <ExternalLink size={10} className="shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {comments.length > 0 && (
          <div className="pb-2">
            <Label>Recent comments</Label>
            <div className="space-y-2">
              {comments.map(c => (
                <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <MessageSquare size={9} /> {userNameFor ? userNameFor(Number(c.userId)) : 'Member'} · {new Date(c.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-[11px] text-slate-700 dark:text-slate-200 whitespace-pre-line break-words mt-0.5">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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

        {!detailTask && hasAnything && !loading && (
          <div className="px-5 pb-3 space-y-2">
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
            {boardCount > 1 && (
              <select
                value={board}
                onChange={e => setBoard(e.target.value)}
                aria-label="Filter by board"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor dark:text-white font-bold text-[11px] uppercase tracking-wide"
              >
                <option value="">All Boards</option>
                {boards.projects.length > 0 && (
                  <optgroup label="Projects">
                    {boards.projects.map(b => (
                      <option key={b.key} value={b.key}>{b.label}</option>
                    ))}
                  </optgroup>
                )}
                {boards.depts.length > 0 && (
                  <optgroup label="Department Boards">
                    {boards.depts.map(b => (
                      <option key={b.key} value={b.key}>{b.label}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </div>
        )}

        {detailTask ? (
          <TaskDetails task={detailTask} />
        ) : loading ? (
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
                {hasAnything ? (q || board ? 'Nothing matches those filters' : 'Nothing matches that search') : 'No tasks available'}
              </p>
            )}
          </div>
        )}

        {detailTask ? (
          <div className="p-5 pt-4 flex gap-2.5">
            <button
              onClick={() => setDetailTask(null)}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 text-xs uppercase tracking-widest flex items-center justify-center gap-1.5"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={() => { setTaskId(detailTask.id); setGeneralTaskId(null); setDetailTask(null); }}
              className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 shadow-lg shadow-green-600/20 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Check size={14} /> {taskId === detailTask.id ? 'Selected' : 'Select task'}
            </button>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default TaskPickerModal;
