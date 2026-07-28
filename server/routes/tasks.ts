import { Router } from "express";
import { storage } from "../storage";
import { requireRoles } from "../middleware/auth";

const router = Router();

// Mirrors the client-side gates in KanbanBoard: leadership manages any task;
// members create only where a board opts in, and edit only tasks they're on.
const LEADERSHIP = ["Coach", "Team Captain", "Department Head", "SCRUM Master"];
const isLeader = (req: any) => (req.userRoles || []).some((r: string) => LEADERSHIP.includes(r));

router.get("/tasks", async (req, res) => {
  try {
    const tasks = await storage.getTasks();
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    // Members can create only on boards that opted into open task creation.
    if (!isLeader(req)) {
      const projectId = parseInt(req.body.projectId);
      const project = projectId ? await storage.getProject(projectId) : undefined;
      if (!project || !project.allowAllTaskCreation) {
        return res.status(403).json({ error: "You don't have permission to create tasks on this board" });
      }
    }
    const task = await storage.createTask(req.body);
    res.status(201).json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.put("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Non-leaders may only edit a task they're assigned to or contributing on.
    if (!isLeader(req)) {
      const existing = await storage.getTask(id);
      if (!existing) return res.status(404).json({ error: "Task not found" });
      const onTask = [
        ...((existing.assignees as number[]) || []),
        ...((existing.contributors as number[]) || []),
      ].includes(req.userId!);
      if (!onTask) {
        return res.status(403).json({ error: "You can only edit tasks you're assigned to" });
      }
    }
    const task = await storage.updateTask(id, req.body);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/tasks/:id", requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteTask(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;
