import { Router } from "express";
import { storage } from "../storage";
import { getUserRoles, hasAnyRole, COACH_CAPTAIN_DEPT_HEAD } from "../helpers";

const router = Router();

router.get("/resources", async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const rows = await storage.getResources(category);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching resources:", error);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
});

router.post("/resources", async (req, res) => {
  try {
    const { requesterId, ...data } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    if (!data.title?.trim()) return res.status(400).json({ error: "Title is required" });
    if (!data.url?.trim()) return res.status(400).json({ error: "URL is required" });
    if (!data.category?.trim()) return res.status(400).json({ error: "Category is required" });
    const resource = await storage.createResource({ ...data, addedBy: parseInt(requesterId) });
    res.status(201).json(resource);
  } catch (error) {
    console.error("Error creating resource:", error);
    res.status(500).json({ error: "Failed to create resource" });
  }
});

router.put("/resources/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { requesterId, ...data } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const existing = await storage.getResource(id);
    if (!existing) return res.status(404).json({ error: "Resource not found" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    const isOwner = existing.addedBy === parseInt(requesterId);
    const isCoach = hasAnyRole(actorRoles, ['Coach']);
    const isPrivileged = hasAnyRole(actorRoles, COACH_CAPTAIN_DEPT_HEAD);
    if (!isOwner && !isPrivileged) return res.status(403).json({ error: "Only the creator, a coach, captain, or department head can edit resources" });
    if ('pinned' in data && !isCoach) {
      return res.status(403).json({ error: "Only coaches can pin or unpin resources" });
    }
    const allowedFields: Record<string, any> = {};
    if (data.title !== undefined) allowedFields.title = data.title;
    if (data.url !== undefined) allowedFields.url = data.url;
    if (data.description !== undefined) allowedFields.description = data.description;
    if (data.category !== undefined) allowedFields.category = data.category;
    if (isCoach && data.pinned !== undefined) allowedFields.pinned = data.pinned;
    const updated = await storage.updateResource(id, allowedFields);
    res.json(updated);
  } catch (error) {
    console.error("Error updating resource:", error);
    res.status(500).json({ error: "Failed to update resource" });
  }
});

router.delete("/resources/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const requesterId = req.query.requesterId ? parseInt(req.query.requesterId as string) : undefined;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const existing = await storage.getResource(id);
    if (!existing) return res.status(404).json({ error: "Resource not found" });
    const actorRoles = await getUserRoles(requesterId);
    const isOwner = existing.addedBy === requesterId;
    const isPrivileged = hasAnyRole(actorRoles, COACH_CAPTAIN_DEPT_HEAD);
    if (!isOwner && !isPrivileged) return res.status(403).json({ error: "Only the creator, a coach, captain, or department head can delete resources" });
    await storage.deleteResource(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting resource:", error);
    res.status(500).json({ error: "Failed to delete resource" });
  }
});

router.post("/seed", async (req, res) => {
  try {
    await storage.seedDatabase();
    res.json({ success: true, message: "Database seeded successfully" });
  } catch (error) {
    console.error("Error seeding database:", error);
    res.status(500).json({ error: "Failed to seed database" });
  }
});

export default router;
