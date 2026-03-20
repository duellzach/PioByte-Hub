import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/fullscreen-alerts", async (req, res) => {
  try {
    const activeOnly = req.query.active === "true";
    const alerts = await storage.getFullscreenAlerts(activeOnly);
    res.json(alerts);
  } catch (error) {
    console.error("Error fetching fullscreen alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.post("/fullscreen-alerts", async (req, res) => {
  try {
    const createdBy = parseInt(req.body.createdBy);
    if (!createdBy) return res.status(400).json({ error: "createdBy is required" });
    const actor = await storage.getUser(createdBy);
    const actorRoles: string[] = actor?.roles || [];
    if (!actorRoles.includes("Coach") && !actorRoles.includes("Team Captain")) {
      return res.status(403).json({ error: "Only coaches and captains can create alerts" });
    }
    const alert = await storage.createFullscreenAlert(req.body);
    res.status(201).json(alert);
  } catch (error) {
    console.error("Error creating fullscreen alert:", error);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

router.put("/fullscreen-alerts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actorId = parseInt(req.body.actorId);
    if (!actorId) return res.status(400).json({ error: "actorId is required" });
    const actor = await storage.getUser(actorId);
    const actorRoles: string[] = actor?.roles || [];
    if (!actorRoles.includes("Coach") && !actorRoles.includes("Team Captain")) {
      return res.status(403).json({ error: "Only coaches and captains can update alerts" });
    }
    const { actorId: _, ...updateData } = req.body;
    const alert = await storage.updateFullscreenAlert(id, updateData);
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    res.json(alert);
  } catch (error) {
    console.error("Error updating fullscreen alert:", error);
    res.status(500).json({ error: "Failed to update alert" });
  }
});

router.delete("/fullscreen-alerts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actorId = parseInt(req.query.actorId as string);
    if (!actorId) return res.status(400).json({ error: "actorId query param is required" });
    const actor = await storage.getUser(actorId);
    const actorRoles: string[] = actor?.roles || [];
    if (!actorRoles.includes("Coach") && !actorRoles.includes("Team Captain")) {
      return res.status(403).json({ error: "Only coaches and captains can delete alerts" });
    }
    await storage.deleteFullscreenAlert(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting fullscreen alert:", error);
    res.status(500).json({ error: "Failed to delete alert" });
  }
});

export default router;
