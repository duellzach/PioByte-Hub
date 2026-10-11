import { Router } from "express";
import crypto from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { calendarEvents, scoutEvents, timeEntries, timeEntryAudit, users } from "../../shared/schema";
import { requireRoles } from "../middleware/auth";
import { AttendanceError, lockAttendance, mirrorRoster } from "../services/competitionSessions";
import { attendanceMinutes, validReason } from "../services/competitionSessionRules";
import { FIRST_CHANCE_GROUPS, credited, firstChanceChanges, validateDecisions, type ReviewDecisions } from "../services/firstChanceRules";
import { localDatePT } from "../../utils/dates";
import { getTeamTimezone } from "../services/teamTime";

const router = Router();
router.use("/competition-attendance", requireRoles("Coach"));
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const scope = {calendarEventId: 55, scoutEventId: 13, date: "2026-10-04", title: "FIRST Chance"};
const correctionAction = "first_chance_correction";

async function lockLinks(tx: Tx) { await tx.execute(sql`SELECT pg_advisory_xact_lock(96195, 1)`); }
async function setLink(tx: Tx, calendarEventId: number, scoutEventId: number, actorId: number) {
  const [calendar] = await tx.select().from(calendarEvents).where(eq(calendarEvents.id, calendarEventId));
  const [scout] = await tx.select().from(scoutEvents).where(eq(scoutEvents.id, scoutEventId));
  if (!calendar || calendar.type !== "competition" || !scout) throw new AttendanceError("Competition events not found", 404);
  if (calendar.recurrenceType) throw new AttendanceError("Link individual competition dates, not a recurring calendar series", 400);
  if (calendar.startDate !== scout.startDate || (calendar.endDate || calendar.startDate) !== (scout.endDate || scout.startDate)) throw new AttendanceError("Calendar and scouting date ranges must agree before linking", 400);
  if (calendar.scoutEventId && calendar.scoutEventId !== scout.id) throw new AttendanceError("This calendar already has a different competition identity; it cannot be silently reassigned");
  const linked = await tx.select().from(calendarEvents).where(eq(calendarEvents.scoutEventId, scout.id));
  if (linked.some(c => c.id !== calendar.id)) throw new AttendanceError("This scouting event already has a calendar link");
  await tx.update(calendarEvents).set({scoutEventId: scout.id}).where(eq(calendarEvents.id, calendar.id));
  // Historical records are linked only by the reviewed correction, never here.
  return {calendarEventId: calendar.id, scoutEventId: scout.id};
}

router.get("/competition-attendance/manage", async (_req, res) => {
  try {
    const [calendars, scouts] = await Promise.all([db.select().from(calendarEvents).where(eq(calendarEvents.type, "competition")), db.select().from(scoutEvents)]);
    res.json({calendars: calendars.map(c => ({id: c.id, title: c.title, startDate: c.startDate, endDate: c.endDate, scoutEventId: c.scoutEventId})), scouts: scouts.map(s => ({id: s.id, name: s.name, startDate: s.startDate, endDate: s.endDate}))});
  } catch (error) { fail(res, error); }
});
router.put("/competition-attendance/links", async (req, res) => {
  try {
    const calendarId = Number(req.body.calendarEventId), scoutId = Number(req.body.scoutEventId);
    if (!Number.isInteger(calendarId) || !Number.isInteger(scoutId)) throw new AttendanceError("Select both events", 400);
    res.json(await db.transaction(async tx => { await lockLinks(tx); return setLink(tx, calendarId, scoutId, req.userId!); }));
  } catch (error) { fail(res, error); }
});

async function loadReview(tx: Tx, tz: string, decisions: ReviewDecisions = {}) {
  validateDecisions(decisions);
  const [calendar] = await tx.select().from(calendarEvents).where(eq(calendarEvents.id, scope.calendarEventId));
  const [scout] = await tx.select().from(scoutEvents).where(eq(scoutEvents.id, scope.scoutEventId));
  if (!calendar || !scout || calendar.title !== scope.title || scout.name !== scope.title || calendar.startDate !== scope.date || scout.startDate !== scope.date) throw new AttendanceError("This correction is only for the verified FIRST Chance on October 4, 2026");
  const all = await tx.select().from(timeEntries).where(and(eq(timeEntries.kind, "competition"), or(eq(timeEntries.calendarEventId, scope.calendarEventId), eq(timeEntries.scoutEventId, scope.scoutEventId)))).orderBy(timeEntries.id);
  const rows = all.filter(e => localDatePT(e.checkInAt, tz) === scope.date);
  const audits = rows.length ? await tx.select().from(timeEntryAudit).where(inArray(timeEntryAudit.entryId, rows.map(e => e.id))).orderBy(timeEntryAudit.id) : [];
  const applied = audits.some(a => a.actionType === correctionAction);
  if (applied) decisions = audits.find(a => a.actionType === correctionAction)?.newValues?.decisions || decisions;
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({rows, audits, link: calendar.scoutEventId})).digest("hex");
  const members = await tx.select({id: users.id, name: users.name}).from(users);
  const names = new Map(members.map(u => [u.id, u.name]));
  const before = new Map<number, number>();
  const baselineRows = applied ? rows.map(row => {
    const original = audits.find(a => a.entryId === row.id && a.actionType === correctionAction)?.previousValues;
    return original ? {...row, ...original} : row;
  }) : rows;
  for (const row of baselineRows) before.set(row.userId, (before.get(row.userId) || 0) + credited(row));
  const changes = applied ? [] : firstChanceChanges(rows, decisions);
  const after = new Map<number, number>();
  for (const row of rows) after.set(row.userId, (after.get(row.userId) || 0) + credited(row));
  for (const change of changes) {
    const prev = rows.find(e => e.id === change.id)!;
    after.set(prev.userId, (after.get(prev.userId) || 0) + credited({...prev, ...change}) - credited(prev));
  }
  const cases = FIRST_CHANCE_GROUPS.map(g => {
    const entries = g.ids.map(id => baselineRows.find(e => e.id === id)).filter(Boolean);
    if (entries.length !== 2) throw new AttendanceError("A reviewed record is missing; this correction cannot proceed");
    const [a, b] = entries;
    const options = g.key === "departure" ? [
      {value: "calendar", label: "Calendar checkout — verify the later departure", afterMinutes: a!.roundedMinutes || 0},
      {value: "scout", label: "Scouting checkout — verify the earlier departure", afterMinutes: b!.roundedMinutes || 0},
    ] : g.key === "switch" ? [
      {value: "preserve", label: "Keep separately rounded visits", afterMinutes: credited(a!) + credited(b!)},
      {value: "merge", label: "One uninterrupted visit; round once", afterMinutes: attendanceMinutes(a!.checkInAt, b!.checkOutAt!)},
    ] : g.key === "zero" ? [
      {value: "keep", label: "Keep the extra credit as an intentional adjustment", afterMinutes: credited(a!) + credited(b!)},
      {value: "remove", label: "Remove only the zero-length session's extra credit", afterMinutes: credited(b!)},
    ] : [{value: "single", label: "Keep one full-day credit; reject the redundant credit", afterMinutes: credited(a!)}];
    return {key: g.key, title: g.title, userId: a!.userId, userName: names.get(a!.userId) || `Member ${a!.userId}`, entries, audits: audits.filter(audit => (g.ids as readonly number[]).includes(audit.entryId)), options};
  });
  return {fingerprint, applied, event: scope, beforeMinutes: [...before.values()].reduce((a,b) => a+b,0),
    memberTotals: [...before].map(([userId,beforeMinutes]) => ({userId,userName: names.get(userId) || `Member ${userId}`,beforeMinutes})),
    cases, decisions, afterMinutes: [...after.values()].reduce((a,b) => a+b,0),
    afterMemberTotals: [...before].map(([userId,beforeMinutes]) => ({userId,userName: names.get(userId) || `Member ${userId}`,beforeMinutes,afterMinutes: after.get(userId)!})),
    rows, changes};
}
function publicPreview(review: Awaited<ReturnType<typeof loadReview>>) {
  const {rows, changes, ...preview} = review;
  return preview;
}
function fail(res: any, error: unknown) {
  if (error instanceof AttendanceError) return res.status(error.status).json({error: error.message});
  console.error("Competition attendance:", error);
  return res.status(500).json({error: "Competition attendance request failed; no correction was applied"});
}
router.get("/competition-attendance/first-chance/preview", async (req, res) => {
  try { const tz = await getTeamTimezone(); res.json(publicPreview(await db.transaction(tx => loadReview(tx, tz)))); } catch (error) { fail(res, error); }
});
router.post("/competition-attendance/first-chance/preview", async (req, res) => {
  try { const tz = await getTeamTimezone(); res.json(publicPreview(await db.transaction(tx => loadReview(tx, tz, req.body.decisions || {})))); } catch (error) { fail(res, error); }
});
router.post("/competition-attendance/first-chance/apply", async (req, res) => {
  try {
    const decisions = req.body.decisions || {};
    validateDecisions(decisions, true);
    const reason = validReason(req.body.reason);
    if (req.body.confirmed !== true || req.body.linkConfirmed !== true) throw new AttendanceError("Confirm both the event identity and reviewed correction", 400);
    const tz = await getTeamTimezone();
    const result = await db.transaction(async tx => {
      await lockLinks(tx);
      // Stable ascending per-member locks cover all impacted rows and roster writes.
      const initial = await loadReview(tx, tz, decisions);
      for (const userId of [...new Set(initial.rows.map(e => e.userId))].sort((a,b) => a-b)) await lockAttendance(tx, userId);
      const review = await loadReview(tx, tz, decisions);
      if (review.applied) return publicPreview(review); // repeat-safe, no extra audits or credits
      if (review.fingerprint !== req.body.fingerprint) throw new AttendanceError("Attendance changed since the preview. Reload and review the latest totals before applying");
      const identity = await setLink(tx, scope.calendarEventId, scope.scoutEventId, req.userId!);
      for (const row of review.rows) {
        const change = review.changes.find(c => c.id === row.id);
        const updates = {...identity, ...(change || {}), ...(change ? {checkOutConfirmedBy: req.userId!, checkOutConfirmedAt: new Date()} : {})};
        delete (updates as any).id;
        const [updated] = await tx.update(timeEntries).set(updates).where(eq(timeEntries.id, row.id)).returning();
        await tx.insert(timeEntryAudit).values({
          entryId: row.id, actorId: req.userId!, actionType: correctionAction,
          previousValues: row, newValues: {...updates, reason, decisions, scope, previewFingerprint: review.fingerprint, beforeTeamMinutes: review.beforeMinutes, afterTeamMinutes: review.afterMinutes},
          deltaMinutes: credited(updated) - credited(row),
        });
      }
      // Latest legitimate surviving visit supplies the roster; no rejected duplicate can revive.
      for (const userId of [...new Set(review.rows.map(e => e.userId))]) {
        const entries = await tx.select().from(timeEntries).where(and(eq(timeEntries.userId, userId), eq(timeEntries.calendarEventId, scope.calendarEventId)));
        const survivor = entries.filter(e => e.status !== "rejected").sort((a,b) => b.checkInAt.getTime() - a.checkInAt.getTime())[0];
        if (survivor) await mirrorRoster(tx, survivor, req.userId!);
      }
      return publicPreview(await loadReview(tx, tz, decisions));
    });
    res.json(result);
  } catch (error) { fail(res, error); }
});
export default router;
