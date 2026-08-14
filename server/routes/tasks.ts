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

const MAX_BULK_TASKS = 200;
const STATUS_VALUES = ["Backlog", "Not Started", "In Progress", "Blocked", "Complete"];
const PRIORITY_VALUES = ["Low", "Medium", "High", "Urgent"];
const EFFORT_VALUES = [1, 2, 3, 5, 8];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fields a bulk-import row is allowed to set. Anything else (completedAt,
// history, comments, attachments, requiredCertificationId, ...) is dropped
// even if the client sent it — createTask/createTasksBulk are unfiltered
// inserts, so this whitelist is the only thing standing between a crafted
// payload and writing arbitrary task columns.
function pickBulkTaskFields(row: any) {
  return {
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    effort: row.effort,
    departments: row.departments,
    assignees: row.assignees,
    contributors: row.contributors,
    successCriteria: row.successCriteria,
    startDate: row.startDate,
    dueDate: row.dueDate,
    deptOnly: row.deptOnly,
    dependencies: row.dependencies,
    dependencyTitles: row.dependencyTitles,
  };
}

const normTitle = (s: string) => s.trim().toLowerCase();

router.post("/tasks/bulk", requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const projectId = parseInt(req.body.projectId);
    if (!projectId) return res.status(400).json({ error: "projectId is required" });
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ error: "Board not found" });

    const rows = Array.isArray(req.body.tasks) ? req.body.tasks : [];
    if (rows.length === 0) return res.status(400).json({ error: "No tasks to import" });
    if (rows.length > MAX_BULK_TASKS) {
      return res.status(400).json({ error: `Import is limited to ${MAX_BULK_TASKS} tasks per file (got ${rows.length}).` });
    }

    const allUsers = await storage.getUsers();
    const userIds = new Set(allUsers.map(u => u.id));
    const existingTasks = await storage.getTasksByProject(projectId);
    const existingTaskIds = new Set(existingTasks.map(t => t.id));

    const errors: { row: number; message: string }[] = [];
    // Rows that pass individual field validation and are candidates for
    // insertion. Same-file dependency resolution (which needs to know every
    // row's title, including ones later in the file) happens in a second
    // pass below, over this list — not inside the per-row loop.
    const candidates: { rowNum: number; title: string; dependencyTitleNames: string[]; data: any }[] = [];

    rows.forEach((row: any, i: number) => {
      const rowNum = i + 1;
      const picked = pickBulkTaskFields(row);

      const title = typeof picked.title === "string" ? picked.title.trim() : "";
      if (!title) { errors.push({ row: rowNum, message: "Title is required" }); return; }

      const status = STATUS_VALUES.includes(picked.status) ? picked.status : "Not Started";
      const priority = PRIORITY_VALUES.includes(picked.priority) ? picked.priority : "Medium";

      let effort: number | undefined;
      if (picked.effort !== undefined && picked.effort !== null && picked.effort !== "") {
        const n = Number(picked.effort);
        if (!EFFORT_VALUES.includes(n)) { errors.push({ row: rowNum, message: `Invalid effort "${picked.effort}"` }); return; }
        effort = n;
      }

      const departments = Array.isArray(picked.departments) ? picked.departments.filter((d: any) => typeof d === "string") : [];

      const assignees = Array.isArray(picked.assignees) ? picked.assignees.map(Number).filter((n: number) => Number.isFinite(n)) : [];
      const badAssignee = assignees.find((id: number) => !userIds.has(id));
      if (badAssignee !== undefined) { errors.push({ row: rowNum, message: `Unknown assignee id ${badAssignee}` }); return; }

      const contributors = Array.isArray(picked.contributors) ? picked.contributors.map(Number).filter((n: number) => Number.isFinite(n)) : [];
      const badContributor = contributors.find((id: number) => !userIds.has(id));
      if (badContributor !== undefined) { errors.push({ row: rowNum, message: `Unknown contributor id ${badContributor}` }); return; }

      // "" (never null) for an unset date — every other task-creation path in
      // the app writes "" for "no date" (see the New Task template at
      // KanbanBoard.tsx:621) and TaskCard renders task.dueDate through
      // parseLocalDate() with no null guard, so a null here would crash the
      // board the moment a card with no due date renders.
      if (picked.startDate && !DATE_RE.test(picked.startDate)) {
        errors.push({ row: rowNum, message: `Invalid Start Date "${picked.startDate}"` }); return;
      }
      const startDate = picked.startDate && DATE_RE.test(picked.startDate) ? picked.startDate : "";
      if (picked.dueDate && !DATE_RE.test(picked.dueDate)) {
        errors.push({ row: rowNum, message: `Invalid Due Date "${picked.dueDate}"` }); return;
      }
      const dueDate = picked.dueDate && DATE_RE.test(picked.dueDate) ? picked.dueDate : "";

      const successCriteria = Array.isArray(picked.successCriteria)
        ? picked.successCriteria.map((c: any, ci: number) => ({
            id: c?.id || `bulk-${Date.now()}-${rowNum}-${ci}`,
            text: String(c?.text ?? c ?? ""),
            completed: !!c?.completed,
          })).filter((c: any) => c.text)
        : [];

      // Dependencies on tasks already on the board are pre-resolved to ids
      // by the client (it can see titles that don't exist yet, we can't).
      // Anything that isn't already a real task on this board is dropped
      // rather than failing the row.
      const dependencies = Array.isArray(picked.dependencies)
        ? picked.dependencies.map(Number).filter((n: number) => existingTaskIds.has(n))
        : [];

      const dependencyTitleNames = Array.isArray(picked.dependencyTitles)
        ? picked.dependencyTitles.filter((t: any) => typeof t === "string" && t.trim()).map((t: string) => t.trim())
        : [];

      candidates.push({
        rowNum, title, dependencyTitleNames,
        data: {
          projectId, // always the board this request targets, never a per-row value
          title,
          description: typeof picked.description === "string" ? picked.description : "",
          status, priority, effort,
          departments,
          assignees, contributors,
          successCriteria,
          startDate, dueDate,
          deptOnly: !!picked.deptOnly,
          dependencies,
        },
      });
    });

    if (candidates.length === 0) {
      return res.status(400).json({ created: 0, tasks: [], errors });
    }

    // Second pass: resolve same-file Dependencies (a row naming another
    // row's title, which had no id until now) against the titles that are
    // actually about to be inserted. The client already does this and
    // blocks self-references, ambiguous titles, and cycles before sending —
    // this is the non-negotiable server-side re-check, so on any of those
    // the whole batch is rejected (nothing has been written yet) rather
    // than silently dropping links or partially importing.
    const titleToCandidate = new Map<string, number>();
    const ambiguousTitles = new Set<string>();
    candidates.forEach((c, idx) => {
      const key = normTitle(c.title);
      if (titleToCandidate.has(key)) ambiguousTitles.add(key);
      else titleToCandidate.set(key, idx);
    });

    const edges: number[][] = candidates.map(() => []);
    for (const c of candidates) {
      const fromIdx = titleToCandidate.get(normTitle(c.title))!;
      for (const name of c.dependencyTitleNames) {
        const key = normTitle(name);
        if (key === normTitle(c.title)) {
          return res.status(400).json({ error: `Row ${c.rowNum}: a task can't depend on itself ("${name}").` });
        }
        if (ambiguousTitles.has(key)) {
          return res.status(400).json({ error: `Row ${c.rowNum}: multiple tasks in this file are named "${name}" — can't tell which one this depends on.` });
        }
        const targetIdx = titleToCandidate.get(key);
        if (targetIdx === undefined) continue; // no matching row being inserted — link silently dropped
        edges[fromIdx].push(targetIdx);
      }
    }

    // Cycle detection (DFS, recursion-stack coloring) over the same-file
    // dependency graph. Any cycle rejects the whole batch.
    const UNVISITED = 0, VISITING = 1, DONE = 2;
    const state = new Array(candidates.length).fill(UNVISITED);
    const stack: number[] = [];
    let cycleMessage: string | null = null;
    const detectCycle = (u: number) => {
      if (cycleMessage) return;
      state[u] = VISITING; stack.push(u);
      for (const v of edges[u]) {
        if (cycleMessage) return;
        if (state[v] === VISITING) {
          const start = stack.indexOf(v);
          const cyc = stack.slice(start);
          const names = [...cyc.map(n => candidates[n].title), candidates[v].title];
          cycleMessage = `Circular dependency: ${names.join(" → ")}`;
          return;
        } else if (state[v] === UNVISITED) {
          detectCycle(v);
        }
      }
      stack.pop();
      state[u] = DONE;
    };
    for (let i = 0; i < candidates.length && !cycleMessage; i++) {
      if (state[i] === UNVISITED) detectCycle(i);
    }
    if (cycleMessage) return res.status(400).json({ error: cycleMessage });

    const toInsert = candidates.map((c, idx) => ({
      ...c.data,
      dependencyTitles: edges[idx].map(t => candidates[t].title),
    }));

    const created = await storage.createTasksBulk(toInsert);
    res.status(201).json({ created: created.length, tasks: created, errors });
  } catch (error) {
    console.error("Error bulk-creating tasks:", error);
    res.status(500).json({ error: "Failed to import tasks" });
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
