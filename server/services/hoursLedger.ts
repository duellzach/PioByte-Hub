import { storage } from "../storage";
import { HOUR_CATEGORIES, type HourCategory } from "../../shared/hourCategories";

// The one place that answers "what counts as earned hours". Two systems record
// time — the shared clock (`time_entries`) and competition check-ins — and both
// normalize into the same row shape here so requirements, dashboards and
// exports never have to know which table a row came from.

export interface LedgerRow {
  userId: number;
  category: HourCategory;
  minutes: number;
  date: string; // YYYY-MM-DD, team-local
  source: "time_entry" | "competition_checkin";
  sourceId: number;
  occurredAt: Date;
}

const localDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);

export async function getLedgerRows(userId?: number): Promise<LedgerRow[]> {
  const [timeEntries, checkins] = await Promise.all([
    storage.getTimeEntries(),
    userId
      ? storage.getCompetitionCheckinsByUser(userId)
      : storage.getAllCompetitionCheckins(),
  ]);

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
      date: localDate(checkInAt),
      source: "time_entry",
      sourceId: e.id,
      occurredAt: checkInAt,
    });
  }

  for (const c of checkins as any[]) {
    if (c.status !== "approved" || !c.roundedMinutes) continue;
    const checkInAt = new Date(c.checkInAt);
    rows.push({
      userId: c.userId,
      category: "competition",
      minutes: c.roundedMinutes,
      date: localDate(checkInAt),
      source: "competition_checkin",
      sourceId: c.id,
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

/** Per-user category totals, keyed by user id. */
export async function getTotalsByUser(): Promise<Record<number, CategoryTotals>> {
  const rows = await getLedgerRows();
  const byUser: Record<number, CategoryTotals> = {};
  for (const r of rows) {
    if (!byUser[r.userId]) byUser[r.userId] = emptyTotals();
    byUser[r.userId][r.category] += r.minutes;
    byUser[r.userId].total += r.minutes;
  }
  return byUser;
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
