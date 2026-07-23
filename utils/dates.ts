// Helpers for working with date-only strings (YYYY-MM-DD) without timezone drift.
//
// The bug these solve: `new Date("2026-07-18")` parses as UTC midnight, which is
// the previous evening in any timezone behind UTC — so a task due 2026-07-18 would
// render as "Jul 17" for a Pacific viewer. And `new Date().toISOString().slice(0,10)`
// yields the UTC date, which is already "tomorrow" late in the day in the Americas.
// Always route date-only values through these helpers.

/** Parse a `YYYY-MM-DD` string as LOCAL midnight (no UTC shift). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Today's date as a local `YYYY-MM-DD` string (not the UTC date). */
export function todayLocalStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface RecurringEventShape {
  startDate: string;
  endDate?: string | null;
  recurrenceType?: string | null;
  recurrenceEndsOn?: string | null;
  parentEventId?: number | null;
  deletedDates?: string | null;
}

/**
 * Whether an event covers `date`. Weekly recurrences are stored as a single row
 * (start date + an ends-on date) and expanded on read, so a recurring meeting
 * that began months ago still occurs today.
 */
export function eventOccursOn(ev: RecurringEventShape, date: string): boolean {
  if (ev.recurrenceType === 'weekly' && ev.recurrenceEndsOn && !ev.parentEventId) {
    if (date < ev.startDate || date > ev.recurrenceEndsOn) return false;
    let deleted: string[] = [];
    if (ev.deletedDates) {
      try { deleted = JSON.parse(ev.deletedDates); } catch { deleted = []; }
    }
    if (Array.isArray(deleted) && deleted.includes(date)) return false;
    // Same weekday cadence as the first occurrence.
    const start = parseLocalDate(ev.startDate);
    const target = parseLocalDate(date);
    const days = Math.round((target.getTime() - start.getTime()) / 86400000);
    return days >= 0 && days % 7 === 0;
  }
  return ev.startDate <= date && (ev.endDate || ev.startDate) >= date;
}

/** Format a `YYYY-MM-DD` date-only string for display in the viewer's local zone. */
export function formatLocalDate(
  dateStr: string,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  return parseLocalDate(dateStr).toLocaleDateString([], opts);
}
