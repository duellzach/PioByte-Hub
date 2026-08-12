import { storage } from "../storage";
import { DEFAULT_TEAM_TIMEZONE } from "../../utils/dates";

// The team's home-base timezone, cached in-process so the date helpers that
// need it (hours-day bucketing, the calendar feed, bulk-add's "9 AM" anchor)
// don't all have to become async DB calls on every invocation. Call
// invalidateTeamTimezoneCache() after any write that can change
// team_settings.timezone — currently only PUT /settings and POST
// /settings/reset (server/routes/settings.ts).

let cached: string | null = null;

export async function getTeamTimezone(): Promise<string> {
  if (cached) return cached;
  try {
    const settings = await storage.getTeamSettings();
    cached = (settings as any).timezone || DEFAULT_TEAM_TIMEZONE;
  } catch {
    // Don't let a transient DB hiccup take down every date-formatting call —
    // fall back to the default and let the next call retry the DB.
    return DEFAULT_TEAM_TIMEZONE;
  }
  return cached!;
}

export function invalidateTeamTimezoneCache(): void {
  cached = null;
}
