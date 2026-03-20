import { Router } from "express";
import { storage } from "../storage";
import { getUserRoles, hasAnyRole, COACH_CAPTAIN, tbaFetch, TBA_KEY } from "../helpers";

const router = Router();

router.get("/calendar", async (req, res) => {
  try {
    const events = await storage.getCalendarEvents();
    res.json(events);
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({ error: "Failed to fetch calendar events" });
  }
});

router.post("/calendar", async (req, res) => {
  try {
    const { requesterId, ...data } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Captains can create calendar events" });
    }
    const event = await storage.createCalendarEvent({ ...data, createdBy: parseInt(requesterId) });
    res.status(201).json(event);
  } catch (error) {
    console.error("Error creating calendar event:", error);
    res.status(500).json({ error: "Failed to create calendar event" });
  }
});

router.put("/calendar/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { requesterId, ...data } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Captains can edit calendar events" });
    }
    const event = await storage.updateCalendarEvent(id, data);
    if (!event) return res.status(404).json({ error: "Calendar event not found" });
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
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Captains can delete calendar events" });
    }
    await storage.deleteCalendarEvent(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    res.status(500).json({ error: "Failed to delete calendar event" });
  }
});

router.patch("/calendar/:id/deleted-dates", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { requesterId, deletedDates } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Captains can modify calendar events" });
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
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Captains can import events" });
    }
    const data = await tbaFetch("/team/frc10991/events/2026");
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
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Captains can import events" });
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

export default router;
