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

interface CompetitionEventDateRange {
  id?: number;
  startDate?: string | null;
  endDate?: string | null;
  archived?: boolean | null;
}

/**
 * Competition events shown in the live attendance panel may be current or
 * upcoming. A missing end date means the event is a one-day event, not an
 * event that stays active forever.
 */
export function isCompetitionEventLive(
  event: CompetitionEventDateRange,
  today: string = todayLocalStr(),
): boolean {
  if (event.archived || !event.startDate) return false;
  return (event.endDate || event.startDate) >= today;
}

function isCompetitionEventCurrent(event: CompetitionEventDateRange, today: string): boolean {
  return Boolean(
    event.startDate &&
    event.startDate <= today &&
    (event.endDate || event.startDate) >= today,
  );
}

/**
 * Return live competition events in a stable, useful selection order: an event
 * happening today first, followed by upcoming events in start-date order.
 */
export function liveCompetitionEvents<T extends CompetitionEventDateRange>(
  events: T[],
  today: string = todayLocalStr(),
): T[] {
  return events
    .filter(event => isCompetitionEventLive(event, today))
    .sort((a, b) => {
      const aCurrent = isCompetitionEventCurrent(a, today);
      const bCurrent = isCompetitionEventCurrent(b, today);
      if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;

      const byStartDate = (a.startDate || '').localeCompare(b.startDate || '');
      if (byStartDate !== 0) return byStartDate;

      const byEndDate = (a.endDate || '').localeCompare(b.endDate || '');
      if (byEndDate !== 0) return byEndDate;

      return (a.id ?? 0) - (b.id ?? 0);
    });
}

/** The team's home-base timezone before a setting exists to read it from,
 *  or as the fallback if the setting is somehow empty. Every function below
 *  defaults to this so nothing broke mid-refactor when `tz` became
 *  parameterized — but callers that care about correctness (anything server-
 *  side, and any client code with access to `useTeamSettings().settings.timezone`)
 *  should pass the real team timezone explicitly. */
export const DEFAULT_TEAM_TIMEZONE = 'America/Los_Angeles';

/**
 * Team-local `YYYY-MM-DD` for a given instant, independent of the viewer's/
 * server's own timezone. This is the bucketing the hours ledger uses
 * (`server/services/hoursLedger.ts`) — use this instead of re-deriving it, so
 * every "which day did this happen on" question agrees. Despite the name
 * (kept for compatibility with existing callers), `tz` is not hardcoded to
 * Pacific — pass the team's configured timezone.
 */
export function localDatePT(d: Date = new Date(), tz: string = DEFAULT_TEAM_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
}

/**
 * The current "team year" hours window: July 1 through June 30, team-local,
 * resetting every July 1st. Used to scope team-wide and personal hour totals
 * to the current season rather than all-time.
 */
export function teamYearRange(now: Date = new Date(), tz: string = DEFAULT_TEAM_TIMEZONE): { start: string; end: string } {
  const [y, m] = localDatePT(now, tz).split('-').map(Number); // m is 1-12
  const startYear = m >= 7 ? y : y - 1;
  return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` };
}

/**
 * Combine a `YYYY-MM-DD` date and `HH:MM` time into the correct UTC instant
 * for that wall-clock time in the team's home timezone, correctly handling
 * DST boundaries. Needed anywhere a server process (which may run in UTC)
 * must produce a real point-in-time from a team-local wall-clock time — as
 * opposed to `parseLocalDate`, whose day-only round trip happens to be
 * timezone-safe without this.
 */
export function pacificDateTime(dateStr: string, timeStr: string, tz: string = DEFAULT_TEAM_TIMEZONE): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  // Probe noon-ish UTC on the target day, read back the UTC offset the zone
  // assigns to it, and apply that offset — correct across any DST rule set,
  // not just Pacific's.
  const probe = new Date(Date.UTC(y, (mo || 1) - 1, d || 1, 20, 0, 0));
  const offsetMinutes = getUtcOffsetMinutes(tz, probe);
  return new Date(Date.UTC(y, (mo || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0) - offsetMinutes * 60000);
}

/** UTC offset (in minutes, e.g. -420 for PDT) a timezone has at a given instant. */
function getUtcOffsetMinutes(tz: string, at: Date): number {
  // en-US with a numeric-friendly formatter, then diff against a UTC render
  // of the same instant — works for any IANA zone, not just US ones with a
  // recognizable PDT/PST abbreviation.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return Math.round((asIfUtc - at.getTime()) / 60000);
}

interface RecurringEventShape {
  startDate: string;
  endDate?: string | null;
  recurrenceType?: string | null;
  recurrenceEndsOn?: string | null;
  parentEventId?: number | null;
  deletedDates?: string | null;
  recurrenceDays?: string | null;
}

/** Weekday numbers (0=Sun..6=Sat) a weekly recurrence repeats on, falling back
 *  to the start date's own weekday for rows created before multi-day support. */
export function parseRecurrenceDays(ev: Pick<RecurringEventShape, 'startDate' | 'recurrenceDays'>): number[] {
  if (ev.recurrenceDays) {
    try {
      const parsed = JSON.parse(ev.recurrenceDays);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* fall through to default */ }
  }
  return [parseLocalDate(ev.startDate).getDay()];
}

/** First date on or after `startDate` whose weekday is in `recurrenceDays` (or
 *  `startDate` itself if it already matches) — the true RFC 5545 DTSTART for a
 *  weekly series whose first selected weekday isn't the row's own startDate. */
export function firstRecurrenceOccurrence(ev: Pick<RecurringEventShape, 'startDate' | 'recurrenceDays'>): string {
  const days = new Set(parseRecurrenceDays(ev));
  let cur = parseLocalDate(ev.startDate);
  for (let i = 0; i < 7; i++) {
    if (days.has(cur.getDay())) return cur.toISOString().slice(0, 10);
    cur.setDate(cur.getDate() + 1);
  }
  return ev.startDate; // unreachable given a non-empty day set, but keeps a safe fallback
}

/**
 * Whether an event covers `date`. Weekly recurrences are stored as a single row
 * (start date + an ends-on date + a set of weekdays) and expanded on read, so a
 * recurring meeting that began months ago still occurs today.
 */
export function eventOccursOn(ev: RecurringEventShape, date: string): boolean {
  if (ev.recurrenceType === 'weekly' && ev.recurrenceEndsOn && !ev.parentEventId) {
    if (date < ev.startDate || date > ev.recurrenceEndsOn) return false;
    let deleted: string[] = [];
    if (ev.deletedDates) {
      try { deleted = JSON.parse(ev.deletedDates); } catch { deleted = []; }
    }
    if (Array.isArray(deleted) && deleted.includes(date)) return false;
    const days = parseRecurrenceDays(ev);
    return days.includes(parseLocalDate(date).getDay());
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
