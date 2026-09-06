import type { TimeEntryWithTaskInfo, User } from '../types';
import { HOUR_CATEGORIES } from '../shared/hourCategories';

// "Who is in the room right now, and what is each of them on?" — derived in one
// place so every surface that answers it agrees. The Time page's "Who's Here"
// card and the War Room's live worker chips both read from here; when they
// computed presence separately they were free to disagree about, say, whether
// an unconfirmed check-in counts.
//
// Presentation deliberately stays with each caller: a light card with inline
// controls and a chip on a 10px task tile want very different markup, and a
// shared component with a `variant` prop would serve neither well.

/**
 * Everyone currently on the clock, including those still awaiting a coach's
 * confirmation — they are physically here either way.
 */
export const presentEntries = (timeEntries: TimeEntryWithTaskInfo[]): TimeEntryWithTaskInfo[] =>
  timeEntries.filter(e => e.status === 'checked_in' || e.status === 'pending_check_in');

/** One group per hour category, in HOUR_CATEGORIES order; empty categories dropped. */
export function groupByCategory(entries: TimeEntryWithTaskInfo[]): { category: string; entries: TimeEntryWithTaskInfo[] }[] {
  const groups = new Map<string, TimeEntryWithTaskInfo[]>();
  for (const entry of entries) {
    const category = entry.kind || 'shop';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(entry);
  }
  return HOUR_CATEGORIES
    .filter(c => groups.has(c))
    .map(c => ({ category: c as string, entries: groups.get(c)! }));
}

/** Whether this session has nothing recorded against it. */
export const hasNoTask = (entry: TimeEntryWithTaskInfo): boolean =>
  !entry.workingOnTaskId && !entry.workingOnGeneralTaskId;

/**
 * How many people on the clock have nothing recorded against them — the one
 * number a coach walking the floor actually needs.
 */
export const untaskedCount = (entries: TimeEntryWithTaskInfo[]): number =>
  entries.filter(hasNoTask).length;

/** What a session is on, board task or general task, or null for neither. */
export const workingOnLabel = (entry: TimeEntryWithTaskInfo): string | null =>
  entry.workingOnTaskTitle || entry.workingOnGeneralTaskName || null;

/**
 * Sessions bucketed by the board task they're on, for looking up "who is on
 * this card right now".
 *
 * Keyed by the task id as a STRING. `workingOnTaskId` arrives from the API as a
 * number and App.tsx passes time-entry fields through untouched, while it
 * stringifies every `Task.id` — so a raw `===` between the two compiles fine and
 * silently never matches. Normalizing here is what keeps callers from
 * reintroducing that bug.
 */
export function workersByTaskId(entries: TimeEntryWithTaskInfo[]): Map<string, TimeEntryWithTaskInfo[]> {
  const byTask = new Map<string, TimeEntryWithTaskInfo[]>();
  for (const entry of entries) {
    if (entry.workingOnTaskId == null) continue;
    const key = String(entry.workingOnTaskId);
    if (!byTask.has(key)) byTask.set(key, []);
    byTask.get(key)!.push(entry);
  }
  return byTask;
}

/**
 * Short display names for everyone currently present, keyed by user id.
 *
 * First name alone is what reads at projector distance — but two people in the
 * room routinely share one ("Team Captain" and "Team Member" both collapse to
 * "Team", and so do two Marcuses). So a first name is only used when it is
 * unique AMONG THE PEOPLE PRESENT; on a collision it gains a last initial, and
 * if that still collides it falls back to the full name.
 *
 * Computed across the whole present set rather than per card, so one person
 * reads identically wherever they appear.
 */
export function presenceDisplayNames(
  entries: TimeEntryWithTaskInfo[],
  users: User[],
): Map<string, string> {
  const nameById = new Map(users.map(u => [u.id, u.name]));
  const presentIds = [...new Set(entries.map(e => e.userId))];

  const firstOf = (full: string) => full.trim().split(/\s+/)[0] || full;
  const withInitial = (full: string) => {
    const parts = full.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || full;
  };

  const tally = (label: (full: string) => string) => {
    const counts = new Map<string, number>();
    for (const id of presentIds) {
      const key = label(nameById.get(id) || 'Unknown').toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  };

  const firstCounts = tally(firstOf);
  const initialCounts = tally(withInitial);

  const display = new Map<string, string>();
  for (const id of presentIds) {
    const full = nameById.get(id) || 'Unknown';
    if ((firstCounts.get(firstOf(full).toLowerCase()) || 0) === 1) display.set(id, firstOf(full));
    else if ((initialCounts.get(withInitial(full).toLowerCase()) || 0) === 1) display.set(id, withInitial(full));
    else display.set(id, full);
  }
  return display;
}
