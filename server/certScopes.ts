// Training authority: who may sign off which certifications.
//
// This replaces the old implicit rule ("carries the Safety Trainer role AND
// holds the certification themselves") with explicit `trainer_scopes` rows.

import { storage } from "./storage";
import { sameDepartment } from "../shared/certifications";

export interface Scope {
  department: string | null; // null = the General category
  maxLevel: number;
}

export interface Authority {
  bypass: boolean;
  scopes: Scope[];
}

/** Does any scope cover this certification's (department, level)? */
export function scopeCovers(
  scopes: Scope[],
  cert: { department: string | null; level: number },
): boolean {
  return scopes.some(s => sameDepartment(s.department, cert.department) && s.maxLevel >= cert.level);
}

/**
 * Resolve what a user is allowed to train.
 *
 * Coaches bypass scopes entirely: they define the scopes in the first place and
 * are the account of last resort, so making them self-scope in every department
 * to unblock a queue would be pure friction.
 *
 * Team Captains deliberately do NOT bypass. That matches today's behavior —
 * `TRAINER_COACH` already excludes captains from claiming and completing
 * requests, even though `COACH_CAPTAIN_TRAINER` lets them see the queue — and
 * it matches the premise of scopes, which is that sign-off authority comes from
 * demonstrated competence rather than the org chart. A captain who trains gets
 * a scope row like anyone else.
 *
 * Roles are read from the DATABASE rather than `req.userRoles`, because session
 * JWTs carry a 30-day snapshot that can predate the Safety Trainer -> Trainer
 * rename (see MemberToken in server/security.ts).
 */
export async function trainerAuthority(userId: number): Promise<Authority> {
  const user = await storage.getUser(userId);
  const roles = user ? (user.roles as string[]) : [];
  if (roles.includes("Coach")) return { bypass: true, scopes: [] };
  const rows = await storage.getTrainerScopes(userId);
  return {
    bypass: false,
    scopes: rows.map(r => ({ department: r.department, maxLevel: r.maxLevel })),
  };
}

/** Human-readable denial, e.g. "Manufacturing Lvl 2". */
export function scopeDenial(cert: { department: string | null; level: number }): string {
  return `Your training scope doesn't cover ${cert.department ?? "General"} Lvl ${cert.level}.`;
}
