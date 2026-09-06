import { Router } from "express";
import { storage } from "../storage";
import { roundToQuarterHour, getUserRoles, hasAnyRole, COACH_CAPTAIN, LEADERSHIP_ALL } from "../helpers";
import { requireRoles } from "../middleware/auth";
import { isHourCategory } from "../../shared/hourCategories";
import { localDatePT, pacificDateTime } from "../../utils/dates";
import { getTeamTimezone } from "../services/teamTime";

const router = Router();

/**
 * Record that a member worked on a task. Contributors are additive and never
 * removed here — the list is a record of who touched the task, separate from
 * `assignees` (who owns it).
 */
async function creditContributor(taskId: number, userId: number): Promise<void> {
  const task = await storage.getTask(taskId);
  if (!task) return;
  const current: number[] = Array.isArray(task.contributors) ? (task.contributors as number[]) : [];
  if (current.includes(userId)) return;
  await storage.updateTask(taskId, { contributors: [...current, userId] });
}

router.get("/time-entries", async (req, res) => {
  try {
    const entries = await storage.getTimeEntries();
    for (const entry of entries) {
      if (entry.checkOutAt && entry.roundedMinutes != null && entry.checkOutConfirmedBy && entry.status !== 'completed') {
        await storage.updateTimeEntry(entry.id, { status: 'completed' });
        entry.status = 'completed';
      } else if (entry.checkOutAt && entry.status === 'checked_in') {
        await storage.updateTimeEntry(entry.id, { status: 'pending_check_out' });
        entry.status = 'pending_check_out';
      }
    }
    res.json(entries);
  } catch (error) {
    console.error("Error fetching time entries:", error);
    res.status(500).json({ error: "Failed to fetch time entries" });
  }
});

// The task menu for a check-in or a mid-session switch. `userId` only decides
// whose assignments float to the top, so a non-leadership caller asking about
// someone else is quietly answered for themselves rather than refused.
router.get("/time-entries/available-tasks", async (req, res) => {
  try {
    const requested = parseInt(req.query.userId as string);
    const isLeadership = hasAnyRole(req.userRoles || [], LEADERSHIP_ALL);
    const userId = Number.isFinite(requested) && (isLeadership || requested === req.userId)
      ? requested
      : req.userId!;
    res.json(await storage.getAvailableTasksForUser(userId));
  } catch (error) {
    console.error("Error fetching available tasks:", error);
    res.status(500).json({ error: "Failed to fetch available tasks" });
  }
});

router.get("/time-entries/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const entry = await storage.getTimeEntry(id);
    if (!entry) return res.status(404).json({ error: "Time entry not found" });
    res.json(entry);
  } catch (error) {
    console.error("Error fetching time entry:", error);
    res.status(500).json({ error: "Failed to fetch time entry" });
  }
});

router.post("/time-entries/check-in", async (req, res) => {
  try {
    const { userId } = req.body;
    const kind = req.body.kind === undefined ? "shop" : req.body.kind;
    if (!isHourCategory(kind)) {
      return res.status(400).json({ error: `Unknown time category "${kind}"` });
    }
    const calendarEventId = req.body.calendarEventId ? parseInt(req.body.calendarEventId) : null;

    // Every non-shop kind is clocked against a calendar event. Events that take
    // sign-ups block clock-in only once a signup has been explicitly declined;
    // requested/waitlisted/no-signup-yet are all still clockable — a coach
    // still confirms the hours either way.
    if (kind !== "shop") {
      if (!calendarEventId) return res.status(400).json({ error: "An event is required for this kind of time" });
      const event = await storage.getCalendarEvent(calendarEventId);
      if (!event) return res.status(404).json({ error: "Event not found" });
      if (event.signupEnabled) {
        const signup = await storage.getEventSignup(calendarEventId, parseInt(userId));
        if (signup && signup.status === "declined") {
          return res.status(403).json({ error: "Your sign-up for this event was declined" });
        }
      }
    }

    const openEntry = await storage.getOpenTimeEntry(userId);
    if (openEntry) {
      return res.status(400).json({ error: "User already has an open time entry" });
    }
    const entry = await storage.createTimeEntry({
      userId,
      checkInAt: new Date(),
      status: "pending_check_in",
      kind,
      calendarEventId: kind === "shop" ? null : calendarEventId,
    });
    await storage.createTimeEntryAudit({
      entryId: entry.id,
      actorId: userId,
      actionType: "check_in",
      newValues: { checkInAt: entry.checkInAt, kind },
    });
    // Reflect the student on the event's attendance roster immediately, so
    // "Here Now" (and emergency headcounts) include self clock-ins — not just
    // coach-driven check-ins. Non-fatal: never block the clock-in on this.
    if (kind !== "shop" && calendarEventId) {
      storage.selfCheckInSignup(calendarEventId, parseInt(userId), entry.checkInAt)
        .catch((e) => console.error("selfCheckInSignup:", e));
    }
    res.status(201).json(entry);
  } catch (error) {
    console.error("Error checking in:", error);
    res.status(500).json({ error: "Failed to check in" });
  }
});

router.post("/time-entries/:id/check-out", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { userId, taskHandoffNote, markTaskComplete } = req.body;
    const entry = await storage.getTimeEntry(id);
    if (!entry) return res.status(404).json({ error: "Time entry not found" });
    if (entry.checkOutAt) return res.status(400).json({ error: "Already checked out" });

    const checkOutAt = new Date();
    const updateData: any = { checkOutAt, status: "pending_check_out" };
    if (taskHandoffNote !== undefined) updateData.taskHandoffNote = taskHandoffNote;

    const updated = await storage.updateTimeEntry(id, updateData);
    await storage.createTimeEntryAudit({
      entryId: id,
      actorId: userId,
      actionType: "check_out",
      previousValues: { checkOutAt: null },
      newValues: { checkOutAt },
    });
    // Clear the roster's "here now" state when clocking out of an event.
    if (entry.kind !== "shop" && entry.calendarEventId) {
      storage.selfCheckOutSignup(entry.calendarEventId, entry.userId, checkOutAt)
        .catch((e) => console.error("selfCheckOutSignup:", e));
    }

    // Close the open task stretch so the session's last task keeps its minutes.
    await storage.closeOpenTaskSegments(id, checkOutAt);

    if (entry.workingOnTaskId) {
      await creditContributor(entry.workingOnTaskId, entry.userId);
      if (markTaskComplete) {
        await storage.updateTask(entry.workingOnTaskId, {
          status: 'Complete',
          completedAt: new Date(),
        });
      }
    }

    res.json(updated);
  } catch (error) {
    console.error("Error checking out:", error);
    res.status(500).json({ error: "Failed to check out" });
  }
});

router.post("/time-entries/:id/confirm", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { coachId, confirmType } = req.body;
    const entry = await storage.getTimeEntry(id);
    if (!entry) return res.status(404).json({ error: "Time entry not found" });

    let updates: any = {};
    let newStatus = entry.status;
    let roundedMinutes = entry.roundedMinutes;

    if (confirmType === "check_in") {
      updates.checkInConfirmedBy = coachId;
      updates.checkInConfirmedAt = new Date();
      if (entry.checkOutAt) {
        newStatus = "pending_check_out";
      } else {
        newStatus = "checked_in";
      }
    } else if (confirmType === "check_out") {
      updates.checkOutConfirmedBy = coachId;
      updates.checkOutConfirmedAt = new Date();
      newStatus = "completed";
      if (entry.checkInAt && entry.checkOutAt) {
        const duration = new Date(entry.checkOutAt).getTime() - new Date(entry.checkInAt).getTime();
        const minutes = Math.floor(duration / 60000);
        roundedMinutes = roundToQuarterHour(minutes);
        updates.roundedMinutes = roundedMinutes;
      }
    }
    updates.status = newStatus;

    const updated = await storage.updateTimeEntry(id, updates);
    await storage.createTimeEntryAudit({
      entryId: id,
      actorId: coachId,
      actionType: `confirm_${confirmType}`,
      previousValues: { status: entry.status },
      newValues: { status: newStatus, roundedMinutes },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error confirming:", error);
    res.status(500).json({ error: "Failed to confirm" });
  }
});

router.put("/time-entries/:id", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { coachId, checkInAt, checkOutAt, notes } = req.body;
    const entry = await storage.getTimeEntry(id);
    if (!entry) return res.status(404).json({ error: "Time entry not found" });

    const previousValues: any = {};
    const newValues: any = {};
    const updates: any = {};

    if (checkInAt !== undefined) {
      previousValues.checkInAt = entry.checkInAt;
      newValues.checkInAt = checkInAt;
      updates.checkInAt = new Date(checkInAt);
    }
    if (checkOutAt !== undefined) {
      previousValues.checkOutAt = entry.checkOutAt;
      newValues.checkOutAt = checkOutAt;
      updates.checkOutAt = checkOutAt ? new Date(checkOutAt) : null;
    }
    if (notes !== undefined) {
      previousValues.notes = entry.notes;
      newValues.notes = notes;
      updates.notes = notes;
    }

    if (updates.checkInAt || updates.checkOutAt) {
      const inTime = updates.checkInAt || entry.checkInAt;
      const outTime = updates.checkOutAt || entry.checkOutAt;
      if (inTime && outTime) {
        const duration = new Date(outTime).getTime() - new Date(inTime).getTime();
        const minutes = Math.floor(duration / 60000);
        const newRounded = roundToQuarterHour(minutes);
        const deltaMinutes = newRounded - (entry.roundedMinutes || 0);
        updates.roundedMinutes = newRounded;
        newValues.roundedMinutes = newRounded;

        await storage.createTimeEntryAudit({
          entryId: id,
          actorId: coachId,
          actionType: "edit",
          previousValues,
          newValues,
          deltaMinutes,
        });
      }
    } else if (notes !== undefined) {
      await storage.createTimeEntryAudit({
        entryId: id,
        actorId: coachId,
        actionType: "edit_notes",
        previousValues,
        newValues,
      });
    }

    const updated = await storage.updateTimeEntry(id, updates);
    res.json(updated);
  } catch (error) {
    console.error("Error updating time entry:", error);
    res.status(500).json({ error: "Failed to update time entry" });
  }
});

router.get("/time-entries/:id/audit", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const audit = await storage.getTimeEntryAudit(id);
    res.json(audit);
  } catch (error) {
    console.error("Error fetching audit:", error);
    res.status(500).json({ error: "Failed to fetch audit" });
  }
});

router.delete("/time-entries/:id", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { coachId } = req.body;
    const entry = await storage.getTimeEntry(id);
    if (entry) {
      await storage.createTimeEntryAudit({
        entryId: id,
        actorId: coachId,
        actionType: "delete",
        previousValues: entry,
      });
    }
    await storage.deleteTimeEntry(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting time entry:", error);
    res.status(500).json({ error: "Failed to delete time entry" });
  }
});

/**
 * Point a session at a task — at check-in, or any time during it.
 *
 * Two callers, one route:
 *  - the member themselves, switching to whatever they've moved onto (they do
 *    NOT have to be an assignee — helping on someone else's task is the norm);
 *  - leadership, moving a member onto different work mid-class.
 *
 * Switching credits the task being left as a contribution, since the member
 * demonstrably worked on it — check-out credits only the task still open.
 */
router.patch("/time-entries/:id/set-working-on", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { userId, taskId, generalTaskId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    if (taskId != null && generalTaskId != null) {
      return res.status(400).json({ error: "Cannot set both taskId and generalTaskId" });
    }
    const entry = await storage.getTimeEntry(id);
    if (!entry) return res.status(404).json({ error: "Time entry not found" });

    const actorId = req.userId!;
    const isSelf = entry.userId === actorId;
    if (!isSelf && !hasAnyRole(req.userRoles || [], LEADERSHIP_ALL)) {
      return res.status(403).json({ error: "Only leadership can change what someone else is working on" });
    }
    if (entry.checkOutAt || entry.status === "completed") {
      return res.status(400).json({ error: "That session is already closed" });
    }
    // A retired board's work is not something to put anyone on.
    if (taskId != null) {
      const task = await storage.getTask(parseInt(taskId));
      if (!task) return res.status(404).json({ error: "Task not found" });
      const project = await storage.getProject(task.projectId);
      if (!project || project.archived) {
        return res.status(400).json({ error: "That task is on an archived board" });
      }
    }

    const { entry: updated, closed } = await storage.setWorkingOn(
      id,
      taskId ?? null,
      generalTaskId ?? null,
      actorId,
    );

    // Credit the task they're stepping off of, if any.
    if (closed?.taskId && closed.taskId !== (taskId ?? null)) {
      await creditContributor(closed.taskId, entry.userId);
    }

    await storage.createTimeEntryAudit({
      entryId: id,
      actorId,
      actionType: isSelf ? "switch_task" : "reassign_task",
      previousValues: {
        workingOnTaskId: entry.workingOnTaskId ?? null,
        workingOnGeneralTaskId: entry.workingOnGeneralTaskId ?? null,
      },
      newValues: { workingOnTaskId: taskId ?? null, workingOnGeneralTaskId: generalTaskId ?? null },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error setting working-on:", error);
    res.status(500).json({ error: "Failed to update working task" });
  }
});

router.post("/time-entries/bulk-add", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const { coachId, userIds, minutes, notes, date } = req.body;
    const results = [];

    // Build 9 AM team-local on the given date (or today, team-local, if no date supplied).
    const tz = await getTeamTimezone();
    const checkInAt = pacificDateTime(date || localDatePT(new Date(), tz), '09:00', tz);
    const checkOutAt = new Date(checkInAt.getTime() + minutes * 60000);
    const roundedMinutes = roundToQuarterHour(minutes);

    for (const userId of userIds) {
      const entry = await storage.createTimeEntry({
        userId,
        checkInAt,
        checkOutAt,
        checkInConfirmedBy: coachId,
        checkInConfirmedAt: new Date(),
        checkOutConfirmedBy: coachId,
        checkOutConfirmedAt: new Date(),
        status: "completed",
        roundedMinutes,
        notes: notes || `Class time - ${roundedMinutes} minutes`,
      });

      await storage.createTimeEntryAudit({
        entryId: entry.id,
        actorId: coachId,
        actionType: "bulk_add",
        newValues: { minutes: roundedMinutes, notes: entry.notes },
      });

      results.push(entry);
    }

    res.status(201).json(results);
  } catch (error) {
    console.error("Error bulk adding time:", error);
    res.status(500).json({ error: "Failed to bulk add time" });
  }
});

router.get("/general-tasks", async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    if (includeArchived) {
      const requesterId = parseInt(req.query.requesterId as string);
      if (!requesterId) return res.status(400).json({ error: "requesterId required for includeArchived" });
      const actorRoles = await getUserRoles(requesterId);
      if (!hasAnyRole(actorRoles, ['Coach'])) {
        return res.status(403).json({ error: "Only coaches can view archived tasks" });
      }
    }
    const items = await storage.getGeneralTasks(includeArchived);
    res.json(items);
  } catch (error) {
    console.error("Error fetching general tasks:", error);
    res.status(500).json({ error: "Failed to fetch general tasks" });
  }
});

router.post("/general-tasks", async (req, res) => {
  try {
    const { name, description, createdBy } = req.body;
    if (!name || !createdBy) return res.status(400).json({ error: "name and createdBy required" });
    const actorRoles = await getUserRoles(parseInt(createdBy));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only coaches and captains can create general tasks" });
    }
    const task = await storage.createGeneralTask({ name, description: description || '', active: true, createdBy: parseInt(createdBy) });
    res.json(task);
  } catch (error) {
    console.error("Error creating general task:", error);
    res.status(500).json({ error: "Failed to create general task" });
  }
});

router.put("/general-tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { updatedBy, ...fields } = req.body;
    if (!updatedBy) return res.status(400).json({ error: "updatedBy required" });
    const actorRoles = await getUserRoles(parseInt(updatedBy));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only coaches and captains can edit general tasks" });
    }
    const sanitized: any = {};
    if (fields.name !== undefined) sanitized.name = fields.name;
    if (fields.description !== undefined) sanitized.description = fields.description || '';
    if (fields.active !== undefined) sanitized.active = fields.active;
    const updated = await storage.updateGeneralTask(id, sanitized);
    if (!updated) return res.status(404).json({ error: "General task not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error updating general task:", error);
    res.status(500).json({ error: "Failed to update general task" });
  }
});

router.delete("/general-tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { deletedBy } = req.body;
    if (!deletedBy) return res.status(400).json({ error: "deletedBy required" });
    const actorRoles = await getUserRoles(parseInt(deletedBy));
    if (!hasAnyRole(actorRoles, ['Coach'])) {
      return res.status(403).json({ error: "Only coaches can permanently delete general tasks" });
    }
    await storage.deleteGeneralTask(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting general task:", error);
    res.status(500).json({ error: "Failed to delete general task" });
  }
});

export default router;
