import { AttendanceError, attendanceMinutes } from "./competitionSessionRules";

export type ReviewDecisions = {departure?: "calendar" | "scout"; switch?: "preserve" | "merge"; zero?: "keep" | "remove"};
export const FIRST_CHANCE_GROUPS = [
  {key: "duplicate-a", ids: [2495, 2496], title: "Two check-ins for the same full-day visit"},
  {key: "duplicate-b", ids: [2489, 2492], title: "Two check-ins for the same full-day visit"},
  {key: "departure", ids: [2493, 2494], title: "Verify the departure time (checkouts differ)"},
  {key: "switch", ids: [2487, 2503], title: "Preserve the attendance while reviewing separate rounding"},
  {key: "zero", ids: [2499, 2504], title: "Review the extra 15 minutes; preserve the later visit"},
] as const;
type Row = {id: number; userId: number; status: string; roundedMinutes: number | null; checkInAt: Date | string; checkOutAt: Date | string | null};
export const credited = (e: Row) => e.status === "completed" ? e.roundedMinutes || 0 : 0;
export function validateDecisions(d: ReviewDecisions, required = false) {
  for (const [key, values] of Object.entries({departure: ["calendar", "scout"], switch: ["preserve", "merge"], zero: ["keep", "remove"]})) {
    if ((required || d[key] !== undefined) && !values.includes(d[key])) throw new AttendanceError(`Resolve the ${key} review before applying`, 400);
  }
}
export function firstChanceChanges(rows: Row[], d: ReviewDecisions) {
  validateDecisions(d);
  const byId = new Map(rows.map(e => [e.id, e]));
  const changes: {id: number; status: string; roundedMinutes?: number; checkInAt?: Date; checkOutAt?: Date}[] = [];
  for (const g of FIRST_CHANCE_GROUPS) {
    const a = byId.get(g.ids[0]), b = byId.get(g.ids[1]);
    if (!a || !b || a.userId !== b.userId) throw new AttendanceError("FIRST Chance records changed or are missing. Review the originals before correcting");
    if (a.status !== "completed" || b.status !== "completed" || !a.checkOutAt || !b.checkOutAt) throw new AttendanceError("All reviewed sessions must still be completed; no partial correction will be applied");
    if (g.key.startsWith("duplicate") || g.key === "departure") {
      const startDifference = Math.abs(new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());
      const overlap = Math.min(new Date(a.checkOutAt).getTime(), new Date(b.checkOutAt).getTime()) - Math.max(new Date(a.checkInAt).getTime(), new Date(b.checkInAt).getTime());
      if (startDifference > 60_000 || overlap < 4 * 60 * 60_000) throw new AttendanceError("The original full-day duplicate evidence changed; no correction was applied");
      const selected = g.key === "departure" && d.departure === "scout" ? b : a;
      changes.push({id: a.id, status: "completed", roundedMinutes: credited(selected), checkOutAt: new Date(selected.checkOutAt!)});
      changes.push({id: b.id, status: "rejected"});
    } else if (g.key === "switch" && d.switch === "merge") {
      if (Math.abs(new Date(a.checkOutAt).getTime() - new Date(b.checkInAt).getTime()) > 60_000) throw new AttendanceError("The switch is no longer uninterrupted. Preserve the separate visits");
      const start = new Date(Math.min(new Date(a.checkInAt).getTime(), new Date(b.checkInAt).getTime()));
      const end = new Date(Math.max(new Date(a.checkOutAt).getTime(), new Date(b.checkOutAt).getTime()));
      changes.push({id: a.id, status: "completed", checkInAt: start, checkOutAt: end, roundedMinutes: attendanceMinutes(start, end)});
      changes.push({id: b.id, status: "rejected"});
    } else if (g.key === "zero" && d.zero === "remove") {
      if (new Date(a.checkInAt).getTime() !== new Date(a.checkOutAt).getTime()) throw new AttendanceError("The first visit is no longer zero-length. Review its real attendance instead");
      changes.push({id: a.id, status: "rejected"});
    }
  }
  return changes;
}
