import { Router } from "express";
import { storage } from "../storage";
import { getUserRoles, hasAnyRole, COACH_CAPTAIN_DEPT_HEAD, LEADERSHIP_ALL, tbaFetch, TBA_KEY, toaFetch, TOA_KEY } from "../helpers";
import { filterVisibleEvents } from "../services/eventVisibility";
import { sendPushToUsers } from "../push";
import { getCapExemptRoleNames } from "./eventSignups";

const router = Router();

router.get("/calendar", async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const events = await storage.getCalendarEvents(includeArchived);
    const roles = req.userId ? await getUserRoles(req.userId) : [];
    const visible = await filterVisibleEvents(events, req.userId!, roles);
    const exemptRoles = await getCapExemptRoleNames();
    const enriched = await Promise.all(visible.map(async (e) => {
      const shifts = (e as any).signupEnabled ? await storage.getEventShiftsWithCounts(e.id, exemptRoles) : [];
      const cap = (e as any).capacity as number | null;
      if (cap == null) return { ...e, shifts };
      const acceptedCount = await storage.countAcceptedSignups(e.id, exemptRoles);
      return { ...e, shifts, acceptedCount };
    }));
    res.json(enriched);
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({ error: "Failed to fetch calendar events" });
  }
});

router.patch("/calendar/:id/archive", async (req, res) => {
  try {
    const roles = await getUserRoles(req.userId);
    if (!hasAnyRole(roles, COACH_CAPTAIN_DEPT_HEAD)) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const id = parseInt(req.params.id);
    const { archived } = req.body;
    const event = await storage.updateCalendarEvent(id, { archived: !!archived });
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (error) {
    console.error("Error archiving event:", error);
    res.status(500).json({ error: "Failed to archive event" });
  }
});

// Invite the given userIds to an event and notify the newly-added ones
// (in-app notification + push). Never blocks the caller on failure.
async function applyInvites(eventId: number, eventTitle: string, invitees: number[] | undefined, actorId: number) {
  if (!Array.isArray(invitees)) return;
  const before = new Set(await storage.getEventInviteeIds(eventId));
  const after = new Set(invitees.map((id) => parseInt(String(id))));

  const added = [...after].filter((id) => !before.has(id));
  const removed = [...before].filter((id) => !after.has(id) && id !== actorId);

  await storage.inviteUsersToEvent(eventId, added, actorId);
  await Promise.all(removed.map((id) => storage.uninviteUserFromEvent(eventId, id)));

  if (added.length === 0) return;
  const actor = await storage.getUser(actorId).catch(() => null);
  await Promise.all(added.map((toUserId) =>
    storage.createNotification({
      toUserId,
      fromUserId: actorId,
      // `[event:ID]` prefix (same convention as `[broadcast:ID]`) lets the
      // Home feed link the notification straight to the event.
      message: `[event:${eventId}] You've been invited to "${eventTitle}".`,
    }).catch((e) => console.error("createNotification (invite):", e))
  ));
  sendPushToUsers(added, {
    title: actor?.name ? `${actor.name} • PioByte Hub` : "PioByte Hub",
    body: `You've been invited to "${eventTitle}"`,
    url: `/#/calendar?event=${eventId}`,
    tag: `event-invite-${eventId}`,
  }).catch((e) => console.error("sendPushToUsers (invite):", e));
}

// Creates/updates/deletes an event's shift rows to match the desired list
// (each item optionally carrying its own `id` to update in place — new rows
// omit it). Mirrors applyInvites' diff-by-id approach above. Undefined
// `shifts` (a caller that doesn't know about shifts) leaves existing rows
// untouched; an explicit empty array clears them.
async function applyShifts(eventId: number, shifts: any[] | undefined) {
  if (!Array.isArray(shifts)) return;
  const existing = await storage.getEventShifts(eventId);
  const existingIds = new Set(existing.map((s) => s.id));
  const keepIds = new Set<number>();
  for (const s of shifts) {
    const title = String(s?.title || "").trim();
    const startTime = s?.startTime || "";
    const endTime = s?.endTime || "";
    if (!title || !startTime || !endTime) continue; // skip incomplete rows
    const capacity = s?.capacity != null && s.capacity !== "" ? parseInt(s.capacity, 10) : null;
    const data = { calendarEventId: eventId, title, startTime, endTime, capacity };
    if (s?.id && existingIds.has(parseInt(s.id))) {
      const updated = await storage.updateEventShift(parseInt(s.id), data);
      if (updated) keepIds.add(updated.id);
    } else {
      const created = await storage.createEventShift(data);
      keepIds.add(created.id);
    }
  }
  await Promise.all(existing.filter((s) => !keepIds.has(s.id)).map((s) => storage.deleteEventShift(s.id)));
}

router.post("/calendar", async (req, res) => {
  try {
    const { requesterId, invitees, shifts, ...data } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN_DEPT_HEAD)) {
      return res.status(403).json({ error: "Only Coaches, Captains, or Department Heads can create calendar events" });
    }
    // Roster participation is an event-level setting. Keep new events
    // roster-enabled by default for API callers that do not send the field;
    // the calendar form always sends the user's explicit choice.
    if (data.signupEnabled === undefined) data.signupEnabled = true;
    const event = await storage.createCalendarEvent({ ...data, createdBy: parseInt(requesterId) });
    if (data.inviteOnly) {
      await applyInvites(event.id, event.title, invitees, parseInt(requesterId));
    }
    if (data.signupEnabled) {
      await applyShifts(event.id, shifts);
    }
    res.status(201).json(event);
  } catch (error) {
    console.error("Error creating calendar event:", error);
    res.status(500).json({ error: "Failed to create calendar event" });
  }
});

router.put("/calendar/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { requesterId, invitees, shifts, ...data } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN_DEPT_HEAD)) {
      return res.status(403).json({ error: "Only Coaches, Captains, or Department Heads can edit calendar events" });
    }
    const event = await storage.updateCalendarEvent(id, data);
    if (!event) return res.status(404).json({ error: "Calendar event not found" });
    if (event.inviteOnly) {
      await applyInvites(event.id, event.title, invitees, parseInt(requesterId));
    }
    if (shifts !== undefined) {
      await applyShifts(id, event.signupEnabled ? shifts : []);
    }
    res.json(event);
  } catch (error) {
    console.error("Error updating calendar event:", error);
    res.status(500).json({ error: "Failed to update calendar event" });
  }
});

router.delete("/calendar/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const requesterId = req.query.requesterId ? parseInt(req.query.requesterId as string) : undefined;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(requesterId);
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN_DEPT_HEAD)) {
      return res.status(403).json({ error: "Only Coaches, Captains, or Department Heads can delete calendar events" });
    }
    await storage.deleteCalendarEvent(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    res.status(500).json({ error: "Failed to delete calendar event" });
  }
});

// A user can see (and comment on) an event if it isn't invite-only, they're
// leadership, they created it, or they're on the invite list — same rule as
// the calendar list's visibility filter (server/services/eventVisibility.ts),
// just evaluated for a single event instead of a batch.
async function canViewEvent(event: { id: number; inviteOnly: boolean; createdBy: number }, userId: number, roles: string[]): Promise<boolean> {
  if (!event.inviteOnly || hasAnyRole(roles, LEADERSHIP_ALL) || event.createdBy === userId) return true;
  const invitees = await storage.getEventInviteeIds(event.id);
  return invitees.includes(userId);
}

// Shifts for a signup-enabled event, with per-shift accepted counts — used
// both by the sign-up UI (to pick a shift) and the roster view (to group by
// shift). Same visibility rule as the event itself.
router.get("/calendar/:id/shifts", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const event = await storage.getCalendarEvent(id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    const roles = req.userId ? await getUserRoles(req.userId) : [];
    if (!(await canViewEvent(event, req.userId!, roles))) return res.status(404).json({ error: "Event not found" });
    const exemptRoles = await getCapExemptRoleNames();
    const shifts = await storage.getEventShiftsWithCounts(id, exemptRoles);
    res.json(shifts);
  } catch (error) {
    console.error("Error fetching shifts:", error);
    res.status(500).json({ error: "Failed to fetch shifts" });
  }
});

router.post("/calendar/:id/comments", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { text } = req.body;
    if (!req.userId) return res.status(401).json({ error: "Not authenticated" });
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: "Comment text is required" });
    if (text.trim().length > 2000) return res.status(400).json({ error: "Comment is too long (2000 character max)" });
    const event = await storage.getCalendarEvent(id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    const roles = req.userRoles || (await getUserRoles(req.userId));
    if (!(await canViewEvent(event, req.userId, roles))) return res.status(404).json({ error: "Event not found" });
    const updated = await storage.addCalendarEventComment(id, req.userId, text.trim());
    res.status(201).json(updated);
  } catch (error) {
    console.error("Error adding calendar event comment:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

router.delete("/calendar/:id/comments/:commentId", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { commentId } = req.params;
    if (!req.userId) return res.status(401).json({ error: "Not authenticated" });
    const event = await storage.getCalendarEvent(id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    const roles = req.userRoles || (await getUserRoles(req.userId));
    if (!(await canViewEvent(event, req.userId, roles))) return res.status(404).json({ error: "Event not found" });
    const comment = ((event as any).comments || []).find((c: any) => c.id === commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    const isOwnComment = comment.userId === req.userId;
    if (!isOwnComment && !hasAnyRole(roles, LEADERSHIP_ALL)) {
      return res.status(403).json({ error: "You can only delete your own comments" });
    }
    const updated = await storage.deleteCalendarEventComment(id, commentId);
    res.json(updated);
  } catch (error) {
    console.error("Error deleting calendar event comment:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

router.patch("/calendar/:id/deleted-dates", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { requesterId, deletedDates } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN_DEPT_HEAD)) {
      return res.status(403).json({ error: "Only Coaches, Captains, or Department Heads can modify calendar events" });
    }
    if (!Array.isArray(deletedDates)) return res.status(400).json({ error: "deletedDates must be an array" });
    const event = await storage.patchCalendarEventDeletedDates(id, deletedDates);
    if (!event) return res.status(404).json({ error: "Calendar event not found" });
    res.json(event);
  } catch (error) {
    console.error("Error patching deleted dates:", error);
    res.status(500).json({ error: "Failed to patch deleted dates" });
  }
});

router.get("/calendar/tba-preview", async (req, res) => {
  try {
    if (!TBA_KEY) return res.status(503).json({ error: "TBA_API_KEY is not configured on this server" });
    const requesterId = req.query.requesterId ? parseInt(req.query.requesterId as string) : undefined;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(requesterId);
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN_DEPT_HEAD)) {
      return res.status(403).json({ error: "Only Coaches, Captains, or Department Heads can import events" });
    }
    const teamSettings = await storage.getTeamSettings();
    const year = new Date().getFullYear();
    const data = await tbaFetch(`/team/frc${teamSettings.teamNumber}/events/${year}`);
    const events = Array.isArray(data) ? data : [];
    const mapped = events.map((e: any) => ({
      key: e.key,
      name: e.name,
      startDate: e.start_date,
      endDate: e.end_date,
      location: [e.city, e.state_prov, e.country].filter(Boolean).join(', '),
    }));
    res.json(mapped);
  } catch (error) {
    console.error("Error fetching TBA preview:", error);
    res.status(500).json({ error: "Failed to fetch TBA events" });
  }
});

router.post("/calendar/tba-import", async (req, res) => {
  try {
    const { requesterId, events: eventsToImport } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN_DEPT_HEAD)) {
      return res.status(403).json({ error: "Only Coaches, Captains, or Department Heads can import events" });
    }
    if (!Array.isArray(eventsToImport)) return res.status(400).json({ error: "events must be an array" });
    const existing = await storage.getCalendarEvents();
    const created: any[] = [];
    let skipped = 0;
    for (const ev of eventsToImport) {
      const isDup = existing.some(e => e.title === ev.name && e.startDate === ev.startDate);
      if (isDup) { skipped++; continue; }
      const row = await storage.createCalendarEvent({
        title: ev.name,
        description: '',
        startDate: ev.startDate,
        endDate: ev.endDate || null,
        startTime: null,
        endTime: null,
        type: 'competition',
        location: ev.location || '',
        attending: true,
        signupEnabled: true,
        createdBy: parseInt(requesterId),
      });
      created.push(row);
    }
    res.json({ created: created.length, skipped });
  } catch (error) {
    console.error("Error importing TBA events:", error);
    res.status(500).json({ error: "Failed to import TBA events" });
  }
});

router.get("/calendar/toa-preview", async (req, res) => {
  try {
    if (!TOA_KEY) return res.status(503).json({ error: "TOA_API_KEY is not configured on this server" });
    const requesterId = req.query.requesterId ? parseInt(req.query.requesterId as string) : undefined;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(requesterId);
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN_DEPT_HEAD)) {
      return res.status(403).json({ error: "Only Coaches, Captains, or Department Heads can import events" });
    }
    const teamSettings = await storage.getTeamSettings();
    const season = req.query.season as string || (() => {
      const y = new Date().getFullYear();
      const m = new Date().getMonth();
      const start = m >= 8 ? y : y - 1;
      return `${String(start).slice(2)}${String(start + 1).slice(2)}`;
    })();
    const teamNum = (teamSettings.teamNumber as number) || 10991;
    const data = await toaFetch(`/team/ftc${teamNum}/events/${season}`);
    const events = Array.isArray(data) ? data : [];
    const mapped = events.map((e: any) => ({
      key: e.event_key,
      name: e.event_name,
      startDate: e.start_date ? e.start_date.slice(0, 10) : null,
      endDate: e.end_date ? e.end_date.slice(0, 10) : null,
      location: [e.city, e.state_prov, e.country].filter(Boolean).join(', '),
    }));
    res.json(mapped);
  } catch (error) {
    console.error("Error fetching TOA preview:", error);
    res.status(500).json({ error: "Failed to fetch TOA events" });
  }
});

router.post("/calendar/toa-import", async (req, res) => {
  try {
    const { requesterId, events: eventsToImport } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN_DEPT_HEAD)) {
      return res.status(403).json({ error: "Only Coaches, Captains, or Department Heads can import events" });
    }
    if (!Array.isArray(eventsToImport)) return res.status(400).json({ error: "events must be an array" });
    const existing = await storage.getCalendarEvents();
    const created: any[] = [];
    let skipped = 0;
    for (const ev of eventsToImport) {
      if (!ev.startDate) { skipped++; continue; }
      const isDup = existing.some(e => e.title === ev.name && e.startDate === ev.startDate);
      if (isDup) { skipped++; continue; }
      const row = await storage.createCalendarEvent({
        title: ev.name,
        description: '',
        startDate: ev.startDate,
        endDate: ev.endDate || null,
        startTime: null,
        endTime: null,
        type: 'competition',
        location: ev.location || '',
        attending: true,
        signupEnabled: true,
        createdBy: parseInt(requesterId),
      });
      created.push(row);
    }
    res.json({ created: created.length, skipped });
  } catch (error) {
    console.error("Error importing TOA events:", error);
    res.status(500).json({ error: "Failed to import TOA events" });
  }
});

export default router;
