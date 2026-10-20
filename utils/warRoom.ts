import { Project, Task, TaskStatus } from '../types';
import { todayLocalStr } from './dates';

// The War Room's per-board summary — "is this board OK, and if not, why?" —
// derived in one place so the health cards and the "Needs a coach" list agree.
//
// With 8–15 live boards, drawing every board as a full kanban buried the few
// tasks that needed a coach under dozens that didn't. These helpers rank boards
// by what needs attention so the screen can lead with problems and compress the
// rest to a small card. Everything here comes from data the app already stores;
// no new fields.

/** A board with no history at all for this long, while it still has open work, reads as quiet. */
export const QUIET_AFTER_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export type BoardHealth = 'red' | 'amber' | 'green';

export interface BoardSummary {
  project: Project;
  /** Board tasks only — dept-only tasks live on department boards, not here. */
  tasks: Task[];
  byStatus: Record<TaskStatus, Task[]>;
  openCount: number;
  totalPoints: number;
  donePoints: number;
  /** 0–100, by effort points; by task count when no task has points. */
  percentDone: number;
  blocked: Task[];
  overdue: Task[];
  /** The soonest open task due today or later. */
  nextDue: Task | null;
  /** Latest history entry (or creation / completion) across the board, ms; null for an empty board. */
  lastActivity: number | null;
  quiet: boolean;
  health: BoardHealth;
  /** Higher = needs a coach sooner. Only meaningful for sorting. */
  attention: number;
}

/**
 * History timestamps are written client-side as `Date.now()` numbers, but older
 * rows went through JSON and the server, so accept anything Date can read.
 */
const toMs = (value: unknown): number => {
  if (typeof value === 'number') return value;
  const ms = new Date(value as string).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

/** The task's most recent sign of life: newest history entry, completion, or creation. */
export function lastActivityAt(task: Task): number {
  let latest = Math.max(toMs(task.createdAt), task.completedAt ? toMs(task.completedAt) : 0);
  for (const h of task.history || []) latest = Math.max(latest, toMs(h.timestamp));
  return latest;
}

/**
 * Past due and still expected to move. Backlog is excluded on purpose: a due
 * date on parked work is a wish, and flagging it would bury real slips.
 * Compared as `YYYY-MM-DD` strings against the LOCAL date — see utils/dates.ts.
 */
export function isOverdue(task: Task, today: string = todayLocalStr()): boolean {
  if (!task.dueDate) return false;
  if (task.status === TaskStatus.Complete || task.status === TaskStatus.Backlog) return false;
  return task.dueDate.slice(0, 10) < today;
}

/** Whole days between a due date and today, for "3d late". */
export function daysLate(task: Task, today: string = todayLocalStr()): number {
  if (!task.dueDate) return 0;
  const [y1, m1, d1] = task.dueDate.slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

export function summarizeBoard(project: Project, allTasks: Task[], now: number = Date.now()): BoardSummary {
  const today = todayLocalStr(new Date(now));
  const tasks = allTasks.filter(t => String(t.projectId) === String(project.id) && !t.deptOnly);

  const byStatus = {
    [TaskStatus.Backlog]: [],
    [TaskStatus.NotStarted]: [],
    [TaskStatus.InProgress]: [],
    [TaskStatus.Blocked]: [],
    [TaskStatus.Complete]: [],
  } as Record<TaskStatus, Task[]>;
  for (const t of tasks) (byStatus[t.status] ||= []).push(t);

  const open = tasks.filter(t => t.status !== TaskStatus.Complete);
  const totalPoints = tasks.reduce((sum, t) => sum + (t.effort || 0), 0);
  const donePoints = byStatus[TaskStatus.Complete].reduce((sum, t) => sum + (t.effort || 0), 0);
  const percentDone = totalPoints > 0
    ? Math.round((donePoints / totalPoints) * 100)
    : tasks.length > 0 ? Math.round((byStatus[TaskStatus.Complete].length / tasks.length) * 100) : 0;

  const blocked = byStatus[TaskStatus.Blocked];
  const overdue = open.filter(t => isOverdue(t, today));
  const nextDue = open
    .filter(t => t.dueDate && t.dueDate.slice(0, 10) >= today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0] || null;

  const lastActivity = tasks.length > 0 ? Math.max(...tasks.map(lastActivityAt)) : null;
  const quiet = open.length > 0 && lastActivity !== null && now - lastActivity > QUIET_AFTER_DAYS * DAY_MS;

  let health: BoardHealth = 'green';
  if (blocked.length >= 2 || overdue.length >= 3) health = 'red';
  else if (blocked.length > 0 || overdue.length > 0 || quiet) health = 'amber';

  const attention = blocked.length * 30 + overdue.length * 20 + (quiet ? 25 : 0);

  return {
    project, tasks, byStatus, openCount: open.length, totalPoints, donePoints, percentDone,
    blocked, overdue, nextDue, lastActivity, quiet, health, attention,
  };
}

/** Worst first; ties keep the boards' own order (Array.prototype.sort is stable). */
export const byAttention = (a: BoardSummary, b: BoardSummary): number => b.attention - a.attention;

/** "4m", "3h", "6d" — compact enough for a card footer at projector distance. */
export function shortAgo(ms: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ms);
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 60000))}m`;
  if (diff < DAY_MS) return `${Math.round(diff / (60 * 60 * 1000))}h`;
  return `${Math.round(diff / DAY_MS)}d`;
}
