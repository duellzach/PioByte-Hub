import { storage } from "../storage";
import { HOUR_CATEGORIES, type HourCategory } from "../../shared/hourCategories";
import { localDatePT } from "../../utils/dates";
import { getTeamTimezone } from "./teamTime";

// The one place that answers "what counts as earned hours". `time_entries` is
// the single source — shop time, event-clocked time (meeting/volunteer/
// outreach/class/fundraising), and competition time (kind='competition',
// scoutEventId set — see server/routes/competition.ts) all live there.
// competition_checkins is legacy: it predates the unification and is no
// longer read anywhere; see storage.ensureCompetitionUnification for the
// one-time backfill that moved its rows into time_entries.

export interface LedgerRow {
  userId: number;
  category: HourCategory;
  minutes: number;
  date: string; // YYYY-MM-DD, team-local
  source: "time_entry";
  sourceId: number;
  occurredAt: Date;
}

export async function getLedgerRows(userId?: number): Promise<LedgerRow[]> {
  const [timeEntries, tz] = await Promise.all([storage.getTimeEntries(), getTeamTimezone()]);

  const rows: LedgerRow[] = [];

  for (const e of timeEntries as any[]) {
    if (userId && e.userId !== userId) continue;
    if (e.status !== "completed" || !e.roundedMinutes) continue;
    const category = (HOUR_CATEGORIES as readonly string[]).includes(e.kind) ? e.kind : "shop";
    const checkInAt = new Date(e.checkInAt);
    rows.push({
      userId: e.userId,
      category,
      minutes: e.roundedMinutes,
      // Bucketed by the TEAM's home timezone regardless of viewer — this is
      // a business rule (what day did this count toward), not a display choice.
      date: localDatePT(checkInAt, tz),
      source: "time_entry",
      sourceId: e.id,
      occurredAt: checkInAt,
    });
  }

  return rows.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

export type CategoryTotals = Record<HourCategory, number> & { total: number };

const emptyTotals = (): CategoryTotals => {
  const totals: any = { total: 0 };
  for (const c of HOUR_CATEGORIES) totals[c] = 0;
  return totals;
};

export const totalsFromRows = (rows: LedgerRow[]): CategoryTotals => {
  const totals = emptyTotals();
  for (const r of rows) {
    totals[r.category] += r.minutes;
    totals.total += r.minutes;
  }
  return totals;
};

const inWindow = (r: LedgerRow, start: string | null, end: string | null) =>
  (!start || r.date >= start) && (!end || r.date <= end);

/** Per-user category totals, keyed by user id. Optionally scoped to a date window. */
export async function getTotalsByUser(
  start: string | null = null,
  end: string | null = null,
): Promise<Record<number, CategoryTotals>> {
  const rows = await getLedgerRows();
  const byUser: Record<number, CategoryTotals> = {};
  for (const r of rows) {
    if (!inWindow(r, start, end)) continue;
    if (!byUser[r.userId]) byUser[r.userId] = emptyTotals();
    byUser[r.userId][r.category] += r.minutes;
    byUser[r.userId].total += r.minutes;
  }
  return byUser;
}

/** Team-wide category totals (everyone summed together), scoped to a date window. */
export async function getTeamTotals(
  start: string | null = null,
  end: string | null = null,
): Promise<CategoryTotals> {
  const rows = await getLedgerRows();
  return totalsFromRows(rows.filter((r) => inWindow(r, start, end)));
}

/** Minutes a user earned in the given categories within an optional date window. */
export const sumMinutes = (
  rows: LedgerRow[],
  categories: string[],
  start: string | null,
  end: string | null,
) =>
  rows
    .filter((r) => categories.includes(r.category))
    .filter((r) => (!start || r.date >= start) && (!end || r.date <= end))
    .reduce((sum, r) => sum + r.minutes, 0);
