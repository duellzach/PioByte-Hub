import { useTeamSettings } from '../contexts/TeamSettingsContext';
import { DEFAULT_TEAM_TIMEZONE } from './dates';

// Display rule for real points in time (check-in stamps, notification/comment
// timestamps, audit logs, etc — as opposed to wall-clock DATE labels like a
// calendar grid cell, which utils/dates.ts#parseLocalDate already handles
// correctly and should keep using the viewer's own local-noon trick with NO
// timeZone option, never this module):
//
//   - Always show the VIEWER'S OWN device time — what their phone/laptop
//     already believes "now" looks like, no surprises.
//   - When the viewer's device timezone actually differs from the team's
//     home base (traveling to a competition, a remote volunteer, etc), show
//     the home-base time in parentheses too, e.g. "11:30 AM (8:30 AM PDT)".
//   - When they match, show just the plain time — no redundant parenthetical.
//
// This is the client-side half of the timezone refactor; team_settings.timezone
// (via useTeamSettings()) is the single source of truth for "home base",
// read by useTeamTime() below.

/** The viewer's own device/browser timezone, IANA form. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TEAM_TIMEZONE;
  } catch {
    return DEFAULT_TEAM_TIMEZONE;
  }
}

/** UTC offset (in minutes) a timezone has at a given instant — DST-correct. */
function utcOffsetMinutes(tz: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  const asIfUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return Math.round((asIfUtc - at.getTime()) / 60000);
}

/**
 * Whether the viewer's device is currently in a different UTC offset than
 * `homeTz`, at the given instant. Compares actual offsets rather than zone
 * NAMES, so e.g. "US/Pacific" vs "America/Los_Angeles" (same civil time,
 * different IANA identifier) never produces a spurious "away" label.
 */
export function isAwayFromHome(homeTz: string, at: Date = new Date()): boolean {
  return utcOffsetMinutes(homeTz, at) !== utcOffsetMinutes(deviceTimezone(), at);
}

/** Short zone abbreviation ("PDT", "PST", "EST"...) for a timezone at an instant. */
export function tzAbbrev(tz: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(at).find((p) => p.type === 'timeZoneName');
  return part?.value || '';
}

const toDate = (value: Date | string | number): Date => (value instanceof Date ? value : new Date(value));

/**
 * Format an absolute instant in the viewer's device timezone, with the home
 * timezone shown in parentheses whenever they differ. `opts` is a plain
 * Intl.DateTimeFormatOptions — pass only the date/time fields you want
 * (e.g. `{ hour: '2-digit', minute: '2-digit' }` for time-only), same as the
 * `timeZone`-hardcoded calls this replaces used to.
 */
export function formatInstant(
  value: Date | string | number,
  opts: Intl.DateTimeFormatOptions,
  homeTz: string,
): string {
  const at = toDate(value);
  const deviceTz = deviceTimezone();
  const deviceStr = at.toLocaleString([], { ...opts, timeZone: deviceTz });
  if (!isAwayFromHome(homeTz, at)) return deviceStr;
  const homeStr = at.toLocaleString([], { ...opts, timeZone: homeTz });
  return `${deviceStr} (${homeStr} ${tzAbbrev(homeTz, at)})`;
}

const DEFAULT_TIME_OPTS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const DEFAULT_DATE_OPTS: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const DEFAULT_DATETIME_OPTS: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };

/**
 * Bound formatters against the team's home timezone (from settings), for
 * formatting absolute instants — check-in times, notification/comment
 * timestamps, audit log entries, etc. Do NOT use this for wall-clock date
 * LABELS (calendar grid headers, "this event runs Aug 10–12") — those are
 * not instants and belong on utils/dates.ts#formatLocalDate instead.
 */
export function useTeamTime() {
  const { settings } = useTeamSettings();
  const homeTz = settings.timezone || DEFAULT_TEAM_TIMEZONE;

  return {
    homeTz,
    isAway: (at?: Date) => isAwayFromHome(homeTz, at),
    fmtTime: (value: Date | string | number, opts: Intl.DateTimeFormatOptions = DEFAULT_TIME_OPTS) =>
      formatInstant(value, opts, homeTz),
    fmtDate: (value: Date | string | number, opts: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTS) =>
      formatInstant(value, opts, homeTz),
    fmtDateTime: (value: Date | string | number, opts: Intl.DateTimeFormatOptions = DEFAULT_DATETIME_OPTS) =>
      formatInstant(value, opts, homeTz),
  };
}
