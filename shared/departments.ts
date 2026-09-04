// Departments are not a table — they're a JSONB `{name, color}[]` list on
// `team_settings`, and every place a department is "assigned" elsewhere
// (users, tasks, projects, announcements, recurring task templates,
// certifications, trainer scopes) is a
// free-text match on that name, with no foreign keys and no onDelete
// behavior. Renaming or deleting a department in the Control Panel therefore
// can't be a bare array splice — every reference has to be remapped too, or
// it silently orphans (a project whose `department` no longer exists becomes
// a board nobody can see; a dept-only task with no departments left
// disappears from every board).
//
// `DepartmentSetting` has no stable id, so the server can't tell "renamed
// Mechanical -> Mech" apart from "deleted Mechanical, added Mech" by diffing
// names alone. Instead the client declares its intent explicitly via a
// `DepartmentChangeSet`, and the server reconciles that declaration against
// what's actually stored before trusting it — see `reconcileDepartmentChanges`.
//
// This module is pure and dependency-free (no import from ./schema) so it can
// be shared verbatim between the client and server.

export interface DepartmentRename {
  from: string;
  to: string;
}

export interface DepartmentChangeSet {
  renames: DepartmentRename[];
  removals: string[];
}

export const EMPTY_DEPARTMENT_CHANGES: DepartmentChangeSet = { renames: [], removals: [] };

export interface NormalizedDepartmentChanges {
  renameMap: Map<string, string>;
  removed: Set<string>;
}

export interface DepartmentUsage {
  users: number;
  projects: number;
  tasks: number;
  announcements: number;
  recurringTemplates: number;
  certifications: number;
  trainerScopes: number;
  total: number;
}

export type DepartmentUsageMap = Record<string, DepartmentUsage>;

export type DepartmentPropagationCounts = Omit<DepartmentUsage, 'total'>;

export function isDepartmentChangeSetEmpty(c: DepartmentChangeSet): boolean {
  return c.renames.length === 0 && c.removals.length === 0;
}

export function normalizeDepartmentChanges(c: DepartmentChangeSet): NormalizedDepartmentChanges {
  return {
    renameMap: new Map(c.renames.map(r => [r.from, r.to])),
    removed: new Set(c.removals),
  };
}

/**
 * Remap a single free-text department reference (`projects.department`,
 * `announcements.targetDepartment`). Returns null when the name was removed
 * (or was already null/unset) — callers writing to a nullable text column can
 * assign the result directly.
 */
export function remapDepartmentName(name: string | null, c: NormalizedDepartmentChanges): string | null {
  if (name === null) return null;
  if (c.removed.has(name)) return null;
  return c.renameMap.get(name) ?? name;
}

/**
 * Remap a jsonb string[] department list (`users.departments`,
 * `tasks.departments`, `recurring_task_templates.departments`).
 *
 * Single simultaneous pass: every element is looked up in `renameMap` exactly
 * once (never re-fed through the map), so a rename chain like A->B, B->C
 * cannot cascade an A into a C — `reconcileDepartmentChanges` also rejects
 * chains outright, but this makes the mapping correct by construction even if
 * one slipped through. Removed names are dropped, and the result is deduped
 * keeping the FIRST occurrence, so order is preserved — several call sites
 * (e.g. grouping a member by their primary department) key off `list[0]`.
 */
export function remapDepartmentList(list: string[], c: NormalizedDepartmentChanges): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of list) {
    if (c.removed.has(name)) continue;
    const mapped = c.renameMap.get(name) ?? name;
    if (seen.has(mapped)) continue;
    seen.add(mapped);
    out.push(mapped);
  }
  return out;
}

/**
 * Validate a client-declared change set against what's actually stored on the
 * team_settings row, and prove it fully accounts for every stored name that
 * disappeared from the incoming list. A change set that doesn't reconcile is
 * rejected with a human-readable reason rather than silently orphaning
 * whatever it missed.
 */
export function reconcileDepartmentChanges(
  storedNames: string[],
  incomingNames: string[],
  declared: DepartmentChangeSet | undefined,
): { ok: true; changes: DepartmentChangeSet } | { ok: false; error: string } {
  const changes = declared ?? EMPTY_DEPARTMENT_CHANGES;
  const trimmedIncoming = incomingNames.map(n => n.trim());

  if (trimmedIncoming.some(n => n.length === 0)) {
    return { ok: false, error: 'Department names cannot be empty.' };
  }
  const lowerSeen = new Set<string>();
  for (const n of trimmedIncoming) {
    const lower = n.toLowerCase();
    if (lowerSeen.has(lower)) {
      return { ok: false, error: `Department "${n}" is listed more than once.` };
    }
    lowerSeen.add(lower);
  }

  const storedSet = new Set(storedNames);
  const incomingSet = new Set(trimmedIncoming);

  const renameFroms = new Set<string>();
  for (const r of changes.renames) {
    if (!storedSet.has(r.from)) {
      return { ok: false, error: `Cannot rename "${r.from}" — it is not a current department.` };
    }
    if (renameFroms.has(r.from)) {
      return { ok: false, error: `Department "${r.from}" has more than one rename.` };
    }
    renameFroms.add(r.from);
    if (!incomingSet.has(r.to)) {
      return { ok: false, error: `Renaming "${r.from}" to "${r.to}", but "${r.to}" is not in the saved list.` };
    }
  }
  for (const r of changes.renames) {
    if (renameFroms.has(r.to)) {
      return { ok: false, error: "Rename chains aren't supported — save one rename at a time." };
    }
  }

  const removalSet = new Set(changes.removals);
  for (const name of changes.removals) {
    if (!storedSet.has(name)) {
      return { ok: false, error: `Cannot remove "${name}" — it is not a current department.` };
    }
    if (incomingSet.has(name)) {
      return { ok: false, error: `Department "${name}" is marked removed but is still in the saved list.` };
    }
    if (renameFroms.has(name)) {
      return { ok: false, error: `Department "${name}" cannot be both renamed and removed.` };
    }
  }

  for (const name of storedNames) {
    if (renameFroms.has(name) || removalSet.has(name)) continue;
    if (!incomingSet.has(name)) {
      return {
        ok: false,
        error: `Department "${name}" was dropped without saying whether it was renamed or deleted — reload the Control Panel and try again.`,
      };
    }
  }

  return { ok: true, changes };
}

/**
 * Derive a change set for a settings reset, where the "next" list is a fixed
 * default and there's no rename intent to infer — every stored name that
 * doesn't survive into the defaults is treated as a removal.
 */
export function derivedRemovals(storedNames: string[], nextNames: string[]): DepartmentChangeSet {
  const nextSet = new Set(nextNames);
  return {
    renames: [],
    removals: storedNames.filter(n => !nextSet.has(n)),
  };
}
