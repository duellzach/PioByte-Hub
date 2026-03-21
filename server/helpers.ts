import { storage } from "./storage";

export const COACH_CAPTAIN = ['Coach', 'Team Captain'];
export const COACH_CAPTAIN_DEPT_HEAD = ['Coach', 'Team Captain', 'Department Head'];
export const COACH_CAPTAIN_TRAINER = ['Coach', 'Team Captain', 'Safety Trainer'];
export const TRAINER_COACH = ['Safety Trainer', 'Coach'];

export async function getUserRoles(userId: number): Promise<string[]> {
  const user = await storage.getUser(userId);
  return user ? (user.roles as string[]) : [];
}

export function hasAnyRole(userRoles: string[], allowedRoles: string[]): boolean {
  return userRoles.some(r => allowedRoles.includes(r));
}

export function roundToQuarterHour(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

const TBA_BASE = "https://www.thebluealliance.com/api/v3";
export const TBA_KEY = process.env.TBA_API_KEY || "";

export async function tbaFetch(path: string) {
  const resp = await fetch(`${TBA_BASE}${path}`, {
    headers: { "X-TBA-Auth-Key": TBA_KEY },
  });
  if (!resp.ok) throw new Error(`TBA API error: ${resp.status}`);
  return resp.json();
}

const NEXUS_BASE = "https://frc.nexus/api/v1";

export async function nexusFetch(path: string) {
  const key = process.env.NEXUS_API_KEY;
  if (!key) {
    throw new Error("NEXUS_API_KEY environment variable is not configured");
  }
  const resp = await fetch(`${NEXUS_BASE}${path}`, {
    headers: { "Nexus-Api-Key": key },
  });
  if (!resp.ok) {
    const err: any = new Error(`Nexus API error: ${resp.status} ${resp.statusText}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}
