import { db } from "./db";
import { users, projects, tasks, notifications, announcements, generalTasks, timeEntries, timeEntryAudit, scoutEvents, pitScouts, matchScouts, competitionAssignments, eventInfo, competitionCheckins, competitionCheckinAudit, fullscreenAlerts, teamClaims, safetyCertifications, userCertifications, certificationRequests, calendarEvents, resources } from "../shared/schema";
import type { User, InsertUser, Project, InsertProject, Task, InsertTask, Notification, InsertNotification, Announcement, InsertAnnouncement, GeneralTask, InsertGeneralTask, TimeEntry, InsertTimeEntry, TimeEntryAudit, InsertTimeEntryAudit, ScoutEvent, InsertScoutEvent, PitScout, InsertPitScout, MatchScout, InsertMatchScout, CompetitionAssignment, InsertCompetitionAssignment, EventInfo, InsertEventInfo, CompetitionCheckin, InsertCompetitionCheckin, CompetitionCheckinAudit, InsertCompetitionCheckinAudit, FullscreenAlert, InsertFullscreenAlert, TeamClaim, SafetyCertification, InsertSafetyCertification, UserCertification, CertificationRequest, CalendarEvent, InsertCalendarEvent, Resource, InsertResource } from "../shared/schema";
import { eq, desc, and, isNull, lt, inArray, sql } from "drizzle-orm";

function toDate(value: any): Date | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  return undefined;
}

function migrateSuccessCriteria(criteria: any[]): {id: string; text: string; completed: boolean}[] {
  if (!Array.isArray(criteria)) return [];
  return criteria.map((item, idx) => {
    if (typeof item === 'string') {
      return { id: `migrated-${idx}-${Date.now()}`, text: item, completed: false };
    }
    return item;
  });
}

function sanitizeTask(task: any): any {
  const sanitized: any = { ...task };
  if ('createdAt' in sanitized) sanitized.createdAt = toDate(sanitized.createdAt);
  if ('completedAt' in sanitized) sanitized.completedAt = toDate(sanitized.completedAt);
  return sanitized;
}

function sanitizeProject(project: any): any {
  const sanitized: any = { ...project };
  if ('createdAt' in sanitized) sanitized.createdAt = toDate(sanitized.createdAt);
  return sanitized;
}

function sanitizeNotification(notification: any): any {
  const sanitized: any = { ...notification };
  if ('timestamp' in sanitized) sanitized.timestamp = toDate(sanitized.timestamp);
  return sanitized;
}

function sanitizeAnnouncement(announcement: any): any {
  const sanitized: any = { ...announcement };
  if ('timestamp' in sanitized) sanitized.timestamp = toDate(sanitized.timestamp);
  return sanitized;
}

function sanitizeUser(user: any): any {
  const sanitized: any = { ...user };
  delete sanitized.id;
  delete sanitized.createdAt;
  return sanitized;
}

function sanitizeTimeEntry(entry: any): any {
  const sanitized: any = { ...entry };
  if ('checkInAt' in sanitized) sanitized.checkInAt = toDate(sanitized.checkInAt);
  if ('checkOutAt' in sanitized) sanitized.checkOutAt = toDate(sanitized.checkOutAt);
  if ('checkInConfirmedAt' in sanitized) sanitized.checkInConfirmedAt = toDate(sanitized.checkInConfirmedAt);
  if ('checkOutConfirmedAt' in sanitized) sanitized.checkOutConfirmedAt = toDate(sanitized.checkOutConfirmedAt);
  if ('createdAt' in sanitized) sanitized.createdAt = toDate(sanitized.createdAt);
  return sanitized;
}

export interface IStorage {
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;

  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;

  getTasks(): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  getTasksByProject(projectId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;

  getNotifications(): Promise<Notification[]>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, notification: Partial<InsertNotification>): Promise<Notification | undefined>;
  deleteNotification(id: number): Promise<void>;

  getAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  updateAnnouncement(id: number, announcement: Partial<InsertAnnouncement>): Promise<Announcement | undefined>;
  deleteAnnouncement(id: number): Promise<void>;

  getScoutEvents(): Promise<ScoutEvent[]>;
  getScoutEvent(id: number): Promise<ScoutEvent | undefined>;
  createScoutEvent(event: InsertScoutEvent): Promise<ScoutEvent>;
  updateScoutEvent(id: number, event: Partial<InsertScoutEvent>): Promise<ScoutEvent | undefined>;
  deleteScoutEvent(id: number): Promise<void>;

  getPitScouts(eventId: number): Promise<PitScout[]>;
  getPitScout(id: number): Promise<PitScout | undefined>;
  createPitScout(scout: InsertPitScout): Promise<PitScout>;
  updatePitScout(id: number, scout: Partial<InsertPitScout>): Promise<PitScout | undefined>;
  deletePitScout(id: number): Promise<void>;

  getMatchScouts(eventId: number): Promise<MatchScout[]>;
  getMatchScoutsByTeam(teamNumber: number): Promise<any[]>;
  getMatchScout(id: number): Promise<MatchScout | undefined>;
  createMatchScout(scout: InsertMatchScout): Promise<MatchScout>;
  updateMatchScout(id: number, scout: Partial<InsertMatchScout>): Promise<MatchScout | undefined>;
  deleteMatchScout(id: number): Promise<void>;

  getCompetitionAssignments(eventId: number): Promise<CompetitionAssignment[]>;
  getCompetitionAssignment(id: number): Promise<CompetitionAssignment | undefined>;
  createCompetitionAssignment(assignment: InsertCompetitionAssignment): Promise<CompetitionAssignment>;
  updateCompetitionAssignment(id: number, assignment: Partial<InsertCompetitionAssignment>): Promise<CompetitionAssignment | undefined>;
  deleteCompetitionAssignment(id: number): Promise<void>;

  getEventInfo(eventId: number): Promise<EventInfo | undefined>;
  upsertEventInfo(eventId: number, data: Partial<InsertEventInfo>): Promise<EventInfo>;
  deleteEventInfo(eventId: number): Promise<void>;

  getCompetitionCheckins(eventId: number): Promise<CompetitionCheckin[]>;
  getCompetitionCheckinsByUser(userId: number): Promise<CompetitionCheckin[]>;
  getOpenCompetitionCheckin(userId: number, eventId: number): Promise<CompetitionCheckin | undefined>;
  createCompetitionCheckin(checkin: InsertCompetitionCheckin): Promise<CompetitionCheckin>;
  updateCompetitionCheckin(id: number, checkin: Partial<InsertCompetitionCheckin>): Promise<CompetitionCheckin | undefined>;
  deleteCompetitionCheckin(id: number): Promise<void>;

  getFullscreenAlerts(activeOnly?: boolean): Promise<FullscreenAlert[]>;
  getFullscreenAlert(id: number): Promise<FullscreenAlert | undefined>;
  createFullscreenAlert(alert: InsertFullscreenAlert): Promise<FullscreenAlert>;
  updateFullscreenAlert(id: number, alert: Partial<InsertFullscreenAlert>): Promise<FullscreenAlert | undefined>;
  deleteFullscreenAlert(id: number): Promise<void>;

  getTeamClaims(eventId: number): Promise<TeamClaim[]>;
  upsertTeamClaim(data: { eventId: number; matchKey: string; teamNumber: number; userId: number; userName: string }): Promise<TeamClaim>;
  deleteTeamClaim(eventId: number, matchKey: string, teamNumber: number, userId: number): Promise<void>;

  getGeneralTasks(includeArchived?: boolean): Promise<GeneralTask[]>;
  getGeneralTask(id: number): Promise<GeneralTask | undefined>;
  createGeneralTask(data: InsertGeneralTask): Promise<GeneralTask>;
  updateGeneralTask(id: number, data: Partial<InsertGeneralTask>): Promise<GeneralTask | undefined>;
  deleteGeneralTask(id: number): Promise<void>;

  getAvailableTasksForUser(userId: number): Promise<(Task & { isAssigned: boolean })[]>;
  setWorkingOn(entryId: number, taskId?: number | null, generalTaskId?: number | null): Promise<TimeEntry | undefined>;

  getCertifications(): Promise<any[]>;
  getCertification(id: number): Promise<SafetyCertification | undefined>;
  createCertification(data: InsertSafetyCertification): Promise<SafetyCertification>;
  updateCertification(id: number, data: Partial<InsertSafetyCertification>): Promise<SafetyCertification | undefined>;
  deleteCertification(id: number): Promise<void>;
  getUserCertifications(userId: number): Promise<any[]>;
  grantCertification(userId: number, certId: number, grantedBy: number): Promise<UserCertification>;
  revokeCertification(userId: number, certId: number): Promise<void>;
  getCertifiedUsers(certId: number): Promise<any[]>;
  getTrainersForCert(certId: number): Promise<any[]>;
  createCertRequest(userId: number, certId: number): Promise<CertificationRequest>;
  getCertRequests(filters: { userId?: number; statuses?: string[] }): Promise<any[]>;
  claimCertRequest(requestId: number, trainerId: number): Promise<CertificationRequest | undefined>;
  updateCertRequestProgress(requestId: number, checklistProgress: { id: string; completed: boolean }[], notes?: string): Promise<CertificationRequest | undefined>;
  completeCertRequest(requestId: number, trainerId: number): Promise<CertificationRequest | undefined>;
  rejectCertRequest(requestId: number, trainerId: number, notes?: string): Promise<CertificationRequest | undefined>;

  getCalendarEvents(): Promise<CalendarEvent[]>;
  getCalendarEvent(id: number): Promise<CalendarEvent | undefined>;
  createCalendarEvent(data: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: number): Promise<void>;
  patchCalendarEventDeletedDates(id: number, deletedDates: string[]): Promise<CalendarEvent | undefined>;
  migrateCalendarTypes(): Promise<void>;
  backfillNexusEventKeys(): Promise<void>;
  seedCalendarEvents(createdBy: number): Promise<void>;

  getResources(category?: string): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
  createResource(data: InsertResource): Promise<Resource>;
  updateResource(id: number, data: Partial<InsertResource>): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<void>;
  seedResources(addedBy: number): Promise<void>;

  seedDatabase(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const sanitized = sanitizeUser(user);
    const [updated] = await db.update(users).set(sanitized).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const sanitized = sanitizeProject(project);
    const [newProject] = await db.insert(projects).values(sanitized).returning();
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const sanitized = sanitizeProject(project);
    delete sanitized.id;
    const [updated] = await db.update(projects).set(sanitized).where(eq(projects.id, id)).returning();
    return updated;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getTasks(): Promise<Task[]> {
    const result = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    return result.map(t => ({ ...t, successCriteria: migrateSuccessCriteria(t.successCriteria as any) }));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return undefined;
    return { ...task, successCriteria: migrateSuccessCriteria(task.successCriteria as any) };
  }

  async getTasksByProject(projectId: number): Promise<Task[]> {
    const result = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
    return result.map(t => ({ ...t, successCriteria: migrateSuccessCriteria(t.successCriteria as any) }));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const sanitized = sanitizeTask(task);
    const [newTask] = await db.insert(tasks).values(sanitized).returning();
    return newTask;
  }

  async updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined> {
    const sanitized = sanitizeTask(task);
    delete sanitized.id;
    const [updated] = await db.update(tasks).set(sanitized).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getNotifications(): Promise<Notification[]> {
    return db.select().from(notifications).orderBy(desc(notifications.timestamp));
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.toUserId, userId)).orderBy(desc(notifications.timestamp));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const sanitized = sanitizeNotification(notification);
    const [newNotification] = await db.insert(notifications).values(sanitized).returning();
    return newNotification;
  }

  async updateNotification(id: number, notification: Partial<InsertNotification>): Promise<Notification | undefined> {
    const sanitized = sanitizeNotification(notification);
    delete sanitized.id;
    const [updated] = await db.update(notifications).set(sanitized).where(eq(notifications.id, id)).returning();
    return updated;
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async getAnnouncements(): Promise<Announcement[]> {
    return db.select().from(announcements).orderBy(desc(announcements.timestamp));
  }

  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const sanitized = sanitizeAnnouncement(announcement);
    const [newAnnouncement] = await db.insert(announcements).values(sanitized).returning();
    return newAnnouncement;
  }

  async updateAnnouncement(id: number, announcement: Partial<InsertAnnouncement>): Promise<Announcement | undefined> {
    const sanitized = sanitizeAnnouncement(announcement);
    delete sanitized.id;
    const [updated] = await db.update(announcements).set(sanitized).where(eq(announcements.id, id)).returning();
    return updated;
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  async getTimeEntries(): Promise<any[]> {
    const entries = await db.select().from(timeEntries).orderBy(desc(timeEntries.createdAt));
    if (entries.length === 0) return entries;
    const taskIds = [...new Set(entries.map(e => e.workingOnTaskId).filter((id): id is number => id !== null && id !== undefined))];
    const genTaskIds = [...new Set(entries.map(e => e.workingOnGeneralTaskId).filter((id): id is number => id !== null && id !== undefined))];
    const taskMap: Record<number, string> = {};
    const genTaskMap: Record<number, string> = {};
    if (taskIds.length > 0) {
      const taskRows = await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(inArray(tasks.id, taskIds));
      for (const t of taskRows) taskMap[t.id] = t.title;
    }
    if (genTaskIds.length > 0) {
      const genRows = await db.select({ id: generalTasks.id, name: generalTasks.name }).from(generalTasks).where(inArray(generalTasks.id, genTaskIds));
      for (const g of genRows) genTaskMap[g.id] = g.name;
    }
    return entries.map(e => ({
      ...e,
      workingOnTaskTitle: e.workingOnTaskId ? (taskMap[e.workingOnTaskId] || null) : null,
      workingOnGeneralTaskName: e.workingOnGeneralTaskId ? (genTaskMap[e.workingOnGeneralTaskId] || null) : null,
    }));
  }

  async getTimeEntry(id: number): Promise<TimeEntry | undefined> {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    return entry;
  }

  async getTimeEntriesByUser(userId: number): Promise<TimeEntry[]> {
    return db.select().from(timeEntries).where(eq(timeEntries.userId, userId)).orderBy(desc(timeEntries.createdAt));
  }

  async getOpenTimeEntry(userId: number): Promise<TimeEntry | undefined> {
    const results = await db.select().from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.checkOutAt)));
    return results.find(e => e.status !== 'completed');
  }

  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    const sanitized = sanitizeTimeEntry(entry);
    const [newEntry] = await db.insert(timeEntries).values(sanitized).returning();
    return newEntry;
  }

  async updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const sanitized = sanitizeTimeEntry(entry);
    delete sanitized.id;
    const [updated] = await db.update(timeEntries).set(sanitized).where(eq(timeEntries.id, id)).returning();
    return updated;
  }

  async deleteTimeEntry(id: number): Promise<void> {
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
  }

  async getGeneralTasks(includeArchived = false): Promise<GeneralTask[]> {
    const rows = await db.select().from(generalTasks).orderBy(generalTasks.name);
    return includeArchived ? rows : rows.filter(r => r.active);
  }

  async getGeneralTask(id: number): Promise<GeneralTask | undefined> {
    const [row] = await db.select().from(generalTasks).where(eq(generalTasks.id, id));
    return row;
  }

  async createGeneralTask(data: InsertGeneralTask): Promise<GeneralTask> {
    const [row] = await db.insert(generalTasks).values(data).returning();
    return row;
  }

  async updateGeneralTask(id: number, data: Partial<InsertGeneralTask>): Promise<GeneralTask | undefined> {
    const sanitized: any = { ...data };
    delete sanitized.id;
    const [row] = await db.update(generalTasks).set(sanitized).where(eq(generalTasks.id, id)).returning();
    return row;
  }

  async deleteGeneralTask(id: number): Promise<void> {
    await db.delete(generalTasks).where(eq(generalTasks.id, id));
  }

  async getAvailableTasksForUser(userId: number): Promise<(Task & { isAssigned: boolean })[]> {
    const allTasks = await db.select().from(tasks);
    const statusOrder: Record<string, number> = {
      'In Progress': 0,
      'Not Started': 1,
      'Backlog': 2,
      'Blocked': 3,
    };
    return allTasks
      .filter(t => t.status !== 'Complete' && t.status !== 'Blocked')
      .map(t => {
        const assignees = (t.assignees as number[]) || [];
        return {
          ...t,
          successCriteria: migrateSuccessCriteria(t.successCriteria as any),
          isAssigned: assignees.includes(userId),
        };
      })
      .sort((a, b) => {
        if (a.isAssigned !== b.isAssigned) return a.isAssigned ? -1 : 1;
        return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      });
  }

  async setWorkingOn(entryId: number, taskId?: number | null, generalTaskId?: number | null): Promise<TimeEntry | undefined> {
    const updates: any = {
      workingOnTaskId: taskId ?? null,
      workingOnGeneralTaskId: generalTaskId ?? null,
    };
    const [updated] = await db.update(timeEntries).set(updates).where(eq(timeEntries.id, entryId)).returning();
    return updated;
  }

  async getTimeEntryAudit(entryId: number): Promise<TimeEntryAudit[]> {
    return db.select().from(timeEntryAudit).where(eq(timeEntryAudit.entryId, entryId)).orderBy(desc(timeEntryAudit.createdAt));
  }

  async createTimeEntryAudit(audit: InsertTimeEntryAudit): Promise<TimeEntryAudit> {
    const [newAudit] = await db.insert(timeEntryAudit).values(audit).returning();
    return newAudit;
  }

  async getScoutEvents(): Promise<ScoutEvent[]> {
    return db.select().from(scoutEvents).orderBy(desc(scoutEvents.createdAt));
  }

  async getScoutEvent(id: number): Promise<ScoutEvent | undefined> {
    const [event] = await db.select().from(scoutEvents).where(eq(scoutEvents.id, id));
    return event;
  }

  async createScoutEvent(event: InsertScoutEvent): Promise<ScoutEvent> {
    const [newEvent] = await db.insert(scoutEvents).values(event).returning();
    return newEvent;
  }

  async updateScoutEvent(id: number, event: Partial<InsertScoutEvent>): Promise<ScoutEvent | undefined> {
    const updates: Partial<InsertScoutEvent> = {};
    if (event.name !== undefined) updates.name = event.name;
    if (event.location !== undefined) updates.location = event.location;
    if (event.startDate !== undefined) updates.startDate = event.startDate;
    if (event.endDate !== undefined) updates.endDate = event.endDate;
    if (event.tbaEventKey !== undefined) updates.tbaEventKey = event.tbaEventKey;
    if (event.nexusEventKey !== undefined) updates.nexusEventKey = event.nexusEventKey;
    if (event.archived !== undefined) updates.archived = event.archived;
    if (Object.keys(updates).length === 0) {
      const [row] = await db.select().from(scoutEvents).where(eq(scoutEvents.id, id));
      return row;
    }
    const [updated] = await db.update(scoutEvents).set(updates).where(eq(scoutEvents.id, id)).returning();
    return updated;
  }

  async deleteScoutEvent(id: number): Promise<void> {
    await db.delete(scoutEvents).where(eq(scoutEvents.id, id));
  }

  async getPitScouts(eventId: number): Promise<PitScout[]> {
    return db.select().from(pitScouts).where(eq(pitScouts.eventId, eventId)).orderBy(desc(pitScouts.createdAt));
  }

  async getPitScout(id: number): Promise<PitScout | undefined> {
    const [scout] = await db.select().from(pitScouts).where(eq(pitScouts.id, id));
    return scout;
  }

  async createPitScout(scout: InsertPitScout): Promise<PitScout> {
    const [newScout] = await db.insert(pitScouts).values(scout).returning();
    return newScout;
  }

  async updatePitScout(id: number, scout: Partial<InsertPitScout>): Promise<PitScout | undefined> {
    const sanitized: any = { ...scout };
    delete sanitized.id;
    const [updated] = await db.update(pitScouts).set(sanitized).where(eq(pitScouts.id, id)).returning();
    return updated;
  }

  async deletePitScout(id: number): Promise<void> {
    await db.delete(pitScouts).where(eq(pitScouts.id, id));
  }

  async getMatchScouts(eventId: number): Promise<MatchScout[]> {
    return db.select().from(matchScouts).where(eq(matchScouts.eventId, eventId)).orderBy(desc(matchScouts.createdAt));
  }

  async getMatchScoutsByTeam(teamNumber: number): Promise<any[]> {
    const rows = await db
      .select({
        matchScout: matchScouts,
        eventName: scoutEvents.name,
      })
      .from(matchScouts)
      .innerJoin(scoutEvents, eq(matchScouts.eventId, scoutEvents.id))
      .where(eq(matchScouts.teamNumber, teamNumber))
      .orderBy(desc(matchScouts.createdAt));
    return rows.map(r => ({ ...r.matchScout, eventName: r.eventName }));
  }

  async getMatchScout(id: number): Promise<MatchScout | undefined> {
    const [scout] = await db.select().from(matchScouts).where(eq(matchScouts.id, id));
    return scout;
  }

  async createMatchScout(scout: InsertMatchScout): Promise<MatchScout> {
    const [newScout] = await db.insert(matchScouts).values(scout).returning();
    return newScout;
  }

  async updateMatchScout(id: number, scout: Partial<InsertMatchScout>): Promise<MatchScout | undefined> {
    const sanitized: any = { ...scout };
    delete sanitized.id;
    const [updated] = await db.update(matchScouts).set(sanitized).where(eq(matchScouts.id, id)).returning();
    return updated;
  }

  async deleteMatchScout(id: number): Promise<void> {
    await db.delete(matchScouts).where(eq(matchScouts.id, id));
  }

  async getCompetitionAssignments(eventId: number): Promise<CompetitionAssignment[]> {
    return db.select().from(competitionAssignments)
      .where(eq(competitionAssignments.eventId, eventId))
      .orderBy(competitionAssignments.fromMatch);
  }

  async getCompetitionAssignment(id: number): Promise<CompetitionAssignment | undefined> {
    const [row] = await db.select().from(competitionAssignments).where(eq(competitionAssignments.id, id));
    return row;
  }

  async createCompetitionAssignment(assignment: InsertCompetitionAssignment): Promise<CompetitionAssignment> {
    const [row] = await db.insert(competitionAssignments).values(assignment).returning();
    return row;
  }

  async updateCompetitionAssignment(id: number, assignment: Partial<InsertCompetitionAssignment>): Promise<CompetitionAssignment | undefined> {
    const sanitized: any = { ...assignment, updatedAt: new Date() };
    delete sanitized.id;
    const [row] = await db.update(competitionAssignments).set(sanitized).where(eq(competitionAssignments.id, id)).returning();
    return row;
  }

  async deleteCompetitionAssignment(id: number): Promise<void> {
    await db.delete(competitionAssignments).where(eq(competitionAssignments.id, id));
  }

  async getEventInfo(eventId: number): Promise<EventInfo | undefined> {
    const [row] = await db.select().from(eventInfo).where(eq(eventInfo.eventId, eventId));
    return row;
  }

  async upsertEventInfo(eventId: number, data: Partial<InsertEventInfo>): Promise<EventInfo> {
    const existing = await this.getEventInfo(eventId);
    const sanitized: any = { ...data, eventId, updatedAt: new Date() };
    delete sanitized.id;
    if (existing) {
      const [row] = await db.update(eventInfo).set(sanitized).where(eq(eventInfo.eventId, eventId)).returning();
      return row;
    } else {
      const [row] = await db.insert(eventInfo).values({ ...sanitized, eventId }).returning();
      return row;
    }
  }

  async deleteEventInfo(eventId: number): Promise<void> {
    await db.delete(eventInfo).where(eq(eventInfo.eventId, eventId));
  }

  async getCompetitionCheckins(eventId: number): Promise<CompetitionCheckin[]> {
    return db.select().from(competitionCheckins)
      .where(eq(competitionCheckins.eventId, eventId))
      .orderBy(desc(competitionCheckins.checkInAt));
  }

  async getCompetitionCheckinsByUser(userId: number): Promise<CompetitionCheckin[]> {
    return db.select().from(competitionCheckins)
      .where(eq(competitionCheckins.userId, userId))
      .orderBy(desc(competitionCheckins.checkInAt));
  }

  async getCompetitionCheckinById(id: number): Promise<CompetitionCheckin | undefined> {
    const [row] = await db.select().from(competitionCheckins).where(eq(competitionCheckins.id, id));
    return row;
  }

  async getOpenCompetitionCheckin(userId: number, eventId: number): Promise<CompetitionCheckin | undefined> {
    const results = await db.select().from(competitionCheckins)
      .where(and(
        eq(competitionCheckins.userId, userId),
        eq(competitionCheckins.eventId, eventId),
        isNull(competitionCheckins.checkOutAt)
      ));
    return results[0];
  }

  async createCompetitionCheckin(checkin: InsertCompetitionCheckin): Promise<CompetitionCheckin> {
    const sanitized: any = { ...checkin };
    if (sanitized.checkInAt && !(sanitized.checkInAt instanceof Date)) sanitized.checkInAt = new Date(sanitized.checkInAt);
    const [row] = await db.insert(competitionCheckins).values(sanitized).returning();
    return row;
  }

  async updateCompetitionCheckin(id: number, checkin: Partial<InsertCompetitionCheckin>): Promise<CompetitionCheckin | undefined> {
    const sanitized: any = { ...checkin };
    delete sanitized.id;
    if (sanitized.checkInAt && !(sanitized.checkInAt instanceof Date)) sanitized.checkInAt = new Date(sanitized.checkInAt);
    if (sanitized.checkOutAt && !(sanitized.checkOutAt instanceof Date)) sanitized.checkOutAt = new Date(sanitized.checkOutAt);
    if (sanitized.approvedAt && !(sanitized.approvedAt instanceof Date)) sanitized.approvedAt = new Date(sanitized.approvedAt);
    const [row] = await db.update(competitionCheckins).set(sanitized).where(eq(competitionCheckins.id, id)).returning();
    return row;
  }

  async deleteCompetitionCheckin(id: number): Promise<void> {
    await db.delete(competitionCheckins).where(eq(competitionCheckins.id, id));
  }

  async getCompetitionCheckinAudit(checkinId: number): Promise<(CompetitionCheckinAudit & { actorName: string })[]> {
    const rows = await db.select({
      id: competitionCheckinAudit.id,
      checkinId: competitionCheckinAudit.checkinId,
      actorId: competitionCheckinAudit.actorId,
      actionType: competitionCheckinAudit.actionType,
      previousValues: competitionCheckinAudit.previousValues,
      newValues: competitionCheckinAudit.newValues,
      createdAt: competitionCheckinAudit.createdAt,
      actorName: users.name,
    })
      .from(competitionCheckinAudit)
      .leftJoin(users, eq(competitionCheckinAudit.actorId, users.id))
      .where(eq(competitionCheckinAudit.checkinId, checkinId))
      .orderBy(desc(competitionCheckinAudit.createdAt));
    return rows.map(r => ({ ...r, actorName: r.actorName || `User #${r.actorId}` }));
  }

  async getCompetitionEventAudit(eventCheckinIds: number[]): Promise<CompetitionCheckinAudit[]> {
    if (eventCheckinIds.length === 0) return [];
    return db.select().from(competitionCheckinAudit)
      .orderBy(desc(competitionCheckinAudit.createdAt));
  }

  async createCompetitionCheckinAudit(audit: InsertCompetitionCheckinAudit): Promise<CompetitionCheckinAudit> {
    const [row] = await db.insert(competitionCheckinAudit).values(audit).returning();
    return row;
  }

  async getFullscreenAlerts(activeOnly = false): Promise<FullscreenAlert[]> {
    if (activeOnly) {
      return db.select().from(fullscreenAlerts)
        .where(eq(fullscreenAlerts.active, true))
        .orderBy(desc(fullscreenAlerts.createdAt));
    }
    return db.select().from(fullscreenAlerts).orderBy(desc(fullscreenAlerts.createdAt));
  }

  async getFullscreenAlert(id: number): Promise<FullscreenAlert | undefined> {
    const [row] = await db.select().from(fullscreenAlerts).where(eq(fullscreenAlerts.id, id));
    return row;
  }

  async createFullscreenAlert(alert: InsertFullscreenAlert): Promise<FullscreenAlert> {
    const sanitized: any = { ...alert };
    if (sanitized.expiresAt && !(sanitized.expiresAt instanceof Date)) sanitized.expiresAt = new Date(sanitized.expiresAt);
    const [row] = await db.insert(fullscreenAlerts).values(sanitized).returning();
    return row;
  }

  async updateFullscreenAlert(id: number, alert: Partial<InsertFullscreenAlert>): Promise<FullscreenAlert | undefined> {
    const sanitized: any = { ...alert };
    delete sanitized.id;
    if (sanitized.expiresAt && !(sanitized.expiresAt instanceof Date)) sanitized.expiresAt = new Date(sanitized.expiresAt);
    const [row] = await db.update(fullscreenAlerts).set(sanitized).where(eq(fullscreenAlerts.id, id)).returning();
    return row;
  }

  async deleteFullscreenAlert(id: number): Promise<void> {
    await db.delete(fullscreenAlerts).where(eq(fullscreenAlerts.id, id));
  }

  async getTeamClaims(eventId: number): Promise<TeamClaim[]> {
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await db.delete(teamClaims).where(and(eq(teamClaims.eventId, eventId), lt(teamClaims.claimedAt, cutoff)));
    return db.select().from(teamClaims).where(eq(teamClaims.eventId, eventId));
  }

  async upsertTeamClaim(data: { eventId: number; matchKey: string; teamNumber: number; userId: number; userName: string }): Promise<TeamClaim> {
    await db.delete(teamClaims).where(
      and(
        eq(teamClaims.eventId, data.eventId),
        eq(teamClaims.matchKey, data.matchKey),
        eq(teamClaims.teamNumber, data.teamNumber)
      )
    );
    const [row] = await db.insert(teamClaims).values({ ...data, claimedAt: new Date() }).returning();
    return row;
  }

  async deleteTeamClaim(eventId: number, matchKey: string, teamNumber: number, userId: number): Promise<void> {
    await db.delete(teamClaims).where(
      and(
        eq(teamClaims.eventId, eventId),
        eq(teamClaims.matchKey, matchKey),
        eq(teamClaims.teamNumber, teamNumber),
        eq(teamClaims.userId, userId)
      )
    );
  }

  async getCertifications(): Promise<any[]> {
    const certs = await db.select().from(safetyCertifications).orderBy(safetyCertifications.name);
    if (certs.length === 0) return [];
    const allUserCerts = await db.select({
      certId: userCertifications.certificationId,
      userId: userCertifications.userId,
    }).from(userCertifications);
    const userIds = [...new Set(allUserCerts.map(uc => uc.userId))];
    const trainerUsers = userIds.length > 0
      ? await db.select({ id: users.id, roles: users.roles }).from(users).where(inArray(users.id, userIds))
      : [];
    const trainerSet = new Set(trainerUsers.filter(u => (u.roles as string[]).includes('Safety Trainer')).map(u => u.id));
    const certifiedCount: Record<number, number> = {};
    const trainerCount: Record<number, number> = {};
    for (const uc of allUserCerts) {
      certifiedCount[uc.certId] = (certifiedCount[uc.certId] || 0) + 1;
      if (trainerSet.has(uc.userId)) {
        trainerCount[uc.certId] = (trainerCount[uc.certId] || 0) + 1;
      }
    }
    return certs.map(c => ({
      ...c,
      certifiedCount: certifiedCount[c.id] || 0,
      trainerCount: trainerCount[c.id] || 0,
    }));
  }

  async getCertification(id: number): Promise<SafetyCertification | undefined> {
    const [row] = await db.select().from(safetyCertifications).where(eq(safetyCertifications.id, id));
    return row;
  }

  async createCertification(data: InsertSafetyCertification): Promise<SafetyCertification> {
    const [row] = await db.insert(safetyCertifications).values(data).returning();
    return row;
  }

  async updateCertification(id: number, data: Partial<InsertSafetyCertification>): Promise<SafetyCertification | undefined> {
    const sanitized: any = { ...data };
    delete sanitized.id;
    delete sanitized.createdAt;
    const [row] = await db.update(safetyCertifications).set(sanitized).where(eq(safetyCertifications.id, id)).returning();
    return row;
  }

  async deleteCertification(id: number): Promise<void> {
    await db.delete(safetyCertifications).where(eq(safetyCertifications.id, id));
  }

  async getUserCertifications(userId: number): Promise<any[]> {
    const rows = await db.select({
      id: userCertifications.id,
      userId: userCertifications.userId,
      certificationId: userCertifications.certificationId,
      grantedBy: userCertifications.grantedBy,
      grantedAt: userCertifications.grantedAt,
      certName: safetyCertifications.name,
      certEquipment: safetyCertifications.equipment,
      certDescription: safetyCertifications.description,
    }).from(userCertifications)
      .innerJoin(safetyCertifications, eq(userCertifications.certificationId, safetyCertifications.id))
      .where(eq(userCertifications.userId, userId))
      .orderBy(desc(userCertifications.grantedAt));
    const grantorIds = [...new Set(rows.map(r => r.grantedBy))];
    const grantors = grantorIds.length > 0
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, grantorIds))
      : [];
    const grantorMap: Record<number, string> = {};
    for (const g of grantors) grantorMap[g.id] = g.name;
    return rows.map(r => ({ ...r, grantedByName: grantorMap[r.grantedBy] || `User #${r.grantedBy}` }));
  }

  async grantCertification(userId: number, certId: number, grantedBy: number): Promise<UserCertification> {
    const [inserted] = await db.insert(userCertifications)
      .values({ userId, certificationId: certId, grantedBy, grantedAt: new Date() })
      .onConflictDoNothing()
      .returning();
    if (inserted) return inserted;
    const [existing] = await db.select().from(userCertifications)
      .where(and(eq(userCertifications.userId, userId), eq(userCertifications.certificationId, certId)));
    return existing;
  }

  async revokeCertification(userId: number, certId: number): Promise<void> {
    await db.delete(userCertifications).where(
      and(eq(userCertifications.userId, userId), eq(userCertifications.certificationId, certId))
    );
  }

  async getCertifiedUsers(certId: number): Promise<any[]> {
    const rows = await db.select({
      id: userCertifications.id,
      userId: userCertifications.userId,
      certificationId: userCertifications.certificationId,
      grantedBy: userCertifications.grantedBy,
      grantedAt: userCertifications.grantedAt,
      userName: users.name,
      userUsername: users.username,
      userRoles: users.roles,
    }).from(userCertifications)
      .innerJoin(users, eq(userCertifications.userId, users.id))
      .where(eq(userCertifications.certificationId, certId))
      .orderBy(desc(userCertifications.grantedAt));
    const grantorIds = [...new Set(rows.map(r => r.grantedBy))];
    const grantors = grantorIds.length > 0
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, grantorIds))
      : [];
    const grantorMap: Record<number, string> = {};
    for (const g of grantors) grantorMap[g.id] = g.name;
    return rows.map(r => ({
      ...r,
      grantedByName: grantorMap[r.grantedBy] || `User #${r.grantedBy}`,
      isTrainer: (r.userRoles as string[]).includes('Safety Trainer'),
    }));
  }

  async getTrainersForCert(certId: number): Promise<any[]> {
    const rows = await db.select({
      id: userCertifications.id,
      userId: userCertifications.userId,
      certificationId: userCertifications.certificationId,
      grantedAt: userCertifications.grantedAt,
      userName: users.name,
      userUsername: users.username,
      userRoles: users.roles,
    }).from(userCertifications)
      .innerJoin(users, eq(userCertifications.userId, users.id))
      .where(eq(userCertifications.certificationId, certId));
    return rows.filter(r => (r.userRoles as string[]).includes('Safety Trainer'));
  }

  async createCertRequest(userId: number, certId: number): Promise<CertificationRequest> {
    const existing = await db.select().from(certificationRequests).where(
      and(
        eq(certificationRequests.userId, userId),
        eq(certificationRequests.certificationId, certId),
        eq(certificationRequests.status, 'pending')
      )
    );
    if (existing.length > 0) return existing[0];
    const inProgress = await db.select().from(certificationRequests).where(
      and(
        eq(certificationRequests.userId, userId),
        eq(certificationRequests.certificationId, certId),
        eq(certificationRequests.status, 'in_progress')
      )
    );
    if (inProgress.length > 0) return inProgress[0];
    const [row] = await db.insert(certificationRequests).values({
      userId,
      certificationId: certId,
      status: 'pending',
      requestedAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return row;
  }

  async getCertRequests(filters: { userId?: number; statuses?: string[] }): Promise<any[]> {
    let rows = await db.select({
      id: certificationRequests.id,
      userId: certificationRequests.userId,
      certificationId: certificationRequests.certificationId,
      status: certificationRequests.status,
      trainerId: certificationRequests.trainerId,
      checklistProgress: certificationRequests.checklistProgress,
      notes: certificationRequests.notes,
      requestedAt: certificationRequests.requestedAt,
      updatedAt: certificationRequests.updatedAt,
      userName: users.name,
      userUsername: users.username,
      certName: safetyCertifications.name,
      certEquipment: safetyCertifications.equipment,
      certChecklistItems: safetyCertifications.checklistItems,
      certSafetyGuide: safetyCertifications.safetyGuide,
    }).from(certificationRequests)
      .innerJoin(users, eq(certificationRequests.userId, users.id))
      .innerJoin(safetyCertifications, eq(certificationRequests.certificationId, safetyCertifications.id))
      .orderBy(desc(certificationRequests.requestedAt));
    if (filters.userId !== undefined) {
      rows = rows.filter(r => r.userId === filters.userId);
    }
    if (filters.statuses && filters.statuses.length > 0) {
      rows = rows.filter(r => filters.statuses!.includes(r.status));
    }
    const trainerIds = [...new Set(rows.map(r => r.trainerId).filter((id): id is number => id !== null))];
    const trainerUsers = trainerIds.length > 0
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, trainerIds))
      : [];
    const trainerMap: Record<number, string> = {};
    for (const t of trainerUsers) trainerMap[t.id] = t.name;
    return rows.map(r => ({
      ...r,
      trainerName: r.trainerId ? (trainerMap[r.trainerId] || `User #${r.trainerId}`) : null,
      certification: {
        id: r.certificationId,
        name: r.certName,
        equipment: r.certEquipment,
        checklistItems: r.certChecklistItems || [],
        safetyGuide: r.certSafetyGuide || '',
      },
    }));
  }

  async claimCertRequest(requestId: number, trainerId: number): Promise<CertificationRequest | undefined> {
    const [row] = await db.update(certificationRequests)
      .set({ trainerId, status: 'in_progress', updatedAt: new Date() })
      .where(and(eq(certificationRequests.id, requestId), eq(certificationRequests.status, 'pending')))
      .returning();
    return row;
  }

  async updateCertRequestProgress(requestId: number, checklistProgress: { id: string; completed: boolean }[], notes?: string): Promise<CertificationRequest | undefined> {
    const updateData: any = { checklistProgress, updatedAt: new Date() };
    if (notes !== undefined) updateData.notes = notes;
    const [row] = await db.update(certificationRequests)
      .set(updateData)
      .where(eq(certificationRequests.id, requestId))
      .returning();
    return row;
  }

  async completeCertRequest(requestId: number, trainerId: number): Promise<CertificationRequest | undefined> {
    const [req] = await db.select().from(certificationRequests).where(eq(certificationRequests.id, requestId));
    if (!req) return undefined;
    const [row] = await db.update(certificationRequests)
      .set({ status: 'completed', trainerId, updatedAt: new Date() })
      .where(eq(certificationRequests.id, requestId))
      .returning();
    if (row) {
      await this.grantCertification(req.userId, req.certificationId, trainerId);
    }
    return row;
  }

  async rejectCertRequest(requestId: number, trainerId: number, notes?: string): Promise<CertificationRequest | undefined> {
    const updateData: any = { status: 'rejected', trainerId, updatedAt: new Date() };
    if (notes !== undefined) updateData.notes = notes;
    const [row] = await db.update(certificationRequests)
      .set(updateData)
      .where(eq(certificationRequests.id, requestId))
      .returning();
    return row;
  }

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    return db.select().from(calendarEvents).orderBy(calendarEvents.startDate);
  }

  async getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
    const [row] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    return row;
  }

  async createCalendarEvent(data: InsertCalendarEvent): Promise<CalendarEvent> {
    const sanitized: any = { ...data };
    delete sanitized.id;
    delete sanitized.createdAt;
    const [row] = await db.insert(calendarEvents).values(sanitized).returning();
    return row;
  }

  async updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const sanitized: any = { ...data };
    delete sanitized.id;
    delete sanitized.createdAt;
    const [row] = await db.update(calendarEvents).set(sanitized).where(eq(calendarEvents.id, id)).returning();
    return row;
  }

  async deleteCalendarEvent(id: number): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  }

  async migrateCalendarTypes(): Promise<void> {
    await db.execute(sql`UPDATE calendar_events SET type = 'shop' WHERE type = 'practice'`);
  }

  async backfillNexusEventKeys(): Promise<void> {
    await db.execute(sql`
      UPDATE scout_events
      SET nexus_event_key = tba_event_key
      WHERE (nexus_event_key IS NULL OR nexus_event_key = '')
        AND tba_event_key IS NOT NULL
        AND tba_event_key != ''
    `);
  }

  async patchCalendarEventDeletedDates(id: number, deletedDates: string[]): Promise<CalendarEvent | undefined> {
    const deduped = [...new Set(deletedDates)];
    const [row] = await db.update(calendarEvents)
      .set({ deletedDates: JSON.stringify(deduped) })
      .where(eq(calendarEvents.id, id))
      .returning();
    return row;
  }

  async seedCalendarEvents(createdBy: number): Promise<void> {
    const existing = await db.select().from(calendarEvents);
    if (existing.length > 0) return;
    const seeds = [
      { title: 'Shop Session', startDate: '2026-01-06', type: 'shop', location: 'Build Room', description: 'Biweekly shop session' },
      { title: 'Shop Session', startDate: '2026-01-10', type: 'shop', location: 'Build Room', description: 'Weekly shop session' },
      { title: 'San Diego Regional', startDate: '2026-03-05', endDate: '2026-03-08', type: 'competition', location: 'San Diego, CA', description: 'Week 1 Regional', attending: true },
      { title: 'LA Regional', startDate: '2026-03-19', endDate: '2026-03-22', type: 'competition', location: 'Los Angeles, CA', description: 'Week 3 Regional', attending: true },
      { title: 'CHS District Championship', startDate: '2026-04-09', endDate: '2026-04-12', type: 'competition', location: 'Virginia', description: 'District Championship', attending: true },
      { title: 'Strategy Meeting', startDate: '2026-03-01', type: 'meeting', location: 'Build Room', description: '' },
      { title: 'Robot Bag Deadline', startDate: '2026-02-18', type: 'other', location: '', description: 'Robot must be competition-ready' },
    ];
    for (const s of seeds) {
      await db.insert(calendarEvents).values({ ...s, createdBy } as InsertCalendarEvent);
    }
  }

  async getResources(category?: string): Promise<Resource[]> {
    const rows = await db.select().from(resources).orderBy(desc(resources.pinned), desc(resources.createdAt));
    if (category) return rows.filter(r => r.category === category);
    return rows;
  }

  async getResource(id: number): Promise<Resource | undefined> {
    const [row] = await db.select().from(resources).where(eq(resources.id, id));
    return row;
  }

  async createResource(data: InsertResource): Promise<Resource> {
    const sanitized: any = { ...data };
    delete sanitized.id;
    delete sanitized.createdAt;
    const [row] = await db.insert(resources).values(sanitized).returning();
    return row;
  }

  async updateResource(id: number, data: Partial<InsertResource>): Promise<Resource | undefined> {
    const sanitized: any = { ...data };
    delete sanitized.id;
    delete sanitized.createdAt;
    const [row] = await db.update(resources).set(sanitized).where(eq(resources.id, id)).returning();
    return row;
  }

  async deleteResource(id: number): Promise<void> {
    await db.delete(resources).where(eq(resources.id, id));
  }

  async seedResources(addedBy: number): Promise<void> {
    const existing = await db.select().from(resources);
    if (existing.length > 0) return;
    const seeds: Omit<InsertResource, 'addedBy'>[] = [
      { title: 'The Blue Alliance', url: 'https://www.thebluealliance.com', description: 'Official FRC match results, team info, event data, and historical records.', category: 'Competition', pinned: true },
      { title: 'FRC Nexus', url: 'https://frc.nexus', description: 'Live event queuing, announcements, and pit display coordination tool.', category: 'Competition', pinned: true },
      { title: 'FIRST Robotics Competition', url: 'https://www.firstinspires.org/robotics/frc', description: 'Official FIRST website — game manuals, season information, and registration.', category: 'Competition', pinned: false },
      { title: 'FRC Game Manual', url: 'https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system', description: 'Current season game manual with all official rules and scoring criteria.', category: 'Competition', pinned: false },
      { title: 'WPILib Documentation', url: 'https://docs.wpilib.org', description: 'Official WPILib docs — the primary Java/C++ library for FRC robot programming.', category: 'Software', pinned: true },
      { title: 'PathPlanner', url: 'https://pathplanner.dev', description: 'Advanced autonomous path planning for FRC robots.', category: 'Software', pinned: false },
      { title: 'FRC 6328 Mechanical Advantage', url: 'https://github.com/Mechanical-Advantage', description: 'Open-source code, technical documentation, and build resources.', category: 'Software', pinned: false },
      { title: 'Limelight Vision', url: 'https://docs.limelightvision.io', description: 'FRC-targeted vision tracking system with detailed setup documentation.', category: 'Software', pinned: false },
      { title: 'FRC Driver Station Setup', url: 'https://docs.wpilib.org/en/stable/docs/zero-to-robot/step-2/frc-game-tools.html', description: 'NI FRC driver station installation and configuration guide.', category: 'Software', pinned: false },
      { title: 'REV Robotics', url: 'https://docs.revrobotics.com', description: 'Control system components, SPARK MAX motor controllers, and documentation.', category: 'Vendor', pinned: false },
      { title: 'CTRE Phoenix Documentation', url: 'https://pro.docs.ctr-electronics.com', description: 'Talon SRX, Falcon 500, and Phoenix 6 documentation and API reference.', category: 'Vendor', pinned: false },
      { title: 'Playing With Fusion', url: 'https://www.playingwithfusion.com', description: 'Time-of-flight distance sensors and other FRC-legal sensors.', category: 'Vendor', pinned: false },
      { title: 'FRC Design Sourcebook', url: 'https://www.frcdesign.org', description: 'Open-source design guide covering mechanisms, systems, and fabrication.', category: 'Design', pinned: false },
      { title: 'Onshape FRC Library', url: 'https://cad.onshape.com/documents/7bfda6b4d5f79b44e17bbc9f', description: 'Community-maintained parts library for FRC design in Onshape.', category: 'Design', pinned: false },
      { title: 'FRC Statbotics', url: 'https://www.statbotics.io', description: 'Advanced FRC analytics, EPA ratings, and team performance statistics.', category: 'Training', pinned: false },
      { title: 'Spectrum 3847 Scouting Resources', url: 'https://spectrum3847.org', description: 'Strategy and scouting guides from one of FRC\'s most respected teams.', category: 'Training', pinned: false },
      { title: 'Chief Delphi', url: 'https://www.chiefdelphi.com', description: 'The primary FRC community forum for strategy, technical discussion, and build threads.', category: 'Other', pinned: false },
      { title: 'FRC YouTube Channel', url: 'https://www.youtube.com/@FIRSTRoboticsCompetition', description: 'Official FIRST YouTube channel with event streams, reveals, and highlights.', category: 'Other', pinned: false },
    ];
    for (const s of seeds) {
      await db.insert(resources).values({ ...s, addedBy } as InsertResource);
    }
  }

  async seedDatabase(): Promise<void> {
    const existingUsers = await this.getUsers();
    if (existingUsers.length > 0) return;

    const defaultUsers = [
      { username: 'captain', password: 'password', name: 'John Doe', roles: ['Team Captain', 'SCRUM Master'], departments: ['Software', 'Modeling'] },
      { username: 'coach', password: 'password', name: 'Mentor Mike', roles: ['Coach'], departments: ['Logistics', 'Business'] },
      { username: 'mech_lead', password: 'password', name: 'Jane Smith', roles: ['Department Head'], departments: ['Mechanical'] },
    ];

    for (const user of defaultUsers) {
      await this.createUser(user);
    }

    await this.createProject({
      name: '2025 Competition Robot',
      description: 'Initial season build',
      archived: false,
    });
  }
}

export const storage = new DatabaseStorage();
