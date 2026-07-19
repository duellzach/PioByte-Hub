import { Router } from "express";
import { storage } from "../storage";
import { requireRoles } from "../middleware/auth";

const MANAGERS = ["Coach", "Team Captain", "SCRUM Master", "Department Head"];

const router = Router();

router.get("/recurring-tasks", async (_req, res) => {
  try {
    res.json(await storage.getRecurringTemplates());
  } catch (error) {
    console.error("Error fetching recurring templates:", error);
    res.status(500).json({ error: "Failed to fetch recurring tasks" });
  }
});

router.post("/recurring-tasks", requireRoles(...MANAGERS), async (req, res) => {
  try {
    const { title, projectId, frequency } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    if (!projectId) return res.status(400).json({ error: "A project is required" });
    if (!["daily", "weekly", "biweekly", "monthly"].includes(frequency)) {
      return res.status(400).json({ error: "Invalid frequency" });
    }
    const template = await storage.createRecurringTemplate({
      title: title.trim(),
      description: req.body.description || "",
      projectId: parseInt(projectId),
      priority: req.body.priority || "Medium",
      effort: req.body.effort ?? null,
      departments: req.body.departments || [],
      assignees: (req.body.assignees || []).map((a: any) => parseInt(a)),
      deptOnly: !!req.body.deptOnly,
      frequency,
      dueOffsetDays: parseInt(req.body.dueOffsetDays) || 0,
      active: req.body.active !== false,
      createdBy: req.userId!,
    });
    // Generate the first instance right away so it appears immediately.
    await storage.generateDueRecurringTasks().catch(() => {});
    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating recurring template:", error);
    res.status(500).json({ error: "Failed to create recurring task" });
  }
});

router.put("/recurring-tasks/:id", requireRoles(...MANAGERS), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data: any = { ...req.body };
    delete data.createdBy;
    if (data.assignees) data.assignees = data.assignees.map((a: any) => parseInt(a));
    if (data.projectId) data.projectId = parseInt(data.projectId);
    const updated = await storage.updateRecurringTemplate(id, data);
    if (!updated) return res.status(404).json({ error: "Recurring task not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error updating recurring template:", error);
    res.status(500).json({ error: "Failed to update recurring task" });
  }
});

router.delete("/recurring-tasks/:id", requireRoles(...MANAGERS), async (req, res) => {
  try {
    await storage.deleteRecurringTemplate(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting recurring template:", error);
    res.status(500).json({ error: "Failed to delete recurring task" });
  }
});

// Manual trigger (also runs automatically on a schedule) — useful to fill in a
// due instance on demand.
router.post("/recurring-tasks/generate-now", requireRoles(...MANAGERS), async (_req, res) => {
  try {
    const created = await storage.generateDueRecurringTasks();
    res.json({ created });
  } catch (error) {
    console.error("Error generating recurring tasks:", error);
    res.status(500).json({ error: "Failed to generate recurring tasks" });
  }
});

export default router;
