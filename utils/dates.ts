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

/** Format a `YYYY-MM-DD` date-only string for display in the viewer's local zone. */
export function formatLocalDate(
  dateStr: string,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  return parseLocalDate(dateStr).toLocaleDateString([], opts);
}
