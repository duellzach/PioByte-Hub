import type { Project, Task } from '../types';

/**
 * Tasks whose board is still live.
 *
 * Archiving a board retires its work. Until this existed, only the Kanban view
 * honored that — every other surface (My Tasks, the War Room, velocity, team
 * stats, the time clock's "what are you working on?" picker) read `state.tasks`
 * flat, so retired tasks kept surfacing as if they were live work. The server
 * applies the same rule to the check-in task menu
 * (`storage.getAvailableTasksForUser`); this is the client-side half.
 *
 * A task whose board is missing from `projects` is kept: an unknown board is a
 * loading race, not an archived one, and hiding work on a hunch is worse than
 * briefly showing it.
 */
export function onLiveBoard<T extends Pick<Task, 'projectId'>>(tasks: T[], projects: Project[]): T[] {
  if (projects.length === 0) return tasks;
  const archived = new Set(projects.filter(p => p.archived).map(p => String(p.id)));
  if (archived.size === 0) return tasks;
  return tasks.filter(t => !archived.has(String(t.projectId)));
}
