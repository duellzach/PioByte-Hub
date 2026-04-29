import { useTeamSettings } from '../contexts/TeamSettingsContext';

export const TIMEZONE_OPTIONS = [
  { label: 'Eastern Time (ET)',       value: 'America/New_York' },
  { label: 'Central Time (CT)',        value: 'America/Chicago' },
  { label: 'Mountain Time (MT)',       value: 'America/Denver' },
  { label: 'Mountain Time – AZ (no DST)', value: 'America/Phoenix' },
  { label: 'Pacific Time (PT)',        value: 'America/Los_Angeles' },
  { label: 'Alaska Time (AKT)',        value: 'America/Anchorage' },
  { label: 'Hawaii Time (HT)',         value: 'America/Honolulu' },
  { label: 'UTC',                      value: 'UTC' },
  { label: 'Central European Time',   value: 'Europe/Berlin' },
  { label: 'Israel Standard Time',    value: 'Asia/Jerusalem' },
  { label: 'Australia/Sydney',        value: 'Australia/Sydney' },
];

export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

export function makeFormatters(tz: string) {
  const safeDate = (d: Date | number | string) => new Date(d);

  const fmtTime = (date: Date | number | string) =>
    safeDate(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz });

  const fmtTime24 = (date: Date | number | string) =>
    safeDate(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });

  const fmtDate = (date: Date | number | string) =>
    safeDate(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });

  const fmtDateOnly = (date: Date | number | string) =>
    safeDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz });

  const fmtDateShort = (date: Date | number | string) =>
    safeDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz });

  const fmtDateTime = (date: Date | number | string) =>
    safeDate(date).toLocaleString('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const fmtFull = (date: Date | number | string) =>
    safeDate(date).toLocaleString([], { timeZone: tz });

  const toLocalInputString = (date: Date | number | string): string => {
    const d = safeDate(date);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  };

  const localInputToISO = (localStr: string): string => {
    if (!localStr) return '';
    const datePart = localStr.slice(0, 10);
    const ref = new Date(datePart + 'T20:00:00Z');
    const tzOffset = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, timeZoneName: 'shortOffset',
    }).formatToParts(ref).find(p => p.type === 'timeZoneName')?.value || 'GMT+0';
    const match = tzOffset.match(/GMT([+-]\d+)(?::(\d+))?/);
    if (!match) return new Date(localStr).toISOString();
    const sign = match[1].startsWith('-') ? '-' : '+';
    const hh = Math.abs(parseInt(match[1])).toString().padStart(2, '0');
    const mm = (match[2] || '00').padStart(2, '0');
    return new Date(`${localStr}:00${sign}${hh}:${mm}`).toISOString();
  };

  const fmtMonthShort = (date: Date | number | string) =>
    safeDate(date).toLocaleDateString([], { month: 'short', timeZone: tz });

  const fmtDayNum = (date: Date | number | string) =>
    safeDate(date).toLocaleDateString([], { day: 'numeric', timeZone: tz });

  const fmtWeekdayShort = (date: Date | number | string) =>
    safeDate(date).toLocaleDateString([], { weekday: 'short', timeZone: tz });

  const fmtDateLong = (date: Date | number | string) =>
    safeDate(date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });

  const fmtDateMedium = (date: Date | number | string) =>
    safeDate(date).toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', timeZone: tz });

  const tzAbbr = (): string => {
    const ref = new Date();
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz, timeZoneName: 'short',
    }).formatToParts(ref).find(p => p.type === 'timeZoneName')?.value || tz;
  };

  return { fmtTime, fmtTime24, fmtDate, fmtDateOnly, fmtDateShort, fmtDateTime, fmtFull, fmtMonthShort, fmtDayNum, fmtWeekdayShort, fmtDateLong, fmtDateMedium, toLocalInputString, localInputToISO, tzAbbr, tz };
}

export function useTimeFormatters() {
  const { settings } = useTeamSettings();
  const tz = settings.timezone || DEFAULT_TIMEZONE;
  return makeFormatters(tz);
}
