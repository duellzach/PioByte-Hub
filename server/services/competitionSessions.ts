import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { calendarEvents, scoutEvents, timeEntries, timeEntryAudit, eventSignups, timeEntryTaskSegments, type TimeEntry } from "../../shared/schema";
import { AttendanceError, attendanceMinutes, resolvedSession, sameCompetition, validReason } from "./competitionSessionRules";
export { AttendanceError } from "./competitionSessionRules";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function lockAttendance(tx: Tx, userId: number) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(96196, ${userId})`);
}

// All mutating attendance paths use this same lock. No startup/schema DDL.
export async function competitionIdentity(tx: Tx, ids: {calendarEventId?: number | null; scoutEventId?: number | null}) {
  if (ids.calendarEventId) {
    const [calendar] = await tx.select().from(calendarEvents).where(eq(calendarEvents.id, ids.calendarEventId));
    if (!calendar || calendar.type !== "competition") throw new AttendanceError("Competition calendar event not found", 404);
    if (!calendar.scoutEventId) throw new AttendanceError("A coach must link this calendar competition to its scouting event in Time Tracking before attendance can be recorded");
    if (ids.scoutEventId && calendar.scoutEventId !== ids.scoutEventId) throw new AttendanceError("These events are not linked");
    return {calendarEventId: calendar.id, scoutEventId: calendar.scoutEventId};
  }
  if (!ids.scoutEventId) throw new AttendanceError("Competition event required", 400);
  const [scout] = await tx.select().from(scoutEvents).where(eq(scoutEvents.id, ids.scoutEventId));
  if (!scout) throw new AttendanceError("Scouting event not found", 404);
  const calendars = await tx.select().from(calendarEvents).where(eq(calendarEvents.type, "competition"));
  const linked = calendars.filter(c => c.scoutEventId === scout.id);
  if (linked.length > 1) throw new AttendanceError("Multiple calendars link to this competition; coach review required");
  if (linked.length) return {calendarEventId: linked[0].id, scoutEventId: scout.id};
  const overlapping = calendars.some(c => !c.archived && scout.startDate && c.startDate <= (scout.endDate || scout.startDate) && (c.endDate || c.startDate) >= scout.startDate);
  if (overlapping) throw new AttendanceError("A calendar competition overlaps these dates. A coach must explicitly link the events in Time Tracking first");
  return {calendarEventId: null, scoutEventId: scout.id};
}

export async function mirrorRoster(tx: Tx, entry: TimeEntry, actorId: number) {
  // The roster is a projection of ALL visits, not the record just changed.
  // Revising an earlier visit must not replace a later member's live check-in.
  const [calendar] = await tx.select().from(calendarEvents).where(entry.calendarEventId
    ? eq(calendarEvents.id, entry.calendarEventId)
    : entry.scoutEventId ? eq(calendarEvents.scoutEventId, entry.scoutEventId) : sql`FALSE`);
  if (!calendar) return;
  const visits = (await tx.select().from(timeEntries).where(and(
    eq(timeEntries.userId, entry.userId), eq(timeEntries.kind, "competition"),
    or(eq(timeEntries.calendarEventId, calendar.id), calendar.scoutEventId ? eq(timeEntries.scoutEventId, calendar.scoutEventId) : sql`FALSE`),
  ))).filter(e => e.status !== "rejected").sort((a, b) => {
    const aOpen = !a.checkOutAt && !resolvedSession(a.status);
    const bOpen = !b.checkOutAt && !resolvedSession(b.status);
    return Number(bOpen) - Number(aOpen) || b.checkInAt.getTime() - a.checkInAt.getTime() || b.id - a.id;
  });
  const current = visits[0];
  const data = {checkedInAt: current?.checkInAt || null, checkedOutAt: current?.checkOutAt || null, checkedInBy: actorId};
  const [signup] = await tx.select().from(eventSignups).where(and(eq(eventSignups.calendarEventId, calendar.id), eq(eventSignups.userId, entry.userId)));
  if (signup) await tx.update(eventSignups).set(data).where(eq(eventSignups.id, signup.id));
  else if (current) await tx.insert(eventSignups).values({calendarEventId: calendar.id, userId: entry.userId, status: "accepted", ...data});
}

export async function startCompetitionSession(input: {userId: number; actorId: number; calendarEventId?: number | null; scoutEventId?: number | null; at?: Date; confirmed?: boolean; requestId?: string}) {
  if (!Number.isInteger(input.userId) || input.userId <= 0) throw new AttendanceError("A valid member is required", 400);
  if (input.requestId !== undefined && (typeof input.requestId !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(input.requestId))) throw new AttendanceError("Invalid check-in request identifier", 400);
  return db.transaction(async tx => {
    await lockAttendance(tx, input.userId);
    const identity = await competitionIdentity(tx, input);
    if (identity.calendarEventId) {
      const [signup] = await tx.select().from(eventSignups).where(and(eq(eventSignups.calendarEventId, identity.calendarEventId), eq(eventSignups.userId, input.userId)));
      if (signup?.status === "declined" && !input.confirmed) throw new AttendanceError("Your sign-up for this competition was declined", 403);
    }
    const at = input.at || new Date();
    if (!Number.isFinite(at.getTime())) throw new AttendanceError("Invalid check-in time", 400);
    const rows = await tx.select().from(timeEntries).where(eq(timeEntries.userId, input.userId));
    if (input.requestId) {
      const [retry] = await tx.select({entryId: timeEntryAudit.entryId}).from(timeEntryAudit).where(and(eq(timeEntryAudit.actorId, input.actorId), sql`${timeEntryAudit.newValues}->>'requestId' = ${input.requestId}`)).limit(1);
      const previous = retry && rows.find(e => e.id === retry.entryId);
      if (previous) {
        if (!sameCompetition(previous, identity)) throw new AttendanceError("This request identifier was already used for another competition");
        return {entry: previous, created: false};
      }
    }
    const open = rows.filter(e => !e.checkOutAt && !resolvedSession(e.status));
    if (open.length > 1) throw new AttendanceError("Multiple active sessions need coach review; no additional session was created");
    if (open.length) {
      const entry = open[0];
      if (entry.kind !== "competition" || !sameCompetition(entry, identity)) throw new AttendanceError("This member already has another active time session");
      const [linked] = await tx.update(timeEntries).set(identity).where(eq(timeEntries.id, entry.id)).returning();
      if (input.requestId || entry.calendarEventId !== identity.calendarEventId || entry.scoutEventId !== identity.scoutEventId) {
        await tx.insert(timeEntryAudit).values({entryId: entry.id, actorId: input.actorId, actionType: "competition_check_in_reused", previousValues: {calendarEventId: entry.calendarEventId, scoutEventId: entry.scoutEventId}, newValues: {...identity, requestId: input.requestId}});
      }
      await mirrorRoster(tx, linked, input.actorId);
      if (input.confirmed && linked.calendarEventId) await tx.update(eventSignups).set({status: "accepted"}).where(and(eq(eventSignups.calendarEventId, linked.calendarEventId), eq(eventSignups.userId, linked.userId)));
      return {entry: linked, created: false};
    }
    // Historical coach timestamps cannot overlap an already resolved visit.
    const overlap = rows.some(e => e.status !== "rejected" && e.checkOutAt && new Date(e.checkInAt) <= at && new Date(e.checkOutAt) > at);
    if (overlap) throw new AttendanceError("Check-in overlaps an existing visit; edit that session instead");
    const [entry] = await tx.insert(timeEntries).values({
      userId: input.userId, ...identity, kind: "competition", checkInAt: at,
      status: input.confirmed ? "checked_in" : "pending_check_in",
      ...(input.confirmed ? {checkInConfirmedBy: input.actorId, checkInConfirmedAt: new Date()} : {}),
    }).returning();
    await tx.insert(timeEntryAudit).values({entryId: entry.id, actorId: input.actorId, actionType: "check_in", newValues: {status: entry.status, ...identity, checkInAt: at, source: "shared_competition_session", requestId: input.requestId}});
    await mirrorRoster(tx, entry, input.actorId);
    if (input.confirmed && entry.calendarEventId) await tx.update(eventSignups).set({status: "accepted"}).where(and(eq(eventSignups.calendarEventId, entry.calendarEventId), eq(eventSignups.userId, entry.userId)));
    return {entry, created: true};
  });
}

// A retry of checkout/approval returns the resolved record, never reopens it.
export async function changeCompetitionSession(id: number, actorId: number, action: "checkout" | "confirm_in" | "approve" | "reject" | "edit", input: {at?: Date; roundedMinutes?: number; reason?: string; checkInAt?: Date; checkOutAt?: Date | null; notes?: string; taskHandoffNote?: string} = {}) {
  return db.transaction(async tx => {
    const [initial] = await tx.select().from(timeEntries).where(eq(timeEntries.id, id));
    if (!initial || initial.kind !== "competition") throw new AttendanceError("Competition attendance not found", 404);
    await lockAttendance(tx, initial.userId);
    const [prev] = await tx.select().from(timeEntries).where(eq(timeEntries.id, id)).for("update");
    if (prev.status === "rejected") {
      if (action === "reject") return prev;
      throw new AttendanceError("Rejected attendance is preserved as history and cannot be revived");
    }
    if (resolvedSession(prev.status) && action !== "edit") {
      if (action === "approve" && input.roundedMinutes !== undefined && input.roundedMinutes !== prev.roundedMinutes) throw new AttendanceError("This visit is already approved. Use an audited time adjustment instead of approving it again");
      return prev;
    }
    const updates: Partial<TimeEntry> = {};
    let reason: string | undefined;
    if (action === "checkout") {
      if (prev.checkOutAt) return prev;
      updates.checkOutAt = input.at || new Date();
      attendanceMinutes(prev.checkInAt, updates.checkOutAt);
      updates.status = "pending_check_out";
      if (input.taskHandoffNote) updates.taskHandoffNote = input.taskHandoffNote.trim().slice(0, 4000);
    } else if (action === "confirm_in") {
      updates.checkInConfirmedBy = actorId;
      updates.checkInConfirmedAt = new Date();
      updates.status = prev.checkOutAt ? "pending_check_out" : "checked_in";
    } else if (action === "approve") {
      if (!prev.checkOutAt) throw new AttendanceError("Check out before approving attendance", 400);
      const others = await tx.select().from(timeEntries).where(and(eq(timeEntries.userId, prev.userId), eq(timeEntries.kind, "competition"), eq(timeEntries.status, "completed")));
      if (others.some(e => e.id !== id && e.checkOutAt && e.checkInAt < prev.checkOutAt! && e.checkOutAt > prev.checkInAt)) throw new AttendanceError("Another approved competition visit overlaps this session. Review the original attendance instead of awarding both credits");
      const expected = attendanceMinutes(prev.checkInAt, prev.checkOutAt);
      const minutes = input.roundedMinutes ?? expected;
      if (!Number.isInteger(minutes) || minutes < 0) throw new AttendanceError("Minutes must be a non-negative whole number", 400);
      if (minutes !== expected) reason = validReason(input.reason);
      Object.assign(updates, {roundedMinutes: minutes, status: "completed", checkInConfirmedBy: prev.checkInConfirmedBy || actorId, checkInConfirmedAt: prev.checkInConfirmedAt || new Date(), checkOutConfirmedBy: actorId, checkOutConfirmedAt: new Date()});
    } else if (action === "reject") {
      Object.assign(updates, {status: "rejected", checkOutConfirmedBy: actorId, checkOutConfirmedAt: new Date()});
    } else {
      if (input.checkInAt && !Number.isFinite(input.checkInAt.getTime())) throw new AttendanceError("Invalid check-in time", 400);
      if (input.checkOutAt && !Number.isFinite(input.checkOutAt.getTime())) throw new AttendanceError("Invalid check-out time", 400);
      if (input.checkOutAt === null) throw new AttendanceError("A closed competition visit cannot be reopened; start a separate visit", 400);
      if (input.checkInAt) updates.checkInAt = input.checkInAt;
      if (input.checkOutAt) updates.checkOutAt = input.checkOutAt;
      if (input.notes !== undefined) updates.notes = input.notes;
      const start = updates.checkInAt || prev.checkInAt, end = updates.checkOutAt || prev.checkOutAt;
      const timeChanged = (updates.checkInAt && updates.checkInAt.getTime() !== prev.checkInAt.getTime())
        || (updates.checkOutAt && updates.checkOutAt.getTime() !== prev.checkOutAt?.getTime());
      if (end && timeChanged) updates.roundedMinutes = attendanceMinutes(start, end);
      if (resolvedSession(prev.status) && timeChanged) reason = validReason(input.reason || input.notes);
      const others = await tx.select().from(timeEntries).where(eq(timeEntries.userId, prev.userId));
      if (timeChanged && others.some(e => e.id !== id && e.status !== "rejected" && new Date(e.checkInAt) < (end || new Date()) && (!e.checkOutAt || new Date(e.checkOutAt) > start))) throw new AttendanceError("Edited attendance overlaps another visit; review the original records first");
    }
    const [entry] = await tx.update(timeEntries).set(updates).where(eq(timeEntries.id, id)).returning();
    await tx.insert(timeEntryAudit).values({entryId: id, actorId, actionType: `competition_${action}`, previousValues: prev, newValues: {...updates, ...(reason ? {reason} : {})}, deltaMinutes: (entry.status === "completed" ? entry.roundedMinutes || 0 : 0) - (prev.status === "completed" ? prev.roundedMinutes || 0 : 0)});
    await mirrorRoster(tx, entry, actorId);
    if (entry.checkOutAt || entry.status === "rejected") {
      await tx.update(timeEntryTaskSegments).set({endedAt: entry.checkOutAt || new Date(), minutes: sql`GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${entry.checkOutAt || new Date()}::timestamptz - started_at))/60))::integer`}).where(and(eq(timeEntryTaskSegments.entryId, id), isNull(timeEntryTaskSegments.endedAt)));
    }
    return entry;
  });
}

export async function competitionRosterSession(calendarEventId: number, userId: number, checkedInAt: Date) {
  const rows = await db.select().from(timeEntries).where(and(eq(timeEntries.calendarEventId, calendarEventId), eq(timeEntries.userId, userId)));
  // Select the exact visit, not the first record for a member/event.
  const exact = rows.filter(e => new Date(e.checkInAt).getTime() === checkedInAt.getTime());
  if (exact.length !== 1) throw new AttendanceError("Roster attendance does not identify one session. Review the member's time entries before editing");
  return exact[0];
}
