import { storage } from "../storage";
import { getLedgerRows, totalsFromRows, type CategoryTotals, type LedgerRow } from "./hoursLedger";
import { localDatePT } from "../../utils/dates";
import { getTeamTimezone } from "./teamTime";

// "How productive has this member been, and on what?" — the one place that
// answers it, for both the Team summary table and the per-student deep dive.
//
// Two independent sources are combined:
//  - the hours ledger (server/services/hoursLedger.ts) for minutes earned;
//  - `time_entry_task_segments` for where those minutes went, task by task.
// Task counts (completed / active / effort) come from the boards themselves.
//
// Every window is INCLUSIVE and expressed as team-local YYYY-MM-DD, matching
// the ledger's bucketing rule — a null bound means "unbounded on that side".

export interface Window {
  start: string | null;
  end: string | null;
}

const inWindow = (date: string, { start, end }: Window) =>
  (!start || date >= start) && (!end || date <= end);

export interface TaskContribution {
  taskId: number | null;
  generalTaskId: number | null;
  title: string;
  /** Board the task lives on — null for a general task, which has no board. */
  projectName: string | null;
  status: string | null;
  effort: number | null;
  /** Minutes attributed to this task across the window. */
  minutes: number;
  /** How many separate stretches were spent on it. */
  sessions: number;
  lastWorkedAt: string | null;
  /** True when the member is an assignee, rather than only helping out. */
  isAssignee: boolean;
}

export interface MemberProductivity {
  userId: number;
  name: string;
  username: string;
  departments: string[];
  roles: string[];
  muted: boolean;
  /** Minutes by hour category, plus `total`, inside the window. */
  hours: CategoryTotals;
  /** Completed clock sessions inside the window. */
  sessions: number;
  /** Tasks completed inside the window on which the member is an assignee. */
  tasksCompleted: number;
  /** Effort points from those completed tasks. */
  effort: number;
  /** Live (non-complete) assigned tasks on non-archived boards — not windowed. */
  activeTasks: number;
  /** Distinct tasks the member logged time against inside the window. */
  tasksWorked: number;
}

/** Tasks joined to their board, with archived boards dropped. */
async function liveTasks() {
  const [allTasks, projects] = await Promise.all([storage.getTasks(), storage.getProjects()]);
  const byId = new Map(projects.map((p) => [p.id, p]));
  return allTasks
    .filter((t) => !byId.get(t.projectId)?.archived)
    .map((t) => ({ ...t, projectName: byId.get(t.projectId)?.name ?? "" }));
}

/**
 * Per-task minutes from the segment ledger. Open segments (someone is on the
 * task right now) count their elapsed time so a live class shows real numbers.
 */
async function contributionsByUser(window: Window, tz: string) {
  const [segments, tasks, generalTasks] = await Promise.all([
    storage.getTaskSegments(),
    liveTasks(),
    storage.getGeneralTasks(true),
  ]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const genById = new Map(generalTasks.map((g) => [g.id, g]));
  const byUser = new Map<number, Map<string, TaskContribution>>();

  for (const seg of segments) {
    const startedAt = new Date(seg.startedAt);
    if (!inWindow(localDatePT(startedAt, tz), window)) continue;
    // A segment on an archived board's task is history we no longer surface.
    if (seg.taskId != null && !taskById.has(seg.taskId)) continue;
    if (seg.taskId == null && seg.generalTaskId == null) continue;

    const key = seg.taskId != null ? `t${seg.taskId}` : `g${seg.generalTaskId}`;
    const minutes = seg.minutes ?? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60000));
    if (!byUser.has(seg.userId)) byUser.set(seg.userId, new Map());
    const bucket = byUser.get(seg.userId)!;
    const existing = bucket.get(key);
    if (existing) {
      existing.minutes += minutes;
      existing.sessions += 1;
      if (!existing.lastWorkedAt || startedAt.toISOString() > existing.lastWorkedAt) {
        existing.lastWorkedAt = startedAt.toISOString();
      }
      continue;
    }
    const task = seg.taskId != null ? taskById.get(seg.taskId) : undefined;
    const gen = seg.generalTaskId != null ? genById.get(seg.generalTaskId) : undefined;
    bucket.set(key, {
      taskId: seg.taskId ?? null,
      generalTaskId: seg.generalTaskId ?? null,
      title: task?.title ?? gen?.name ?? "(removed)",
      projectName: task?.projectName ?? null,
      status: task?.status ?? null,
      effort: task?.effort ?? null,
      minutes,
      sessions: 1,
      lastWorkedAt: startedAt.toISOString(),
      isAssignee: !!task && ((task.assignees as number[]) || []).includes(seg.userId),
    });
  }
  return byUser;
}

/** Completed sessions per user inside the window, from the hours ledger. */
const sessionCounts = (rows: LedgerRow[], window: Window) => {
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (!inWindow(r.date, window)) continue;
    counts.set(r.userId, (counts.get(r.userId) || 0) + 1);
  }
  return counts;
};

/**
 * One row per active member for the Team summary table. Archived members are
 * excluded — they've left the team, and leaving them in inflates every count a
 * coach reads off the table.
 */
export async function getTeamProductivity(window: Window): Promise<MemberProductivity[]> {
  const tz = await getTeamTimezone();
  const [users, tasks, ledgerRows, contributions] = await Promise.all([
    storage.getUsers(),
    liveTasks(),
    getLedgerRows(),
    contributionsByUser(window, tz),
  ]);
  const sessions = sessionCounts(ledgerRows, window);
  const hoursByUser = new Map<number, LedgerRow[]>();
  for (const r of ledgerRows) {
    if (!inWindow(r.date, window)) continue;
    if (!hoursByUser.has(r.userId)) hoursByUser.set(r.userId, []);
    hoursByUser.get(r.userId)!.push(r);
  }

  return users
    .filter((u) => !u.archived)
    .map((u) => {
      const assigned = tasks.filter((t) => ((t.assignees as number[]) || []).includes(u.id));
      const completed = assigned.filter(
        (t) =>
          t.status === "Complete" &&
          t.completedAt &&
          inWindow(localDatePT(new Date(t.completedAt), tz), window),
      );
      return {
        userId: u.id,
        name: u.name,
        username: u.username,
        departments: (u.departments as string[]) || [],
        roles: (u.roles as string[]) || [],
        muted: !!u.muted,
        hours: totalsFromRows(hoursByUser.get(u.id) || []),
        sessions: sessions.get(u.id) || 0,
        tasksCompleted: completed.length,
        effort: completed.reduce((sum, t) => sum + (t.effort || 0), 0),
        activeTasks: assigned.filter((t) => t.status !== "Complete").length,
        tasksWorked: contributions.get(u.id)?.size || 0,
      };
    })
    .sort((a, b) => {
      const dA = a.departments[0] || "zzz";
      const dB = b.departments[0] || "zzz";
      if (dA !== dB) return dA.localeCompare(dB);
      return a.name.localeCompare(b.name);
    });
}

export interface ProductivityDeepDive {
  user: { id: number; name: string; username: string; departments: string[]; roles: string[] };
  window: Window;
  hours: CategoryTotals;
  sessions: { id: number; date: string; kind: string; minutes: number; status: string; taskTitle: string | null; notes: string | null }[];
  /** Minutes per team-local day — a sparkline of when the member actually shows up. */
  byDay: { date: string; minutes: number }[];
  contributions: TaskContribution[];
  tasksCompleted: { id: number; title: string; projectName: string; effort: number | null; completedAt: string }[];
  tasksActive: { id: number; title: string; projectName: string; status: string; effort: number | null; dueDate: string | null }[];
}

/** Everything the per-student drawer shows, for one member and one window. */
export async function getUserProductivity(userId: number, window: Window): Promise<ProductivityDeepDive | null> {
  const user = await storage.getUser(userId);
  if (!user) return null;

  const tz = await getTeamTimezone();
  const [rows, entries, tasks, contributionMap] = await Promise.all([
    getLedgerRows(userId),
    storage.getTimeEntries(),
    liveTasks(),
    contributionsByUser(window, tz),
  ]);

  const windowed = rows.filter((r) => inWindow(r.date, window));
  const entryById = new Map(entries.map((e: any) => [e.id, e]));

  const byDayMap = new Map<string, number>();
  for (const r of windowed) byDayMap.set(r.date, (byDayMap.get(r.date) || 0) + r.minutes);

  const assigned = tasks.filter((t) => ((t.assignees as number[]) || []).includes(userId));

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      departments: (user.departments as string[]) || [],
      roles: (user.roles as string[]) || [],
    },
    window,
    hours: totalsFromRows(windowed),
    sessions: windowed.map((r) => {
      const entry: any = entryById.get(r.sourceId);
      return {
        id: r.sourceId,
        date: r.date,
        kind: r.category,
        minutes: r.minutes,
        status: entry?.status ?? "completed",
        taskTitle: entry?.workingOnTaskTitle ?? entry?.workingOnGeneralTaskName ?? null,
        notes: entry?.notes ?? null,
      };
    }),
    byDay: [...byDayMap.entries()].map(([date, minutes]) => ({ date, minutes })).sort((a, b) => a.date.localeCompare(b.date)),
    contributions: [...(contributionMap.get(userId)?.values() || [])].sort((a, b) => b.minutes - a.minutes),
    tasksCompleted: assigned
      .filter((t) => t.status === "Complete" && t.completedAt && inWindow(localDatePT(new Date(t.completedAt), tz), window))
      .map((t) => ({
        id: t.id,
        title: t.title,
        projectName: t.projectName,
        effort: t.effort ?? null,
        completedAt: new Date(t.completedAt!).toISOString(),
      }))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
    tasksActive: assigned
      .filter((t) => t.status !== "Complete")
      .map((t) => ({
        id: t.id,
        title: t.title,
        projectName: t.projectName,
        status: t.status,
        effort: t.effort ?? null,
        dueDate: t.dueDate ?? null,
      })),
  };
}
