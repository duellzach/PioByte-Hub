import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/competition-checkins", async (req, res) => {
  try {
    const { eventId, userId } = req.query;
    let checkins: any[];
    if (eventId) {
      checkins = await storage.getCompetitionCheckins(parseInt(eventId as string));
    } else if (userId) {
      checkins = await storage.getCompetitionCheckinsByUser(parseInt(userId as string));
    } else {
      return res.status(400).json({ error: "eventId or userId query param required" });
    }
    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u: any) => [u.id, u.name || u.username]));
    const enriched = checkins.map(c => ({
      ...c,
      userName: userMap.get(c.userId) || `User ${c.userId}`,
      approvedByName: c.approvedBy ? (userMap.get(c.approvedBy) || `User ${c.approvedBy}`) : null,
    }));
    res.json(enriched);
  } catch (error) {
    console.error("Error fetching competition checkins:", error);
    res.status(500).json({ error: "Failed to fetch competition checkins" });
  }
});

router.post("/competition-checkins/check-in", async (req, res) => {
  try {
    const { userId, eventId } = req.body;
    const open = await storage.getOpenCompetitionCheckin(userId, eventId);
    if (open) {
      return res.status(400).json({ error: "Already checked in to this event" });
    }
    const checkin = await storage.createCompetitionCheckin({
      userId,
      eventId,
      checkInAt: new Date(),
      status: "checked_in",
    });
    await storage.createCompetitionCheckinAudit({
      checkinId: checkin.id,
      actorId: parseInt(userId),
      actionType: "check_in",
      newValues: { status: "checked_in", checkInAt: checkin.checkInAt },
    });
    res.status(201).json(checkin);
  } catch (error) {
    console.error("Error checking in to competition:", error);
    res.status(500).json({ error: "Failed to check in" });
  }
});

router.post("/competition-checkins/:id/check-out", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const prev = await storage.getCompetitionCheckinById(id);
    const updated = await storage.updateCompetitionCheckin(id, {
      checkOutAt: new Date(),
      status: "pending_approval",
    });
    if (!updated) return res.status(404).json({ error: "Checkin not found" });
    await storage.createCompetitionCheckinAudit({
      checkinId: id,
      actorId: prev!.userId,
      actionType: "check_out",
      previousValues: { status: prev!.status },
      newValues: { status: "pending_approval", checkOutAt: updated.checkOutAt },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error checking out from competition:", error);
    res.status(500).json({ error: "Failed to check out" });
  }
});

router.post("/competition-checkins/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { coachId, roundedMinutes } = req.body;
    if (!coachId) return res.status(400).json({ error: "coachId is required" });
    const coachUser = await storage.getUser(parseInt(coachId));
    const coachRoles: string[] = coachUser?.roles || [];
    if (!coachRoles.includes("Coach") && !coachRoles.includes("Team Captain")) {
      return res.status(403).json({ error: "Only coaches and captains can approve competition checkins" });
    }
    const prev = await storage.getCompetitionCheckinById(id);
    const updated = await storage.updateCompetitionCheckin(id, {
      approvedBy: coachId,
      approvedAt: new Date(),
      status: "approved",
      roundedMinutes: roundedMinutes || undefined,
    });
    if (!updated) return res.status(404).json({ error: "Checkin not found" });
    await storage.createCompetitionCheckinAudit({
      checkinId: id,
      actorId: parseInt(coachId),
      actionType: "approve",
      previousValues: { status: prev!.status, roundedMinutes: prev!.roundedMinutes },
      newValues: { status: "approved", roundedMinutes: updated.roundedMinutes, approvedBy: coachId },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error approving competition checkin:", error);
    res.status(500).json({ error: "Failed to approve checkin" });
  }
});

router.post("/competition-checkins/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { coachId } = req.body;
    if (!coachId) return res.status(400).json({ error: "coachId is required" });
    const coachUser = await storage.getUser(parseInt(coachId));
    const coachRoles: string[] = coachUser?.roles || [];
    if (!coachRoles.includes("Coach") && !coachRoles.includes("Team Captain")) {
      return res.status(403).json({ error: "Only coaches and captains can reject competition checkins" });
    }
    const prev = await storage.getCompetitionCheckinById(id);
    const updated = await storage.updateCompetitionCheckin(id, { status: "rejected" });
    if (!updated) return res.status(404).json({ error: "Checkin not found" });
    await storage.createCompetitionCheckinAudit({
      checkinId: id,
      actorId: parseInt(coachId),
      actionType: "reject",
      previousValues: { status: prev!.status },
      newValues: { status: "rejected" },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error rejecting competition checkin:", error);
    res.status(500).json({ error: "Failed to reject checkin" });
  }
});

router.post("/competition-checkins/manual-add", async (req, res) => {
  try {
    const { coachId, userId, eventId, minutes, notes } = req.body;
    if (!coachId || !userId || !eventId || !minutes) {
      return res.status(400).json({ error: "coachId, userId, eventId, and minutes are required" });
    }
    const coachUser = await storage.getUser(parseInt(coachId));
    const coachRoles: string[] = coachUser?.roles || [];
    if (!coachRoles.includes("Coach") && !coachRoles.includes("Team Captain")) {
      return res.status(403).json({ error: "Only coaches and captains can manually add competition time" });
    }
    const now = new Date();
    const checkin = await storage.createCompetitionCheckin({
      userId: parseInt(userId),
      eventId: parseInt(eventId),
      checkInAt: now,
      checkOutAt: now,
      status: "approved",
      approvedBy: parseInt(coachId),
      approvedAt: now,
      roundedMinutes: parseInt(minutes),
      notes: notes || "Manually added by coach",
    });
    await storage.createCompetitionCheckinAudit({
      checkinId: checkin.id,
      actorId: parseInt(coachId),
      actionType: "manual_add",
      newValues: { status: "approved", roundedMinutes: checkin.roundedMinutes, notes: checkin.notes, userId: checkin.userId },
    });
    res.status(201).json(checkin);
  } catch (error) {
    console.error("Error manually adding competition checkin:", error);
    res.status(500).json({ error: "Failed to add manual checkin" });
  }
});

router.get("/competition-checkins/:id/audit", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const logs = await storage.getCompetitionCheckinAudit(id);
    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u: any) => [u.id, u.name || u.username]));
    const enriched = logs.map(l => ({ ...l, actorName: userMap.get(l.actorId) || `User ${l.actorId}` }));
    res.json(enriched);
  } catch (error) {
    console.error("Error fetching competition checkin audit:", error);
    res.status(500).json({ error: "Failed to fetch audit" });
  }
});

router.put("/competition-checkins/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { actorId, ...data } = req.body;
    if (!actorId) return res.status(400).json({ error: "actorId is required" });
    const actor = await storage.getUser(parseInt(actorId));
    const actorRoles: string[] = actor?.roles || [];
    const isCoachOrCaptain = actorRoles.includes("Coach") || actorRoles.includes("Team Captain");
    const existing = await storage.getCompetitionCheckinById(id);
    const ownsRecord = existing?.userId === parseInt(actorId);
    if (!isCoachOrCaptain && !ownsRecord) {
      return res.status(403).json({ error: "Not authorized to update this checkin" });
    }
    const updated = await storage.updateCompetitionCheckin(id, data);
    if (!updated) return res.status(404).json({ error: "Checkin not found" });
    await storage.createCompetitionCheckinAudit({
      checkinId: id,
      actorId: parseInt(actorId),
      actionType: "update",
      previousValues: existing ? { status: existing.status, notes: existing.notes } : undefined,
      newValues: data,
    });
    res.json(updated);
  } catch (error) {
    console.error("Error updating competition checkin:", error);
    res.status(500).json({ error: "Failed to update checkin" });
  }
});

router.delete("/competition-checkins/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actorId = req.query.actorId as string;
    if (!actorId) return res.status(400).json({ error: "actorId query param is required" });
    const actor = await storage.getUser(parseInt(actorId));
    const actorRoles: string[] = actor?.roles || [];
    if (!actorRoles.includes("Coach") && !actorRoles.includes("Team Captain")) {
      return res.status(403).json({ error: "Only coaches and captains can delete competition checkins" });
    }
    const existing = await storage.getCompetitionCheckinById(id);
    await storage.createCompetitionCheckinAudit({
      checkinId: id,
      actorId: parseInt(actorId),
      actionType: "delete",
      previousValues: existing ? { status: existing.status, userId: existing.userId, roundedMinutes: existing.roundedMinutes } : undefined,
    });
    await storage.deleteCompetitionCheckin(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting competition checkin:", error);
    res.status(500).json({ error: "Failed to delete checkin" });
  }
});

export default router;
