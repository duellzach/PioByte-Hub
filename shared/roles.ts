// The single source of truth for role groups that BOTH sides check, so a gate
// rendered on the client can never drift from the gate enforced on the server.
//
// That drift is not hypothetical: the Time page's "Retask" button was gated on
// Coach/Captain while `PATCH /time-entries/:id/set-working-on` accepted the
// wider set below, so Department Heads and SCRUM Masters held a permission with
// no button to reach it. Import from here rather than re-typing a role array —
// same reasoning as shared/hourCategories.ts.
//
// Keep this file dependency-free: it is imported by both the browser bundle and
// the server, so it must not pull in `storage`, `db`, or anything Node-only.

/**
 * The union of every role that acts as "leadership" somewhere in the app.
 *
 * `eventSignups.ts`'s LEADERSHIP (Coach/Captain/SCRUM Master) and
 * `helpers.ts`'s COACH_CAPTAIN_DEPT_HEAD (Coach/Captain/Dept Head) disagreed on
 * who counts — this is the combined set, used where the distinction matters
 * (who can see an invite-only event; who can move another member onto a task).
 *
 * Values are the role STRINGS as stored on `users.roles` and mirrored by the
 * `Role` enum in types.ts — keep the two in step.
 */
export const LEADERSHIP_ALL = ['Coach', 'Team Captain', 'Department Head', 'SCRUM Master'];

/** Whether any of a user's roles falls in `allowed`. Mirrors server helpers' `hasAnyRole`. */
export const hasAnyRole = (userRoles: readonly string[] = [], allowed: readonly string[]): boolean =>
  userRoles.some((r) => allowed.includes(r));
