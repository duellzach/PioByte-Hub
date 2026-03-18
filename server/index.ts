import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { storage } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  app.use('/sw.js', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache');
    next();
  });
  app.use(express.static(path.join(__dirname, "../dist")));
}

app.get("/api/users", async (req, res) => {
  try {
    const users = await storage.getUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const normalizedUsername = req.body.username?.toLowerCase().trim();
    const existingUser = await storage.getUserByUsername(normalizedUsername);
    if (existingUser) {
      return res.status(400).json({ error: "Username already taken" });
    }
    const userData = {
      ...req.body,
      username: normalizedUsername,
      password: req.body.password || 'password'
    };
    const user = await storage.createUser(userData);
    res.status(201).json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData = { ...req.body };
    if (updateData.username) {
      updateData.username = updateData.username.toLowerCase().trim();
      const existingUser = await storage.getUserByUsername(updateData.username);
      if (existingUser && existingUser.id !== id) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }
    const user = await storage.updateUser(id, updateData);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteUser(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = username.toLowerCase().trim();
    const user = await storage.getUserByUsername(normalizedUsername);
    if (user && user.password === password) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Failed to log in" });
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    const projects = await storage.getProjects();
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

app.post("/api/projects", async (req, res) => {
  try {
    const project = await storage.createProject(req.body);
    res.status(201).json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

app.put("/api/projects/:id", async (req, res) => {
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

app.delete("/api/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteProject(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await storage.getTasks();
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const task = await storage.createTask(req.body);
    res.status(201).json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const task = await storage.updateTask(id, req.body);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteTask(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

app.get("/api/notifications", async (req, res) => {
  try {
    const notifications = await storage.getNotifications();
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

app.post("/api/notifications", async (req, res) => {
  try {
    const notification = await storage.createNotification(req.body);
    res.status(201).json(notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

app.put("/api/notifications/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const notification = await storage.updateNotification(id, req.body);
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    res.json(notification);
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

app.delete("/api/notifications/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteNotification(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

app.get("/api/announcements", async (req, res) => {
  try {
    const announcements = await storage.getAnnouncements();
    res.json(announcements);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

app.post("/api/announcements", async (req, res) => {
  try {
    const authorId = parseInt(req.body.authorId);
    if (!isNaN(authorId)) {
      const author = await storage.getUser(authorId);
      if (author?.muted) {
        return res.status(403).json({ error: "User is muted and cannot post announcements" });
      }
    }
    const announcement = await storage.createAnnouncement(req.body);
    res.status(201).json(announcement);
  } catch (error) {
    console.error("Error creating announcement:", error);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

app.put("/api/announcements/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const announcement = await storage.updateAnnouncement(id, req.body);
    if (!announcement) return res.status(404).json({ error: "Announcement not found" });
    res.json(announcement);
  } catch (error) {
    console.error("Error updating announcement:", error);
    res.status(500).json({ error: "Failed to update announcement" });
  }
});

app.delete("/api/announcements/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteAnnouncement(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting announcement:", error);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

app.post("/api/users/:id/change-password", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { currentPassword, newPassword } = req.body;
    
    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    if (user.password !== currentPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    
    const updated = await storage.updateUser(id, { password: newPassword });
    res.json({ success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

function roundToQuarterHour(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

app.get("/api/time-entries", async (req, res) => {
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

app.get("/api/time-entries/:id", async (req, res) => {
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

app.post("/api/time-entries/check-in", async (req, res) => {
  try {
    const { userId } = req.body;
    const openEntry = await storage.getOpenTimeEntry(userId);
    if (openEntry) {
      return res.status(400).json({ error: "User already has an open time entry" });
    }
    const entry = await storage.createTimeEntry({
      userId,
      checkInAt: new Date(),
      status: "pending_check_in",
    });
    await storage.createTimeEntryAudit({
      entryId: entry.id,
      actorId: userId,
      actionType: "check_in",
      newValues: { checkInAt: entry.checkInAt },
    });
    res.status(201).json(entry);
  } catch (error) {
    console.error("Error checking in:", error);
    res.status(500).json({ error: "Failed to check in" });
  }
});

app.post("/api/time-entries/:id/check-out", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { userId } = req.body;
    const entry = await storage.getTimeEntry(id);
    if (!entry) return res.status(404).json({ error: "Time entry not found" });
    if (entry.checkOutAt) return res.status(400).json({ error: "Already checked out" });
    
    const checkOutAt = new Date();
    const updated = await storage.updateTimeEntry(id, {
      checkOutAt,
      status: "pending_check_out",
    });
    await storage.createTimeEntryAudit({
      entryId: id,
      actorId: userId,
      actionType: "check_out",
      previousValues: { checkOutAt: null },
      newValues: { checkOutAt },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error checking out:", error);
    res.status(500).json({ error: "Failed to check out" });
  }
});

app.post("/api/time-entries/:id/confirm", async (req, res) => {
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

app.put("/api/time-entries/:id", async (req, res) => {
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

app.get("/api/time-entries/:id/audit", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const audit = await storage.getTimeEntryAudit(id);
    res.json(audit);
  } catch (error) {
    console.error("Error fetching audit:", error);
    res.status(500).json({ error: "Failed to fetch audit" });
  }
});

app.delete("/api/time-entries/:id", async (req, res) => {
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

app.post("/api/time-entries/bulk-add", async (req, res) => {
  try {
    const { coachId, userIds, minutes, notes, date } = req.body;
    const results = [];
    
    const checkInAt = date ? new Date(date) : new Date();
    checkInAt.setHours(9, 0, 0, 0);
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

app.get("/api/scout-events", async (req, res) => {
  try {
    const events = await storage.getScoutEvents();
    res.json(events);
  } catch (error) {
    console.error("Error fetching scout events:", error);
    res.status(500).json({ error: "Failed to fetch scout events" });
  }
});

app.post("/api/scout-events", async (req, res) => {
  try {
    const event = await storage.createScoutEvent(req.body);
    res.status(201).json(event);
  } catch (error) {
    console.error("Error creating scout event:", error);
    res.status(500).json({ error: "Failed to create scout event" });
  }
});

app.put("/api/scout-events/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const event = await storage.updateScoutEvent(id, req.body);
    if (!event) return res.status(404).json({ error: "Scout event not found" });
    res.json(event);
  } catch (error) {
    console.error("Error updating scout event:", error);
    res.status(500).json({ error: "Failed to update scout event" });
  }
});

app.delete("/api/scout-events/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteScoutEvent(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting scout event:", error);
    res.status(500).json({ error: "Failed to delete scout event" });
  }
});

app.get("/api/scout-events/:eventId/pit-scouts", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const scouts = await storage.getPitScouts(eventId);
    res.json(scouts);
  } catch (error) {
    console.error("Error fetching pit scouts:", error);
    res.status(500).json({ error: "Failed to fetch pit scouts" });
  }
});

app.post("/api/scout-events/:eventId/pit-scouts", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const scout = await storage.createPitScout({ ...req.body, eventId });
    res.status(201).json(scout);
  } catch (error) {
    console.error("Error creating pit scout:", error);
    res.status(500).json({ error: "Failed to create pit scout" });
  }
});

app.put("/api/pit-scouts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const scout = await storage.updatePitScout(id, req.body);
    if (!scout) return res.status(404).json({ error: "Pit scout not found" });
    res.json(scout);
  } catch (error) {
    console.error("Error updating pit scout:", error);
    res.status(500).json({ error: "Failed to update pit scout" });
  }
});

app.delete("/api/pit-scouts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deletePitScout(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting pit scout:", error);
    res.status(500).json({ error: "Failed to delete pit scout" });
  }
});

app.get("/api/scout/team/:teamNumber/all-matches", async (req, res) => {
  try {
    const teamNumber = parseInt(req.params.teamNumber);
    if (isNaN(teamNumber) || teamNumber <= 0) {
      return res.status(400).json({ error: "Invalid team number" });
    }
    const matches = await storage.getMatchScoutsByTeam(teamNumber);
    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u: any) => [u.id, u.displayName || u.username]));
    const enriched = matches.map(m => ({ ...m, scoutedByName: userMap.get(m.scoutedBy) || `User ${m.scoutedBy}` }));
    res.json(enriched);
  } catch (error) {
    console.error("Error fetching team match scouts:", error);
    res.status(500).json({ error: "Failed to fetch team match scouts" });
  }
});

app.get("/api/scout-events/:eventId/match-scouts", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const scouts = await storage.getMatchScouts(eventId);
    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u: any) => [u.id, u.displayName || u.username]));
    const enriched = scouts.map(s => ({ ...s, scoutedByName: userMap.get(s.scoutedBy) || `User ${s.scoutedBy}` }));
    res.json(enriched);
  } catch (error) {
    console.error("Error fetching match scouts:", error);
    res.status(500).json({ error: "Failed to fetch match scouts" });
  }
});

app.post("/api/scout-events/:eventId/match-scouts", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const scout = await storage.createMatchScout({ ...req.body, eventId });
    res.status(201).json(scout);
  } catch (error) {
    console.error("Error creating match scout:", error);
    res.status(500).json({ error: "Failed to create match scout" });
  }
});

app.put("/api/match-scouts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const scout = await storage.updateMatchScout(id, req.body);
    if (!scout) return res.status(404).json({ error: "Match scout not found" });
    res.json(scout);
  } catch (error) {
    console.error("Error updating match scout:", error);
    res.status(500).json({ error: "Failed to update match scout" });
  }
});

app.delete("/api/match-scouts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteMatchScout(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting match scout:", error);
    res.status(500).json({ error: "Failed to delete match scout" });
  }
});

app.post("/api/scout-events/:eventId/import", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const { matchScouts: matchData, pitScouts: pitData } = req.body;
    const results: any = { matchScouts: [], skipped: 0, imported: 0, robotsImported: 0, robotsSkipped: 0 };
    if (matchData && Array.isArray(matchData)) {
      const existing = await storage.getMatchScouts(eventId);
      const existingSet = new Set(
        existing.map(e => `${e.matchNumber}-${e.teamNumber}-${e.scoutedBy}`)
      );
      for (const ms of matchData) {
        const { id, createdAt, eventId: _eid, ...cleanMs } = ms;
        const key = `${cleanMs.matchNumber}-${cleanMs.teamNumber}-${cleanMs.scoutedBy}`;
        if (existingSet.has(key)) {
          results.skipped++;
          continue;
        }
        const scout = await storage.createMatchScout({ ...cleanMs, eventId });
        results.matchScouts.push(scout);
        results.imported++;
        existingSet.add(key);
      }
    }
    if (pitData && Array.isArray(pitData)) {
      const existingPits = await storage.getPitScouts(eventId);
      const existingTeams = new Set(existingPits.map(p => p.teamNumber));
      for (const ps of pitData) {
        const { id, createdAt, updatedAt, eventId: _eid, ...cleanPs } = ps;
        if (existingTeams.has(cleanPs.teamNumber)) {
          results.robotsSkipped++;
          continue;
        }
        await storage.createPitScout({ ...cleanPs, eventId });
        results.robotsImported++;
        existingTeams.add(cleanPs.teamNumber);
      }
    }
    res.status(201).json(results);
  } catch (error) {
    console.error("Error importing scout data:", error);
    res.status(500).json({ error: "Failed to import scout data" });
  }
});

const TBA_BASE = "https://www.thebluealliance.com/api/v3";
const TBA_KEY = process.env.TBA_API_KEY || "";

async function tbaFetch(path: string) {
  const resp = await fetch(`${TBA_BASE}${path}`, {
    headers: { "X-TBA-Auth-Key": TBA_KEY },
  });
  if (!resp.ok) throw new Error(`TBA API error: ${resp.status}`);
  return resp.json();
}

app.get("/api/tba/event/:eventKey/matches", async (req, res) => {
  try {
    const data = await tbaFetch(`/event/${req.params.eventKey}/matches`);
    res.json(data);
  } catch (error) {
    console.error("TBA event matches error:", error);
    res.status(500).json({ error: "Failed to fetch TBA event matches" });
  }
});

app.get("/api/tba/event/:eventKey/teams", async (req, res) => {
  try {
    const data = await tbaFetch(`/event/${req.params.eventKey}/teams`);
    res.json(data);
  } catch (error) {
    console.error("TBA event teams error:", error);
    res.status(500).json({ error: "Failed to fetch TBA event teams" });
  }
});

app.get("/api/tba/event/:eventKey/rankings", async (req, res) => {
  try {
    const data = await tbaFetch(`/event/${req.params.eventKey}/rankings`);
    res.json(data);
  } catch (error) {
    console.error("TBA rankings error:", error);
    res.status(500).json({ error: "Failed to fetch TBA rankings" });
  }
});

app.get("/api/tba/team/:teamKey/event/:eventKey/matches", async (req, res) => {
  try {
    const data = await tbaFetch(`/team/${req.params.teamKey}/event/${req.params.eventKey}/matches`);
    res.json(data);
  } catch (error) {
    console.error("TBA team matches error:", error);
    res.status(500).json({ error: "Failed to fetch TBA team matches" });
  }
});

app.get("/api/tba/team/:teamKey/event/:eventKey/status", async (req, res) => {
  try {
    const data = await tbaFetch(`/team/${req.params.teamKey}/event/${req.params.eventKey}/status`);
    res.json(data);
  } catch (error) {
    console.error("TBA team status error:", error);
    res.status(500).json({ error: "Failed to fetch TBA team status" });
  }
});

app.get("/api/tba/team/:teamKey/events/:year", async (req, res) => {
  try {
    const data = await tbaFetch(`/team/${req.params.teamKey}/events/${req.params.year}`);
    res.json(data);
  } catch (error) {
    console.error("TBA team year events error:", error);
    res.status(500).json({ error: "Failed to fetch TBA team year events" });
  }
});

app.get("/api/tba/team/:teamKey/events/:year/statuses", async (req, res) => {
  try {
    const data = await tbaFetch(`/team/${req.params.teamKey}/events/${req.params.year}/statuses`);
    res.json(data);
  } catch (error) {
    console.error("TBA team year statuses error:", error);
    res.status(500).json({ error: "Failed to fetch TBA team year statuses" });
  }
});

app.get("/api/tba/match/:matchKey", async (req, res) => {
  try {
    const data = await tbaFetch(`/match/${req.params.matchKey}`);
    res.json(data);
  } catch (error) {
    console.error("TBA match error:", error);
    res.status(500).json({ error: "Failed to fetch TBA match" });
  }
});

app.get("/api/scout-events/:eventId/export", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const event = await storage.getScoutEvent(eventId);
    if (!event) return res.status(404).json({ error: "Scout event not found" });
    const pitScoutsData = await storage.getPitScouts(eventId);
    const matchScoutsData = await storage.getMatchScouts(eventId);
    res.json({ event, pitScouts: pitScoutsData, matchScouts: matchScoutsData });
  } catch (error) {
    console.error("Error exporting scout data:", error);
    res.status(500).json({ error: "Failed to export scout data" });
  }
});

const NEXUS_BASE = "https://frc.nexus/api/v1";
const NEXUS_KEY = process.env.NEXUS_API_KEY || "";

async function nexusFetch(path: string) {
  if (!NEXUS_KEY) {
    throw new Error("NEXUS_API_KEY environment variable is not configured");
  }
  const resp = await fetch(`${NEXUS_BASE}${path}`, {
    headers: { "Nexus-Api-Key": NEXUS_KEY },
  });
  if (!resp.ok) throw new Error(`Nexus API error: ${resp.status} ${resp.statusText}`);
  return resp.json();
}

app.get("/api/nexus/:eventKey", async (req, res) => {
  try {
    if (!NEXUS_KEY) {
      console.warn("NEXUS_API_KEY is not set — Nexus integration unavailable");
      return res.status(503).json({ error: "Nexus API key not configured. Set NEXUS_API_KEY environment variable." });
    }
    const data = await nexusFetch(`/event/${req.params.eventKey}`);
    res.json(data);
  } catch (error: any) {
    console.error("Nexus event error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch Nexus event data" });
  }
});

app.get("/api/nexus/:eventKey/pits", async (req, res) => {
  try {
    if (!NEXUS_KEY) {
      return res.status(503).json({ error: "Nexus API key not configured. Set NEXUS_API_KEY environment variable." });
    }
    const data = await nexusFetch(`/event/${req.params.eventKey}/pits`);
    res.json(data);
  } catch (error: any) {
    console.error("Nexus pits error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch Nexus pit data" });
  }
});

app.get("/api/scout-events/:eventId/info", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const info = await storage.getEventInfo(eventId);
    res.json(info || { eventId });
  } catch (error) {
    console.error("Error fetching event info:", error);
    res.status(500).json({ error: "Failed to fetch event info" });
  }
});

app.put("/api/scout-events/:eventId/info", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const info = await storage.upsertEventInfo(eventId, req.body);
    res.json(info);
  } catch (error) {
    console.error("Error updating event info:", error);
    res.status(500).json({ error: "Failed to update event info" });
  }
});

app.get("/api/scout-events/:eventId/assignments", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const assignments = await storage.getCompetitionAssignments(eventId);
    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u: any) => [u.id, u.name || u.username]));
    const enriched = assignments.map(a => ({
      ...a,
      userName: userMap.get(a.userId) || `User ${a.userId}`,
      createdByName: userMap.get(a.createdBy) || `User ${a.createdBy}`,
    }));
    res.json(enriched);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

app.post("/api/scout-events/:eventId/assignments", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const assignment = await storage.createCompetitionAssignment({ ...req.body, eventId });
    res.status(201).json(assignment);
  } catch (error) {
    console.error("Error creating assignment:", error);
    res.status(500).json({ error: "Failed to create assignment" });
  }
});

app.put("/api/scout-events/:eventId/assignments/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const assignment = await storage.updateCompetitionAssignment(id, req.body);
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    res.json(assignment);
  } catch (error) {
    console.error("Error updating assignment:", error);
    res.status(500).json({ error: "Failed to update assignment" });
  }
});

app.delete("/api/scout-events/:eventId/assignments/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteCompetitionAssignment(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting assignment:", error);
    res.status(500).json({ error: "Failed to delete assignment" });
  }
});

app.get("/api/competition-checkins", async (req, res) => {
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

app.post("/api/competition-checkins/check-in", async (req, res) => {
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
    res.status(201).json(checkin);
  } catch (error) {
    console.error("Error checking in to competition:", error);
    res.status(500).json({ error: "Failed to check in" });
  }
});

app.post("/api/competition-checkins/:id/check-out", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateCompetitionCheckin(id, {
      checkOutAt: new Date(),
      status: "pending_approval",
    });
    if (!updated) return res.status(404).json({ error: "Checkin not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error checking out from competition:", error);
    res.status(500).json({ error: "Failed to check out" });
  }
});

app.post("/api/competition-checkins/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { coachId, roundedMinutes } = req.body;
    const updated = await storage.updateCompetitionCheckin(id, {
      approvedBy: coachId,
      approvedAt: new Date(),
      status: "approved",
      roundedMinutes: roundedMinutes || undefined,
    });
    if (!updated) return res.status(404).json({ error: "Checkin not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error approving competition checkin:", error);
    res.status(500).json({ error: "Failed to approve checkin" });
  }
});

app.put("/api/competition-checkins/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateCompetitionCheckin(id, req.body);
    if (!updated) return res.status(404).json({ error: "Checkin not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error updating competition checkin:", error);
    res.status(500).json({ error: "Failed to update checkin" });
  }
});

app.delete("/api/competition-checkins/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteCompetitionCheckin(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting competition checkin:", error);
    res.status(500).json({ error: "Failed to delete checkin" });
  }
});

app.get("/api/fullscreen-alerts", async (req, res) => {
  try {
    const activeOnly = req.query.active === "true";
    const alerts = await storage.getFullscreenAlerts(activeOnly);
    res.json(alerts);
  } catch (error) {
    console.error("Error fetching fullscreen alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

app.post("/api/fullscreen-alerts", async (req, res) => {
  try {
    const alert = await storage.createFullscreenAlert(req.body);
    res.status(201).json(alert);
  } catch (error) {
    console.error("Error creating fullscreen alert:", error);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

app.put("/api/fullscreen-alerts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const alert = await storage.updateFullscreenAlert(id, req.body);
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    res.json(alert);
  } catch (error) {
    console.error("Error updating fullscreen alert:", error);
    res.status(500).json({ error: "Failed to update alert" });
  }
});

app.delete("/api/fullscreen-alerts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteFullscreenAlert(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting fullscreen alert:", error);
    res.status(500).json({ error: "Failed to delete alert" });
  }
});

app.post("/api/seed", async (req, res) => {
  try {
    await storage.seedDatabase();
    res.json({ success: true, message: "Database seeded successfully" });
  } catch (error) {
    console.error("Error seeding database:", error);
    res.status(500).json({ error: "Failed to seed database" });
  }
});

if (isProduction) {
  app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

const PORT = isProduction ? 5000 : 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
