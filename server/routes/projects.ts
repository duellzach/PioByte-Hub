import { Router } from "express";
import { storage } from "../storage";
import { requireRoles } from "../middleware/auth";

const router = Router();

// Who may manage boards (rename, edit description/links, toggle settings). Per
// team direction, any global SCRUM Master may manage any board, alongside
// leadership. Board deletion is restricted further to Coach/Team Captain below.
const BOARD_MANAGERS = ["Coach", "Team Captain", "Department Head", "SCRUM Master"];

router.get("/projects", async (req, res) => {
  try {
    const projects = await storage.getProjects();
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/projects", requireRoles(...BOARD_MANAGERS), async (req, res) => {
  try {
    const project = await storage.createProject(req.body);
    res.status(201).json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.put("/projects/:id", requireRoles(...BOARD_MANAGERS), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const project = await storage.updateProject(id, req.body);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", requireRoles("Coach", "Team Captain"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteProject(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;
