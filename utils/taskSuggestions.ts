import { Priority, TaskStatus, type AvailableTask, type TimeEntryWithTaskInfo } from '../types';
import { todayLocalStr } from './dates';

// "What should I work on?" — the short groups the task picker leads with, so a
// student doesn't face every open task on every board at once. With 8–15 live
// boards that full list ran to dozens of rows and students skipped it, which is
// how they ended up as "no task" on the War Room.
//
// Everything is derived from data the client already has: the available-task
// list from the server, and the time entries (who is clocked onto what right
// now, and the handoff note each finished session left behind).

/** How many "Needs hands" tasks to offer; more than this is a list again. */
export const NEEDS_HANDS_LIMIT = 3;

export interface HandoffNote {
  userId: string;
  note: string;
  /** Check-out time, ms. */
  at: number;
}

export interface TaskSuggestions {
  /** The task the subject's last finished session was on, if it's still open. */
  resume: AvailableTask | null;
  /** Assigned to the subject, minus the resume task. */
  mine: AvailableTask[];
  /** Tasks someone else in the subject's departments is clocked onto right now. */
  teammates: AvailableTask[];
  /** Unassigned, not started, in the subject's departments, and overdue or High/Urgent. */
  needsHands: AvailableTask[];
  /** Who is on each task right now (user ids, the subject excluded), keyed by task id. */
  workersByTask: Map<number, string[]>;
  /** The newest handoff note left on each task, keyed by task id. */
  latestNote: Map<number, HandoffNote>;
}

const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const ms = (v: unknown) => (typeof v === 'number' ? v : new Date(v as string).getTime() || 0);
const isPresent = (e: TimeEntryWithTaskInfo) => e.status === 'checked_in' || e.status === 'pending_check_in';

export function buildTaskSuggestions(input: {
  tasks: AvailableTask[];
  subjectId: string;
  subjectDepartments: string[];
  /** Every time entry the client has — open ones for presence, finished ones for notes. */
  entries: TimeEntryWithTaskInfo[];
  /** Off when switching or reassigning mid-session — "where you left off" only means something at check-in. */
  includeResume?: boolean;
  today?: string;
}): TaskSuggestions {
  const { tasks, subjectId, subjectDepartments, entries } = input;
  const today = input.today ?? todayLocalStr();
  const byId = new Map(tasks.map(t => [Number(t.id), t]));
  const inMyDepartments = (t: AvailableTask) => (t.departments || []).some(d => subjectDepartments.includes(d));

  // Task ids arrive as numbers from the API but may have been stringified on the
  // way through App.tsx, so every lookup goes through Number().
  const workersByTask = new Map<number, string[]>();
  for (const e of entries) {
    if (!isPresent(e) || e.workingOnTaskId == null || String(e.userId) === subjectId) continue;
    const key = Number(e.workingOnTaskId);
    workersByTask.set(key, [...(workersByTask.get(key) || []), String(e.userId)]);
  }

  const latestNote = new Map<number, HandoffNote>();
  for (const e of entries) {
    const note = e.taskHandoffNote?.trim();
    if (!note || e.workingOnTaskId == null || !e.checkOutAt) continue;
    const key = Number(e.workingOnTaskId);
    const at = ms(e.checkOutAt);
    if ((latestNote.get(key)?.at ?? -1) < at) latestNote.set(key, { userId: String(e.userId), note, at });
  }

  const lastFinished = entries
    .filter(e => String(e.userId) === subjectId && e.checkOutAt && e.workingOnTaskId != null)
    .sort((a, b) => ms(b.checkOutAt) - ms(a.checkOutAt))[0];
  // The server only offers live, unblocked, unfinished tasks — so a task that
  // was completed or blocked since simply isn't found here, and isn't offered.
  const resume = input.includeResume !== false && lastFinished ? byId.get(Number(lastFinished.workingOnTaskId)) || null : null;

  const shown = new Set<number>();
  if (resume) shown.add(Number(resume.id));
  const mine = tasks.filter(t => t.isAssigned && !shown.has(Number(t.id)));
  mine.forEach(t => shown.add(Number(t.id)));

  const teammates = tasks
    .filter(t => !shown.has(Number(t.id)) && inMyDepartments(t) && (workersByTask.get(Number(t.id))?.length ?? 0) > 0)
    .sort((a, b) => (workersByTask.get(Number(b.id))!.length - workersByTask.get(Number(a.id))!.length));
  teammates.forEach(t => shown.add(Number(t.id)));

  const isLate = (t: AvailableTask) => !!t.dueDate && t.dueDate.slice(0, 10) < today;
  const needsHands = tasks
    .filter(t =>
      !shown.has(Number(t.id)) &&
      inMyDepartments(t) &&
      t.status === TaskStatus.NotStarted &&
      (t.assignees?.length ?? 0) === 0 &&
      (isLate(t) || t.priority === Priority.High || t.priority === Priority.Urgent))
    .sort((a, b) =>
      Number(isLate(b)) - Number(isLate(a)) ||
      (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
      (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    .slice(0, NEEDS_HANDS_LIMIT);

  return { resume, mine, teammates, needsHands, workersByTask, latestNote };
}
