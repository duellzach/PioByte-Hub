// Task comments and history are authored records: who wrote them must come
// from the session, not from whatever the client put in the payload. The task
// PUT sends the modal's whole (possibly stale) task, so a plain overwrite let
// a client save `userId: 'unknown'`, rewrite someone else's entry, or wipe a
// comment a teammate posted while the modal was open. This merge keeps every
// stored entry as stored and only adds the entries the client is introducing,
// stamped with the acting user.

export interface AuthoredEntry {
  id: string;
  userId: number | string;
  timestamp: number;
  [key: string]: unknown;
}

const asArray = (v: unknown): AuthoredEntry[] =>
  Array.isArray(v) ? v.filter((e): e is AuthoredEntry => !!e && typeof e === "object" && typeof (e as any).id === "string") : [];

/**
 * Returns the stored entries (unchanged, minus allowed deletions) with any
 * entries the client added in front, each re-stamped with `actorId`.
 *
 * Deletion is explicit — an entry missing from `incoming` is NOT treated as
 * deleted, because a stale client simply hasn't seen it yet. Only ids in
 * `deleteIds` are removed, and only when `canDelete(entry)` allows it.
 */
export function mergeAuthoredEntries(
  existing: unknown,
  incoming: unknown,
  actorId: number,
  deleteIds: readonly string[] = [],
  canDelete: (entry: AuthoredEntry) => boolean = () => false,
): AuthoredEntry[] {
  const stored = asArray(existing);
  const storedIds = new Set(stored.map(e => e.id));
  const toDelete = new Set(deleteIds);

  const seen = new Set<string>();
  const added = asArray(incoming)
    .filter(e => !storedIds.has(e.id) && !toDelete.has(e.id) && !seen.has(e.id) && seen.add(e.id))
    .map(e => ({ ...e, userId: actorId }));

  const kept = stored.filter(e => !toDelete.has(e.id) || !canDelete(e));
  return [...added, ...kept];
}

/** Ids the client asked to delete, sanitized. */
export function deletedIds(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
