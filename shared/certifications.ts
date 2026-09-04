// Certification levels and the badges earned by completing them.
//
// A certification belongs to a DEPARTMENT (a free-text name matching
// `team_settings.departments`, or `null` for the "General" category) and a
// LEVEL, 1..MAX_LEVEL. Together those form a track: "Manufacturing Lvl 1" ->
// "Manufacturing Lvl 2" -> ... Completing every certification in one
// (department, level) set earns the badge for that set.
//
// Levels are SEQUENTIAL: a student can't start a Lvl N certification until
// they hold the Lvl N-1 badge for that same department. The gate reads the
// RECORDED badge rather than recomputing "do they hold every Lvl N-1 cert
// right now" — see `isLevelUnlocked` for why that distinction matters.
//
// This module is pure and dependency-free (no import from ./schema) so it can
// be shared verbatim between the client and server, and unit-tested with no
// database — see server/certifications.test.ts.

export const MAX_LEVEL = 3;

/** Every level in a track, lowest first. */
export const LEVELS: number[] = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

/**
 * The "General" category — certifications that belong to no department.
 * Represented as SQL NULL so that removing a department in the Control Panel
 * degrades a cert to General (via `remapDepartmentName`) instead of orphaning
 * it. A sentinel string like 'General' would collide with a real department
 * a team happened to name "General".
 */
export const GENERAL: null = null;

export interface LeveledCert {
  id: number;
  department: string | null;
  level: number;
}

export interface EarnedLevelBadge {
  department: string | null;
  level: number;
}

/**
 * Departments are compared by an exact name match, with `null` (General) as
 * its own distinct track. Normalizing through a key keeps `null` comparable
 * without an empty-string department accidentally colliding with General —
 * the leading space in the sentinel can't appear in a trimmed department name.
 */
function deptKey(department: string | null): string {
  return department === null || department === undefined ? ' general' : department;
}

export function sameDepartment(a: string | null, b: string | null): boolean {
  return deptKey(a) === deptKey(b);
}

/** Human label for a level badge, e.g. "Manufacturing Lvl 2" / "General Lvl 1". */
export function levelBadgeLabel(department: string | null, level: number): string {
  return `${department ?? 'General'} Lvl ${level}`;
}

/** Every certification in one (department, level) set. */
export function certsInSet<T extends LeveledCert>(
  certs: T[],
  department: string | null,
  level: number,
): T[] {
  return certs.filter(c => sameDepartment(c.department, department) && c.level === level);
}

/**
 * A level set is "complete" when it holds at least one certification and the
 * user holds every one of them.
 *
 * An EMPTY set is deliberately NOT complete: there is nothing to earn, so no
 * badge is awarded. But an empty set must also not block progression, which
 * is handled separately in `isLevelUnlocked` — the two rules disagree on
 * purpose, and conflating them would either hand out badges for empty levels
 * or wall students off behind a level a coach hasn't filled in yet.
 */
export function isSetComplete<T extends LeveledCert>(
  certs: T[],
  heldIds: Set<number>,
  department: string | null,
  level: number,
): boolean {
  const set = certsInSet(certs, department, level);
  if (set.length === 0) return false;
  return set.every(c => heldIds.has(c.id));
}

/** Has this user been recorded as earning the badge for (department, level)? */
export function hasLevelBadge(
  earned: EarnedLevelBadge[],
  department: string | null,
  level: number,
): boolean {
  return earned.some(b => sameDepartment(b.department, department) && b.level === level);
}

/**
 * Can this user start certifications at (department, level)?
 *
 * Level 1 is always open. Level N is open when the user holds the RECORDED
 * Lvl N-1 badge, or when the Lvl N-1 set is empty (nothing to earn there, so
 * it cannot gate anything).
 *
 * Reading the recorded badge rather than recomputing completion is the whole
 * point: badges are written once, when earned, and never retroactively
 * stripped. So when a coach adds a NEW Lvl 1 certification after a student
 * has already moved into Lvl 2, that student keeps their Lvl 1 badge and
 * stays unlocked — the new cert simply becomes requestable. Recomputing here
 * would silently re-lock them mid-track.
 */
export function isLevelUnlocked<T extends LeveledCert>(
  certs: T[],
  department: string | null,
  level: number,
  earned: EarnedLevelBadge[],
): boolean {
  if (level <= 1) return true;
  const previous = level - 1;
  if (hasLevelBadge(earned, department, previous)) return true;
  // An unfilled previous level can't gate — but a merely INCOMPLETE one still
  // must, so only a genuinely empty set opens the door. Recursing handles a
  // run of empty levels (Lvl 1 and Lvl 2 both unfilled) leaving Lvl 3 open.
  if (certsInSet(certs, department, previous).length === 0) {
    return isLevelUnlocked(certs, department, previous, earned);
  }
  return false;
}

/** The highest level this user may currently start in a department. */
export function highestUnlockedLevel<T extends LeveledCert>(
  certs: T[],
  department: string | null,
  earned: EarnedLevelBadge[],
): number {
  let highest = 1;
  for (const level of LEVELS) {
    if (isLevelUnlocked(certs, department, level, earned)) highest = level;
  }
  return highest;
}

/**
 * Level sets this user has now completed but which aren't recorded yet.
 *
 * Only ever returns ADDITIONS. There is no removal direction by design: a
 * badge, once earned, is a historical fact and is not recomputed away when
 * the level's contents change later. That property is what makes it safe to
 * call on every certification grant.
 */
export function newlyEarnedLevelBadges<T extends LeveledCert>(
  certs: T[],
  heldIds: Set<number>,
  earned: EarnedLevelBadge[],
): EarnedLevelBadge[] {
  const out: EarnedLevelBadge[] = [];
  const seen = new Set<string>();
  for (const cert of certs) {
    const key = `${deptKey(cert.department)} ${cert.level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (hasLevelBadge(earned, cert.department, cert.level)) continue;
    if (!isSetComplete(certs, heldIds, cert.department, cert.level)) continue;
    out.push({ department: cert.department, level: cert.level });
  }
  return out;
}

/**
 * Distinct department tracks present in the certification list, General last.
 * Used to lay the Certifications page out as one section per track.
 */
export function certificationTracks<T extends LeveledCert>(certs: T[]): (string | null)[] {
  const named = new Set<string>();
  let hasGeneral = false;
  for (const c of certs) {
    if (c.department === null || c.department === undefined) hasGeneral = true;
    else named.add(c.department);
  }
  const out: (string | null)[] = [...named].sort((a, b) => a.localeCompare(b));
  if (hasGeneral) out.push(GENERAL);
  return out;
}

/** Clamp a user-supplied level into 1..MAX_LEVEL. */
export function normalizeLevel(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_LEVEL, Math.max(1, Math.trunc(n)));
}

/** Normalize a user-supplied department into a name, or General (null). */
export function normalizeDepartment(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}
