// Archived members have left the team. They must not be offered anywhere a
// member is picked (assignees, invites, mentions, scrum masters, scout
// assignments, certification grants, fundraising credit), counted in team
// lists, or sent notifications — but their NAMES must keep resolving, so
// comments, task history, past hours and old sign-ups stay readable. So:
// filter with this wherever a list is offered or fanned out to; never filter
// the user list used for name lookups.
//
// Dependency-free: imported by both the browser bundle and the server.

export const isActiveMember = (u?: { archived?: boolean | null } | null): boolean => !!u && !u.archived;

/** For pickers: active members, plus anyone already selected (so an archived
 *  member who's still on a task or invite list shows up and can be removed). */
export function pickableMembers<T extends { id: string | number; archived?: boolean | null }>(
  users: T[],
  selectedIds: readonly (string | number)[] = [],
): T[] {
  const selected = new Set(selectedIds.map(String));
  return users.filter((u) => !u.archived || selected.has(String(u.id)));
}
