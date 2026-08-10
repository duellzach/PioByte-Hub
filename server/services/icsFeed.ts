import ical, { ICalEventRepeatingFreq, ICalWeekday } from "ical-generator";
import type { CalendarEvent } from "../../shared/schema";
import { HOUR_CATEGORY_LABELS, isHourCategory } from "../../shared/hourCategories";
import { parseLocalDate, pacificDateTime } from "../../utils/dates";

// Builds an RFC 5545 (.ics) feed from a user's already visibility-filtered
// calendar events (see server/services/eventVisibility.ts — invite-only
// filtering happens before this file ever sees the rows). Only the weekly
// recurrence this app actually supports needs translating; everything else
// is a plain VEVENT.

const WEEKDAY_BY_INDEX: ICalWeekday[] = [
  ICalWeekday.SU, ICalWeekday.MO, ICalWeekday.TU, ICalWeekday.WE,
  ICalWeekday.TH, ICalWeekday.FR, ICalWeekday.SA,
];

function parseDeletedDates(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Start/end/allDay for an event row, converted to real instants. */
function eventTiming(ev: Pick<CalendarEvent, "startDate" | "endDate" | "startTime" | "endTime">) {
  const allDay = !ev.startTime;
  if (allDay) {
    const start = parseLocalDate(ev.startDate);
    // iCal all-day DTEND is exclusive — use the day after the last day covered.
    const end = parseLocalDate(ev.endDate || ev.startDate);
    end.setDate(end.getDate() + 1);
    return { start, end, allDay: true as const };
  }
  const start = pacificDateTime(ev.startDate, ev.startTime!);
  const end = ev.endTime ? pacificDateTime(ev.endDate || ev.startDate, ev.endTime) : undefined;
  return { start, end, allDay: false as const };
}

function describe(ev: CalendarEvent): string | undefined {
  const parts: string[] = [];
  if (ev.description) parts.push(ev.description);
  if (ev.location) parts.push(`Location: ${ev.location}`);
  return parts.length ? parts.join("\n\n") : undefined;
}

function categoriesFor(ev: CalendarEvent) {
  return isHourCategory(ev.type) ? [{ name: HOUR_CATEGORY_LABELS[ev.type] }] : undefined;
}

export function buildCalendarFeed(events: CalendarEvent[], teamName: string): string {
  const calendar = ical({
    name: `${teamName} Calendar`,
    timezone: "America/Los_Angeles",
    prodId: { company: "PioByte", product: "PioByte Hub Calendar Feed" },
  });

  const parents = events.filter((e) => !e.parentEventId);
  const overrides = events.filter((e) => e.parentEventId);
  const parentById = new Map(parents.map((p) => [p.id, p]));

  for (const ev of parents) {
    const { start, end, allDay } = eventTiming(ev);
    const isWeekly = ev.recurrenceType === "weekly" && !!ev.recurrenceEndsOn;

    let repeating: any;
    if (isWeekly) {
      const deleted = parseDeletedDates(ev.deletedDates);
      repeating = {
        freq: ICalEventRepeatingFreq.WEEKLY,
        byDay: [WEEKDAY_BY_INDEX[parseLocalDate(ev.startDate).getDay()]],
        until: allDay ? parseLocalDate(ev.recurrenceEndsOn!) : pacificDateTime(ev.recurrenceEndsOn!, ev.startTime!),
        // An empty array is still truthy — ical-generator would emit a blank,
        // invalid `EXDATE:` line if we always set this key. Only include it
        // when there's something to exclude.
        ...(deleted.length > 0
          ? { exclude: deleted.map((d) => (allDay ? parseLocalDate(d) : pacificDateTime(d, ev.startTime!))) }
          : {}),
      };
    }

    calendar.createEvent({
      id: `event-${ev.id}@piobyte-hub`,
      start,
      end,
      allDay,
      timezone: allDay ? undefined : "America/Los_Angeles",
      summary: ev.title,
      description: describe(ev),
      location: ev.location || undefined,
      categories: categoriesFor(ev),
      repeating,
    });
  }

  for (const ev of overrides) {
    const { start, end, allDay } = eventTiming(ev);
    const parent = parentById.get(ev.parentEventId!);
    // RECURRENCE-ID must reference the *originally scheduled* instance — the
    // parent's own time of day on this date — even if the override itself
    // moved to a different time. Falls back to the override's own time if the
    // parent isn't in this feed (e.g. visibility edge case).
    const parentAllDay = parent ? !parent.startTime : allDay;
    const recurrenceId = parent
      ? (parentAllDay ? parseLocalDate(ev.instanceDate!) : pacificDateTime(ev.instanceDate!, parent.startTime!))
      : (allDay ? parseLocalDate(ev.instanceDate!) : pacificDateTime(ev.instanceDate!, ev.startTime || "00:00"));

    calendar.createEvent({
      id: `event-${ev.parentEventId}@piobyte-hub`,
      recurrenceId,
      start,
      end,
      allDay,
      timezone: allDay ? undefined : "America/Los_Angeles",
      summary: ev.title,
      description: describe(ev),
      location: ev.location || undefined,
      categories: categoriesFor(ev),
    });
  }

  return calendar.toString();
}
