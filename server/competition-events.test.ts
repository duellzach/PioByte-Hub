/**
 * Regression tests for the date rule used by the live Competition Attendance
 * panel. No database or test framework is required:
 *
 *   node_modules/.bin/tsx server/competition-events.test.ts
 */
import assert from "node:assert/strict";
import { liveCompetitionEvents } from "../utils/dates";

const TODAY = "2026-08-28";
const events = [
  { id: 1, name: "Old one-day event", startDate: "2026-04-18", endDate: null, archived: false },
  { id: 2, name: "Multi-day event", startDate: "2026-08-27", endDate: "2026-08-29", archived: false },
  { id: 3, name: "Future event", startDate: "2026-09-12", endDate: null, archived: false },
  { id: 4, name: "Archived future event", startDate: "2026-09-20", endDate: null, archived: true },
];

const live = liveCompetitionEvents(events, TODAY);

assert.deepEqual(
  live.map(event => event.id),
  [2, 3],
  "past one-day and archived events must not be available for live attendance",
);

assert.equal(
  live.find(event => event.id === 2)?.name,
  "Multi-day event",
  "a multi-day event remains available through its end date",
);

const checkins = [
  { id: 101, eventId: 1, status: "pending_approval" },
  { id: 102, eventId: 2, status: "checked_in" },
];
const visibleCheckins = checkins.filter(checkin => live.some(event => event.id === checkin.eventId));
assert.deepEqual(
  visibleCheckins.map(checkin => checkin.id),
  [102],
  "attendance records for past events must not appear in the live panel",
);

const currentAndFuture = liveCompetitionEvents([
  { id: 5, name: "Future first in API order", startDate: "2026-09-01", endDate: null, archived: false },
  { id: 6, name: "Current event", startDate: "2026-08-28", endDate: null, archived: false },
], TODAY);
assert.deepEqual(
  currentAndFuture.map(event => event.id),
  [6, 5],
  "the current event must be selected before future events regardless of API order",
);

console.log("competition event date tests: all assertions passed");