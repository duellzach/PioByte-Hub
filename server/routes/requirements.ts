import { Router } from "express";
import { storage } from "../storage";
import { requireRoles } from "../middleware/auth";

const LEADERSHIP = ["Coach", "Team Captain", "SCRUM Master"];
const router = Router();

const isLeadership = (roles: string[] = []) => roles.some((r) => LEADERSHIP.includes(r));
const localDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
const inWindow = (date: string, start: string | null, end: string | null) =>
  (!start || date >= start) && (!end || date <= end);

// ---------------------------------------------------------------------------
// Fundraising CRUD
// ---------------------------------------------------------------------------

router.get("/fundraising", async (req, res) => {
  try {
    const leadership = isLeadership(req.userRoles);
    const filter: any = {};
    if (!leadership) filter.userId = req.userId;
    else if (req.query.userId) filter.userId = parseInt(req.query.userId as string);
    if (req.query.status) filter.status = req.query.status;
    res.json(await storage.getFundraisingEntries(filter));
  } catch (error) {
    console.error("Error fetching fundraising:", error);
    res.status(500).json({ error: "Failed to fetch fundraising" });
  }
});

router.post("/fundraising", async (req, res) => {
  try {
    const leadership = isLeadership(req.userRoles);
    const amountCents = parseInt(req.body.amountCents);
    if (!amountCents || amountCents <= 0) return res.status(400).json({ error: "A positive amount is required" });
    // Non-leadership may only credit themselves, and it lands pending.
    const userId = leadership && req.body.userId ? parseInt(req.body.userId) : req.userId!;
    if (!leadership && req.body.userId && parseInt(req.body.userId) !== req.userId) {
      return res.status(403).json({ error: "You can only log your own contributions" });
    }
    const status = leadership ? "verified" : "pending";
    const entry = await storage.createFundraisingEntry({
      userId,
      amountCents,
      category: req.body.category || "Other",
      description: req.body.description || "",
      occurredOn: req.body.occurredOn || localDate(new Date()),
      status,
      verifiedBy: leadership ? req.userId! : null,
      verifiedAt: leadership ? new Date() : null,
      createdBy: req.userId!,
    });
    res.status(201).json(entry);
  } catch (error) {
    console.error("Error creating fundraising entry:", error);
    res.status(500).json({ error: "Failed to create entry" });
  }
});

router.put("/fundraising/:id", requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data: any = {};
    if (req.body.amountCents !== undefined) data.amountCents = parseInt(req.body.amountCents);
    if (req.body.category !== undefined) data.category = req.body.category;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.occurredOn !== undefined) data.occurredOn = req.body.occurredOn;
    if (req.body.status === "verified") { data.status = "verified"; data.verifiedBy = req.userId; data.verifiedAt = new Date(); }
    if (req.body.status === "pending") { data.status = "pending"; data.verifiedBy = null; data.verifiedAt = null; }
    const updated = await storage.updateFundraisingEntry(id, data);
    if (!updated) return res.status(404).json({ error: "Entry not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error updating fundraising entry:", error);
    res.status(500).json({ error: "Failed to update entry" });
  }
});

router.delete("/fundraising/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entry = await storage.getFundraisingEntry(id);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    const leadership = isLeadership(req.userRoles);
    // Leadership can delete anything; a creator can delete their own while pending.
    if (!leadership && !(entry.createdBy === req.userId && entry.status === "pending")) {
      return res.status(403).json({ error: "Not allowed" });
    }
    await storage.deleteFundraisingEntry(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting fundraising entry:", error);
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

// ---------------------------------------------------------------------------
// Requirements progress (the home-dashboard centerpiece)
// ---------------------------------------------------------------------------

async function computeRequirements(userId: number) {
  const settings: any = await storage.getTeamSettings();
  const req = settings.requirements || { fundraising: { enabled: false }, hours: [] };
  const user = await storage.getUser(userId);
  const overrides: any = (user as any)?.hourRequirementOverrides || {};

  // Fundraising
  const entries = await storage.getFundraisingEntries({ userId });
  const raisedCents = entries.filter((e) => e.status === "verified").reduce((s, e) => s + e.amountCents, 0);
  const pendingCents = entries.filter((e) => e.status === "pending").reduce((s, e) => s + e.amountCents, 0);
  const goalCents = (user as any)?.fundraisingGoalCents ?? req.fundraising?.goalCents ?? 0;

  // Pre-fetch time sources
  const allEntries = await storage.getTimeEntries();
  const myApproved = allEntries.filter((e: any) => e.userId === userId && e.status === "completed" && e.roundedMinutes);
  const compCheckins = await storage.getCompetitionCheckinsByUser(userId).catch(() => []);

  const hours = (req.hours || [])
    .filter((h: any) => h.enabled)
    .map((h: any) => {
      const phases = (h.phases || []).map((ph: any) => {
        let earned = 0;
        if (typeof h.source === "string" && h.source.startsWith("clock:")) {
          const kind = h.source.slice("clock:".length);
          for (const e of myApproved) {
            if ((e.kind || "shop") !== kind) continue;
            const date = localDate(new Date(e.checkInAt));
            if (inWindow(date, ph.start, ph.end)) earned += e.roundedMinutes;
          }
        } else if (h.source === "competition_checkins") {
          for (const c of compCheckins as any[]) {
            if (c.status !== "approved" || !c.roundedMinutes) continue;
            const date = localDate(new Date(c.checkInAt));
            if (inWindow(date, ph.start, ph.end)) earned += c.roundedMinutes;
          }
        }
        const overrideKey = `${h.key}:${ph.label}`;
        const requiredMinutes = overrides[overrideKey] ?? ph.requiredMinutes ?? 0;
        return { label: ph.label, earnedMinutes: earned, requiredMinutes };
      });
      return { key: h.key, label: h.label, phases };
    });

  return {
    fundraising: { enabled: !!req.fundraising?.enabled, raisedCents, pendingCents, goalCents },
    hours,
  };
}

router.get("/me/requirements", async (req, res) => {
  try {
    res.json(await computeRequirements(req.userId!));
  } catch (error) {
    console.error("Error computing requirements:", error);
    res.status(500).json({ error: "Failed to compute requirements" });
  }
});

router.get("/users/:id/requirements", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.userId !== id && !isLeadership(req.userRoles)) {
      return res.status(403).json({ error: "Not allowed" });
    }
    res.json(await computeRequirements(id));
  } catch (error) {
    console.error("Error computing requirements:", error);
    res.status(500).json({ error: "Failed to compute requirements" });
  }
});

export default router;
