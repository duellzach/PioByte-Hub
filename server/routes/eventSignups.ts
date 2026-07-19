import { Router } from "express";
import { storage } from "../storage";
import { requireRoles } from "../middleware/auth";
import { todayLocalStr } from "../../utils/dates";

const LEADERSHIP = ["Coach", "Team Captain", "SCRUM Master"];
const CLOCKABLE_TYPES = ["outreach", "volunteer"];

const router = Router();

function isLeadership(roles: string[] = []): boolean {
  return roles.some((r) => LEADERSHIP.includes(r));
}

// Student signs themselves up for an event.
router.post("/calendar/:id/signup", async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const event = await storage.getCalendarEvent(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!(event as any).signupEnabled) return res.status(400).json({ error: "Sign-ups are not open for this event" });

    // Respect capacity → waitlist when full (existing accepted signups).
    let status = "requested";
    const cap = (event as any).capacity as number | null;
    if (cap != null) {
      const accepted = await storage.countAcceptedSignups(eventId);
      if (accepted >= cap) status = "waitlisted";
    }
    const signup = await storage.upsertEventSignup(eventId, req.userId!, status);
    res.status(201).json(signup);
  } catch (error) {
    console.error("Error signing up for event:", error);
    res.status(500).json({ error: "Failed to sign up" });
  }
});

// Student withdraws their own sign-up.
router.delete("/calendar/:id/signup", async (req, res) => {
  try {
    await storage.deleteEventSignup(parseInt(req.params.id), req.userId!);
    res.status(204).send();
  } catch (error) {
    console.error("Error withdrawing sign-up:", error);
    res.status(500).json({ error: "Failed to withdraw" });
  }
});

// Roster. Leadership sees everyone (enriched with names + clocked minutes for
// this event); a member sees only their own row.
router.get("/calendar/:id/signups", async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const leadership = isLeadership(req.userRoles);
    let signups = await storage.getEventSignups(eventId);
    if (!leadership) signups = signups.filter((s) => s.userId === req.userId);

    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u) => [u.id, u.name]));
    // Clocked minutes per user for this event (approved time entries).
    const entries = await storage.getTimeEntries();
    const minutesByUser: Record<number, number> = {};
    for (const e of entries) {
      if (e.calendarEventId === eventId && e.status === "completed" && e.roundedMinutes) {
        minutesByUser[e.userId] = (minutesByUser[e.userId] || 0) + e.roundedMinutes;
      }
    }
    res.json(signups.map((s) => ({
      ...s,
      userName: userMap.get(s.userId) || `User ${s.userId}`,
      clockedMinutes: minutesByUser[s.userId] || 0,
    })));
  } catch (error) {
    console.error("Error fetching signups:", error);
    res.status(500).json({ error: "Failed to fetch roster" });
  }
});

// Leadership accepts / declines / waitlists a signup.
router.put("/signups/:id", requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["requested", "accepted", "declined", "waitlisted"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const updated = await storage.setEventSignupStatus(parseInt(req.params.id), status, req.userId!);
    if (!updated) return res.status(404).json({ error: "Signup not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error updating signup:", error);
    res.status(500).json({ error: "Failed to update signup" });
  }
});

// Events the user is accepted to and that are happening today → clock-in picker.
router.get("/me/clockable-events", async (req, res) => {
  try {
    const today = todayLocalStr();
    const mySignups = await storage.getUserSignups(req.userId!);
    const accepted = new Set(mySignups.filter((s) => s.status === "accepted").map((s) => s.calendarEventId));
    const events = await storage.getCalendarEvents();
    const clockable = events.filter((e) =>
      accepted.has(e.id) &&
      CLOCKABLE_TYPES.includes(e.type) &&
      e.startDate <= today && (e.endDate || e.startDate) >= today
    );
    res.json(clockable.map((e) => ({ id: e.id, title: e.title, type: e.type })));
  } catch (error) {
    console.error("Error fetching clockable events:", error);
    res.status(500).json({ error: "Failed to fetch clockable events" });
  }
});

// Upcoming signup-enabled events (today forward) with the user's signup status.
router.get("/me/upcoming", async (req, res) => {
  try {
    const today = todayLocalStr();
    const mySignups = await storage.getUserSignups(req.userId!);
    const statusByEvent = new Map(mySignups.map((s) => [s.calendarEventId, s.status]));
    const events = await storage.getCalendarEvents();
    const upcoming = events
      .filter((e) => (e as any).signupEnabled && (e.endDate || e.startDate) >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 12)
      .map((e) => ({
        id: e.id, title: e.title, type: e.type, startDate: e.startDate, endDate: e.endDate,
        startTime: e.startTime, location: e.location,
        myStatus: statusByEvent.get(e.id) || null,
      }));
    res.json(upcoming);
  } catch (error) {
    console.error("Error fetching upcoming:", error);
    res.status(500).json({ error: "Failed to fetch upcoming" });
  }
});

export default router;
