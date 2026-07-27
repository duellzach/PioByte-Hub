import { db } from "./db";
import { hashPassword } from "./security";
import { users, projects, tasks, notifications, announcements, generalTasks, timeEntries, timeEntryAudit, scoutEvents, pitScouts, matchScouts, competitionAssignments, eventInfo, competitionCheckins, competitionCheckinAudit, fullscreenAlerts, teamClaims, safetyCertifications, userCertifications, certificationRequests, calendarEvents, resources, matchExceptions, teamSettings, guestTokens, recurringTaskTemplates, eventSignups, fundraisingEntries, seasons, scoutingTemplates } from "../shared/schema";
import { BUILTIN_TEMPLATES, dataFromLegacyRow, legacyColumnsFromData, type ScoutKind } from "../shared/scoutingTemplates";

/**
 * Normalize a scout write during the seasons/templates transition. If the
 * caller supplies a `data` blob (new clients), dual-write the built-in legacy
 * columns from it so rollback stays possible — without clobbering any legacy
 * field the caller set explicitly. If no `data` is supplied (old clients),
 * synthesize it from the legacy fields so every row ends up with a `data` blob.
 */
function normalizeScoutWrite(kind: ScoutKind, values: Record<string, any>): Record<string, any> {
  const v: Record<string, any> = { ...values };
  if (v.data && typeof v.data === "object" && Object.keys(v.data).length > 0) {
    const legacy = legacyColumnsFromData(kind, v.data);
    for (const [col, val] of Object.entries(legacy)) {
      if (v[col] === undefined) v[col] = val;
    }
  } else {
    const derived = dataFromLegacyRow(kind, v);
    if (Object.keys(derived).length > 0) v.data = derived;
  }
  return v;
}

/** Read shim: fill an empty `data` blob from legacy columns (post-backfill no-op). */
function fillScoutData<T extends Record<string, any>>(kind: ScoutKind, row: T): T {
  if (!row) return row;
  if (row.data && typeof row.data === "object" && Object.keys(row.data).length > 0) return row;
  return { ...row, data: dataFromLegacyRow(kind, row) };
}
import type { User, InsertUser, Project, InsertProject, Task, InsertTask, Notification, InsertNotification, Announcement, InsertAnnouncement, GeneralTask, InsertGeneralTask, TimeEntry, InsertTimeEntry, TimeEntryAudit, InsertTimeEntryAudit, ScoutEvent, InsertScoutEvent, PitScout, InsertPitScout, MatchScout, InsertMatchScout, CompetitionAssignment, InsertCompetitionAssignment, EventInfo, InsertEventInfo, CompetitionCheckin, InsertCompetitionCheckin, CompetitionCheckinAudit, InsertCompetitionCheckinAudit, FullscreenAlert, InsertFullscreenAlert, TeamClaim, SafetyCertification, InsertSafetyCertification, UserCertification, CertificationRequest, CalendarEvent, InsertCalendarEvent, Resource, InsertResource, MatchException, TeamSettings, InsertTeamSettings, GuestToken, RecurringTaskTemplate, InsertRecurringTaskTemplate, EventSignup, InsertEventSignup, FundraisingEntry, InsertFundraisingEntry } from "../shared/schema";
import { eq, desc, and, isNull, lt, inArray, sql } from "drizzle-orm";
import { HOUR_CATEGORIES } from "../shared/hourCategories";

// --- Recurring-task date helpers (Pacific, matching the app's date convention) ---
function todayServerLocalStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}
function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
function addMonthsStr(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt.toISOString().slice(0, 10);
}
// The earliest date a template is next due to generate. Null last-generated =>
// due immediately.
function nextRecurringDate(lastGenerated: string | null, frequency: string): string {
  if (!lastGenerated) return '0000-01-01';
  switch (frequency) {
    case 'daily': return addDaysStr(lastGenerated, 1);
    case 'weekly': return addDaysStr(lastGenerated, 7);
    case 'biweekly': return addDaysStr(lastGenerated, 14);
    case 'monthly': return addMonthsStr(lastGenerated, 1);
    default: return addDaysStr(lastGenerated, 7);
  }
}

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
  getAllCompetitionCheckins(): Promise<CompetitionCheckin[]>;
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
  backfillOutreachHours(): Promise<void>;
  seedCalendarEvents(createdBy: number): Promise<void>;

  getResources(category?: string): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
  createResource(data: InsertResource): Promise<Resource>;
  updateResource(id: number, data: Partial<InsertResource>): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<void>;
  seedResources(addedBy: number): Promise<void>;

  getMatchExceptions(eventId: number): Promise<MatchException[]>;
  upsertMatchException(data: { eventId: number; userId: number; matchNumber: number; type: string; createdBy: number }): Promise<MatchException>;
  deleteMatchException(eventId: number, userId: number, matchNumber: number): Promise<void>;

  getTeamSettings(): Promise<TeamSettings>;
  upsertTeamSettings(data: Partial<Omit<TeamSettings, 'id' | 'updatedAt'>>): Promise<TeamSettings>;
  migrateApiKeyColumns(): Promise<void>;

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
    if (event.toaEventKey !== undefined) updates.toaEventKey = event.toaEventKey;
    if (event.nexusPitMapKey !== undefined) updates.nexusPitMapKey = event.nexusPitMapKey;
    if (event.seasonId !== undefined) updates.seasonId = event.seasonId;
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
    const rows = await db.select().from(pitScouts).where(eq(pitScouts.eventId, eventId)).orderBy(desc(pitScouts.createdAt));
    return rows.map(r => fillScoutData("pit", r));
  }

  async getPitScout(id: number): Promise<PitScout | undefined> {
    const [scout] = await db.select().from(pitScouts).where(eq(pitScouts.id, id));
    return scout ? fillScoutData("pit", scout) : scout;
  }

  async createPitScout(scout: InsertPitScout): Promise<PitScout> {
    const [newScout] = await db.insert(pitScouts).values(normalizeScoutWrite("pit", scout) as InsertPitScout).returning();
    return newScout;
  }

  async updatePitScout(id: number, scout: Partial<InsertPitScout>): Promise<PitScout | undefined> {
    const sanitized: any = normalizeScoutWrite("pit", { ...scout });
    delete sanitized.id;
    const [updated] = await db.update(pitScouts).set(sanitized).where(eq(pitScouts.id, id)).returning();
    return updated;
  }

  async deletePitScout(id: number): Promise<void> {
    await db.delete(pitScouts).where(eq(pitScouts.id, id));
  }

  async getMatchScouts(eventId: number): Promise<MatchScout[]> {
    const rows = await db.select().from(matchScouts).where(eq(matchScouts.eventId, eventId)).orderBy(desc(matchScouts.createdAt));
    return rows.map(r => fillScoutData("match", r));
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
    return rows.map(r => ({ ...fillScoutData("match", r.matchScout), eventName: r.eventName }));
  }

  async getMatchScout(id: number): Promise<MatchScout | undefined> {
    const [scout] = await db.select().from(matchScouts).where(eq(matchScouts.id, id));
    return scout ? fillScoutData("match", scout) : scout;
  }

  async createMatchScout(scout: InsertMatchScout): Promise<MatchScout> {
    const [newScout] = await db.insert(matchScouts).values(normalizeScoutWrite("match", scout) as InsertMatchScout).returning();
    return newScout;
  }

  async updateMatchScout(id: number, scout: Partial<InsertMatchScout>): Promise<MatchScout | undefined> {
    const sanitized: any = normalizeScoutWrite("match", { ...scout });
    delete sanitized.id;
    const [updated] = await db.update(matchScouts).set(sanitized).where(eq(matchScouts.id, id)).returning();
    return updated;
  }

  async deleteMatchScout(id: number): Promise<void> {
    await db.delete(matchScouts).where(eq(matchScouts.id, id));
  }

  // --- Seasons & scouting templates (Epic D) ---

  async getSeasons(): Promise<any[]> {
    return db.select().from(seasons).orderBy(desc(seasons.year), desc(seasons.createdAt));
  }

  async getSeason(id: number): Promise<any | undefined> {
    const [row] = await db.select().from(seasons).where(eq(seasons.id, id));
    return row;
  }

  async getActiveSeason(): Promise<any | undefined> {
    const [row] = await db.select().from(seasons).where(eq(seasons.active, true)).limit(1);
    return row;
  }

  async createSeason(data: { name: string; gameName?: string; year?: number | null; active?: boolean }): Promise<any> {
    const [row] = await db.insert(seasons).values({
      name: data.name,
      gameName: data.gameName ?? "",
      year: data.year ?? null,
      active: data.active ?? false,
    }).returning();
    if (row.active) await db.update(seasons).set({ active: false }).where(sql`${seasons.id} <> ${row.id}`);
    return row;
  }

  async updateSeason(id: number, data: { name?: string; gameName?: string; year?: number | null; active?: boolean }): Promise<any | undefined> {
    const updates: Record<string, any> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.gameName !== undefined) updates.gameName = data.gameName;
    if (data.year !== undefined) updates.year = data.year;
    if (data.active !== undefined) updates.active = data.active;
    if (Object.keys(updates).length === 0) return this.getSeason(id);
    const [row] = await db.update(seasons).set(updates).where(eq(seasons.id, id)).returning();
    // Exactly one active season at a time.
    if (data.active === true && row) {
      await db.update(seasons).set({ active: false }).where(sql`${seasons.id} <> ${id}`);
    }
    return row;
  }

  async deleteSeason(id: number): Promise<{ ok: boolean; reason?: string }> {
    const [ev] = await db.select().from(scoutEvents).where(eq(scoutEvents.seasonId, id)).limit(1);
    if (ev) return { ok: false, reason: "Season has events assigned to it" };
    await db.delete(seasons).where(eq(seasons.id, id));
    return { ok: true };
  }

  async getTemplatesForSeason(seasonId: number): Promise<any[]> {
    return db.select().from(scoutingTemplates).where(eq(scoutingTemplates.seasonId, seasonId));
  }

  async getTemplate(seasonId: number, kind: ScoutKind): Promise<any | undefined> {
    const [row] = await db.select().from(scoutingTemplates)
      .where(and(eq(scoutingTemplates.seasonId, seasonId), eq(scoutingTemplates.kind, kind))).limit(1);
    return row;
  }

  async getTemplateById(id: number): Promise<any | undefined> {
    const [row] = await db.select().from(scoutingTemplates).where(eq(scoutingTemplates.id, id));
    return row;
  }

  async createTemplate(data: { seasonId: number; kind: ScoutKind; name?: string; fields: any[]; createdBy?: number | null }): Promise<any> {
    const [row] = await db.insert(scoutingTemplates).values({
      seasonId: data.seasonId,
      kind: data.kind,
      name: data.name ?? "",
      fields: data.fields,
      revision: 1,
      createdBy: data.createdBy ?? null,
    }).returning();
    return row;
  }

  async updateTemplate(id: number, data: { name?: string; fields?: any[] }): Promise<any | undefined> {
    const updates: Record<string, any> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.fields !== undefined) {
      updates.fields = data.fields;
      updates.revision = sql`${scoutingTemplates.revision} + 1`;
    }
    if (Object.keys(updates).length === 0) return this.getTemplateById(id);
    const [row] = await db.update(scoutingTemplates).set(updates).where(eq(scoutingTemplates.id, id)).returning();
    return row;
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

  async getAllCompetitionCheckins(): Promise<CompetitionCheckin[]> {
    return db.select().from(competitionCheckins).orderBy(desc(competitionCheckins.checkInAt));
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

  async getCalendarEvents(includeArchived = false): Promise<CalendarEvent[]> {
    if (includeArchived) {
      return db.select().from(calendarEvents).orderBy(calendarEvents.startDate);
    }
    return db.select().from(calendarEvents)
      .where(eq(calendarEvents.archived, false))
      .orderBy(calendarEvents.startDate);
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

  async ensureArchiveColumns(): Promise<void> {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false`);
  }

  async ensureProjectLinksColumn(): Promise<void> {
    await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'`);
  }

  /**
   * Seasons + customizable scouting templates (Epic D). Idempotent: creates the
   * tables/columns, seeds a default active season with built-in templates that
   * mirror the legacy forms, assigns existing events to it, and backfills every
   * scout record's `data` blob from its legacy columns. Safe to run on boot.
   */
  async ensureScoutingSeasonsTables(): Promise<void> {
    // 1. Tables + columns (all additive; legacy columns kept intact).
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS seasons (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        game_name TEXT NOT NULL DEFAULT '',
        year INTEGER,
        active BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS scouting_templates (
        id SERIAL PRIMARY KEY,
        season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        fields JSONB NOT NULL DEFAULT '[]',
        revision INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS scouting_templates_season_kind_unique
      ON scouting_templates (season_id, kind)
    `);
    await db.execute(sql`ALTER TABLE scout_events ADD COLUMN IF NOT EXISTS season_id INTEGER REFERENCES seasons(id)`);
    await db.execute(sql`ALTER TABLE pit_scouts ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES scouting_templates(id)`);
    await db.execute(sql`ALTER TABLE pit_scouts ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'`);
    await db.execute(sql`ALTER TABLE match_scouts ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES scouting_templates(id)`);
    await db.execute(sql`ALTER TABLE match_scouts ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'`);

    // 2. Default season (only if none exists).
    let [defaultSeason] = await db.select().from(seasons).limit(1);
    if (!defaultSeason) {
      const year = new Date().getFullYear();
      [defaultSeason] = await db.insert(seasons)
        .values({ name: String(year), gameName: "", year, active: true })
        .returning();
    }

    // 3. Built-in pit + match templates for the default season (idempotent via
    //    the unique (season_id, kind) index — insert only when missing).
    for (const kind of ["pit", "match"] as ScoutKind[]) {
      const existing = await db.select().from(scoutingTemplates)
        .where(and(eq(scoutingTemplates.seasonId, defaultSeason.id), eq(scoutingTemplates.kind, kind)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(scoutingTemplates).values({
          seasonId: defaultSeason.id,
          kind,
          name: BUILTIN_TEMPLATES[kind].name,
          fields: BUILTIN_TEMPLATES[kind].fields,
          revision: 1,
        });
      }
    }
    const [pitTemplate] = await db.select().from(scoutingTemplates)
      .where(and(eq(scoutingTemplates.seasonId, defaultSeason.id), eq(scoutingTemplates.kind, "pit"))).limit(1);
    const [matchTemplate] = await db.select().from(scoutingTemplates)
      .where(and(eq(scoutingTemplates.seasonId, defaultSeason.id), eq(scoutingTemplates.kind, "match"))).limit(1);

    // 4. Assign orphan events to the default season.
    await db.execute(sql`UPDATE scout_events SET season_id = ${defaultSeason.id} WHERE season_id IS NULL`);

    // 5. Backfill `data` + `template_id` on every scout record whose data blob
    //    is still empty. One-time; legacy columns are retained for safety.
    const pitRows = await db.select().from(pitScouts).where(sql`${pitScouts.data} = '{}'::jsonb`);
    for (const row of pitRows as any[]) {
      await db.update(pitScouts)
        .set({ data: dataFromLegacyRow("pit", row), templateId: row.templateId ?? pitTemplate?.id })
        .where(eq(pitScouts.id, row.id));
    }
    const matchRows = await db.select().from(matchScouts).where(sql`${matchScouts.data} = '{}'::jsonb`);
    for (const row of matchRows as any[]) {
      await db.update(matchScouts)
        .set({ data: dataFromLegacyRow("match", row), templateId: row.templateId ?? matchTemplate?.id })
        .where(eq(matchScouts.id, row.id));
    }
  }

  async migrateApiKeyColumns(): Promise<void> {
    await db.execute(sql`ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS tba_api_key TEXT`);
    await db.execute(sql`ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS toa_api_key TEXT`);
    await db.execute(sql`ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS nexus_api_key TEXT`);
  }

  async ensurePushSubscriptionsTable(): Promise<void> {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async ensureEventParticipationTables(): Promise<void> {
    await db.execute(sql`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS signup_enabled BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS capacity INTEGER`);
    await db.execute(sql`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'shop'`);
    await db.execute(sql`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS calendar_event_id INTEGER REFERENCES calendar_events(id) ON DELETE SET NULL`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS event_signups (
        id SERIAL PRIMARY KEY,
        calendar_event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'requested',
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (calendar_event_id, user_id)
      )
    `);
  }

  // --- Event signups (roster) ---
  async getEventSignups(calendarEventId: number): Promise<EventSignup[]> {
    return db.select().from(eventSignups).where(eq(eventSignups.calendarEventId, calendarEventId));
  }
  async getEventSignup(calendarEventId: number, userId: number): Promise<EventSignup | undefined> {
    const [row] = await db.select().from(eventSignups)
      .where(and(eq(eventSignups.calendarEventId, calendarEventId), eq(eventSignups.userId, userId)));
    return row;
  }
  async getEventSignupById(id: number): Promise<EventSignup | undefined> {
    const [row] = await db.select().from(eventSignups).where(eq(eventSignups.id, id));
    return row;
  }
  async countAcceptedSignups(calendarEventId: number): Promise<number> {
    const rows = await db.select().from(eventSignups)
      .where(and(eq(eventSignups.calendarEventId, calendarEventId), eq(eventSignups.status, 'accepted')));
    return rows.length;
  }
  async upsertEventSignup(calendarEventId: number, userId: number, status: string): Promise<EventSignup> {
    const [row] = await db.insert(eventSignups)
      .values({ calendarEventId, userId, status })
      .onConflictDoUpdate({ target: [eventSignups.calendarEventId, eventSignups.userId], set: { status } })
      .returning();
    return row;
  }
  async setEventSignupStatus(id: number, status: string, approvedBy: number): Promise<EventSignup | undefined> {
    const [row] = await db.update(eventSignups)
      .set({ status, approvedBy, approvedAt: new Date() })
      .where(eq(eventSignups.id, id)).returning();
    return row;
  }
  async deleteEventSignup(calendarEventId: number, userId: number): Promise<void> {
    await db.delete(eventSignups)
      .where(and(eq(eventSignups.calendarEventId, calendarEventId), eq(eventSignups.userId, userId)));
  }
  async getUserSignups(userId: number): Promise<EventSignup[]> {
    return db.select().from(eventSignups).where(eq(eventSignups.userId, userId));
  }

  async ensureAttendanceColumns(): Promise<void> {
    await db.execute(sql`ALTER TABLE event_signups ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE event_signups ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE event_signups ADD COLUMN IF NOT EXISTS checked_in_by INTEGER REFERENCES users(id)`);
  }

  async checkInSignup(signupId: number, coachId: number, time?: Date): Promise<EventSignup | undefined> {
    const [row] = await db.update(eventSignups)
      .set({ checkedInAt: time ?? new Date(), checkedInBy: coachId, checkedOutAt: null })
      .where(eq(eventSignups.id, signupId)).returning();
    return row;
  }

  async checkOutSignup(signupId: number, time?: Date): Promise<EventSignup | undefined> {
    const [row] = await db.update(eventSignups)
      .set({ checkedOutAt: time ?? new Date() })
      .where(eq(eventSignups.id, signupId)).returning();
    return row;
  }

  async editSignupAttendance(signupId: number, data: { checkedInAt?: Date | null; checkedOutAt?: Date | null }): Promise<EventSignup | undefined> {
    const [row] = await db.update(eventSignups)
      .set(data as any)
      .where(eq(eventSignups.id, signupId)).returning();
    return row;
  }

  async upsertAndCheckIn(eventId: number, userId: number, coachId: number, time?: Date): Promise<EventSignup> {
    const existing = await this.getEventSignup(eventId, userId);
    if (existing) {
      const [row] = await db.update(eventSignups)
        .set({ status: 'accepted', checkedInAt: time ?? new Date(), checkedInBy: coachId, checkedOutAt: null })
        .where(eq(eventSignups.id, existing.id)).returning();
      return row;
    }
    const [row] = await db.insert(eventSignups)
      .values({ calendarEventId: eventId, userId, status: 'accepted', checkedInAt: time ?? new Date(), checkedInBy: coachId })
      .returning();
    return row;
  }

  async ensureRequirementsAndFundraising(): Promise<void> {
    // Note: DDL DEFAULTs can't be parameterized, so the JSON is inlined as a
    // literal. It contains only double quotes (safe inside single-quoted SQL).
    const defaultReq = JSON.stringify({
      fundraising: { enabled: false, goalCents: 0 },
      hours: [
        { key: "total", label: "Total Hours", enabled: false, categories: [...HOUR_CATEGORIES], phases: [{ label: "Season", start: null, end: null, requiredMinutes: 0 }] },
        { key: "shop", label: "Shop Time", enabled: false, categories: ["shop"], phases: [{ label: "Season", start: null, end: null, requiredMinutes: 0 }] },
        { key: "outreach", label: "Outreach", enabled: false, categories: ["outreach"], phases: [{ label: "Season", start: null, end: null, requiredMinutes: 0 }] },
        { key: "volunteer", label: "Volunteer", enabled: false, categories: ["volunteer"], phases: [{ label: "Season", start: null, end: null, requiredMinutes: 0 }] },
      ],
    });
    await db.execute(sql.raw(`ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS requirements JSONB NOT NULL DEFAULT '${defaultReq}'::jsonb`));
    await db.execute(sql.raw(`ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS fundraising_categories JSONB NOT NULL DEFAULT '["Concessions","Farmers Market","Parent Night Out","Sponsorship","Other"]'::jsonb`));
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS fundraising_goal_cents INTEGER`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS hour_requirement_overrides JSONB`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS fundraising_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        category TEXT NOT NULL DEFAULT 'Other',
        description TEXT NOT NULL DEFAULT '',
        occurred_on TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'verified',
        verified_by INTEGER REFERENCES users(id),
        verified_at TIMESTAMP,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // --- Fundraising ---
  async getFundraisingEntries(filter: { userId?: number; status?: string } = {}): Promise<FundraisingEntry[]> {
    let rows = await db.select().from(fundraisingEntries).orderBy(desc(fundraisingEntries.occurredOn));
    if (filter.userId !== undefined) rows = rows.filter((r) => r.userId === filter.userId);
    if (filter.status) rows = rows.filter((r) => r.status === filter.status);
    return rows;
  }
  async getFundraisingEntry(id: number): Promise<FundraisingEntry | undefined> {
    const [row] = await db.select().from(fundraisingEntries).where(eq(fundraisingEntries.id, id));
    return row;
  }
  async createFundraisingEntry(data: InsertFundraisingEntry): Promise<FundraisingEntry> {
    const [row] = await db.insert(fundraisingEntries).values(data).returning();
    return row;
  }
  async updateFundraisingEntry(id: number, data: Partial<InsertFundraisingEntry>): Promise<FundraisingEntry | undefined> {
    const sanitized: any = { ...data }; delete sanitized.id; delete sanitized.createdAt;
    const [row] = await db.update(fundraisingEntries).set(sanitized).where(eq(fundraisingEntries.id, id)).returning();
    return row;
  }
  async deleteFundraisingEntry(id: number): Promise<void> {
    await db.delete(fundraisingEntries).where(eq(fundraisingEntries.id, id));
  }

  async ensureRecurringTasksTable(): Promise<void> {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS recurring_task_templates (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        priority TEXT NOT NULL DEFAULT 'Medium',
        effort INTEGER,
        departments JSONB NOT NULL DEFAULT '[]',
        assignees JSONB NOT NULL DEFAULT '[]',
        dept_only BOOLEAN NOT NULL DEFAULT false,
        frequency TEXT NOT NULL DEFAULT 'weekly',
        due_offset_days INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true,
        last_generated_date TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async getRecurringTemplates(): Promise<RecurringTaskTemplate[]> {
    return db.select().from(recurringTaskTemplates).orderBy(desc(recurringTaskTemplates.createdAt));
  }

  async getRecurringTemplate(id: number): Promise<RecurringTaskTemplate | undefined> {
    const [row] = await db.select().from(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, id));
    return row;
  }

  async createRecurringTemplate(data: InsertRecurringTaskTemplate): Promise<RecurringTaskTemplate> {
    const [row] = await db.insert(recurringTaskTemplates).values(data).returning();
    return row;
  }

  async updateRecurringTemplate(id: number, data: Partial<InsertRecurringTaskTemplate>): Promise<RecurringTaskTemplate | undefined> {
    const sanitized: any = { ...data };
    delete sanitized.id;
    delete sanitized.createdAt;
    const [row] = await db.update(recurringTaskTemplates).set(sanitized).where(eq(recurringTaskTemplates.id, id)).returning();
    return row;
  }

  async deleteRecurringTemplate(id: number): Promise<void> {
    await db.delete(recurringTaskTemplates).where(eq(recurringTaskTemplates.id, id));
  }

  /**
   * Generate a fresh task from any recurring template that is due, then advance
   * its last_generated_date. Idempotent under concurrency: the guarded UPDATE
   * (WHERE last_generated_date IS unchanged) ensures only one caller generates
   * per interval even if several server instances run this at once.
   * Returns the number of tasks created.
   */
  async generateDueRecurringTasks(): Promise<number> {
    const today = todayServerLocalStr();
    const templates = await this.getRecurringTemplates();
    let created = 0;
    for (const t of templates) {
      if (!t.active) continue;
      const nextDate = nextRecurringDate(t.lastGeneratedDate, t.frequency);
      if (today < nextDate) continue; // not due yet

      // Atomically claim this generation: only proceed if last_generated_date
      // is still what we read (prevents duplicate tasks across instances/ticks).
      const claim = t.lastGeneratedDate === null
        ? await db.update(recurringTaskTemplates).set({ lastGeneratedDate: today })
            .where(and(eq(recurringTaskTemplates.id, t.id), isNull(recurringTaskTemplates.lastGeneratedDate))).returning()
        : await db.update(recurringTaskTemplates).set({ lastGeneratedDate: today })
            .where(and(eq(recurringTaskTemplates.id, t.id), eq(recurringTaskTemplates.lastGeneratedDate, t.lastGeneratedDate))).returning();
      if (claim.length === 0) continue; // another worker already generated

      const due = addDaysStr(today, t.dueOffsetDays || 0);
      await this.createTask({
        projectId: t.projectId,
        title: t.title,
        description: t.description || "",
        status: "Not Started",
        priority: t.priority,
        effort: t.effort ?? undefined,
        departments: (t.departments as string[]) || [],
        assignees: (t.assignees as number[]) || [],
        deptOnly: t.deptOnly,
        startDate: today,
        dueDate: due,
      } as InsertTask);
      created++;
    }
    return created;
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

  async backfillOutreachHours(): Promise<void> {
    // One-time backfill: for every completed outreach/volunteer signup that has
    // no matching time_entries row, insert one.  Safe to re-run (WHERE NOT EXISTS).
    await db.execute(sql`
      INSERT INTO time_entries (user_id, check_in_at, check_out_at, status, rounded_minutes, kind, calendar_event_id)
      SELECT
        es.user_id,
        es.checked_in_at,
        es.checked_out_at,
        'completed',
        CEIL(
          EXTRACT(EPOCH FROM (es.checked_out_at - es.checked_in_at)) / 900.0
        )::int * 15,
        ce.type,
        ce.id
      FROM event_signups es
      JOIN calendar_events ce ON ce.id = es.calendar_event_id
      WHERE es.checked_in_at IS NOT NULL
        AND es.checked_out_at IS NOT NULL
        AND ce.type IN ('outreach', 'volunteer')
        AND NOT EXISTS (
          SELECT 1 FROM time_entries te
          WHERE te.calendar_event_id = ce.id
            AND te.user_id = es.user_id
        )
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

  async getMatchExceptions(eventId: number): Promise<MatchException[]> {
    return db.select().from(matchExceptions).where(eq(matchExceptions.eventId, eventId));
  }

  async upsertMatchException(data: { eventId: number; userId: number; matchNumber: number; type: string; createdBy: number }): Promise<MatchException> {
    const [row] = await db.insert(matchExceptions).values(data)
      .onConflictDoUpdate({ target: [matchExceptions.eventId, matchExceptions.userId, matchExceptions.matchNumber], set: { type: data.type, createdBy: data.createdBy } })
      .returning();
    return row;
  }

  async deleteMatchException(eventId: number, userId: number, matchNumber: number): Promise<void> {
    await db.delete(matchExceptions).where(and(eq(matchExceptions.eventId, eventId), eq(matchExceptions.userId, userId), eq(matchExceptions.matchNumber, matchNumber)));
  }

  private defaultTeamSettings(): InsertTeamSettings {
    return {
      teamNumber: 10991,
      teamName: 'piobyte',
      themeColor: '#dc2626',
      logoUrl: null,
      departments: [
        { name: 'Mechanical', color: '#f97316' },
        { name: 'Software', color: '#3b82f6' },
        { name: 'Modeling', color: '#8b5cf6' },
        { name: 'Logistics', color: '#22c55e' },
        { name: 'Electrical', color: '#eab308' },
        { name: 'Business', color: '#14b8a6' },
        { name: 'Leadership', color: '#ef4444' },
      ],
      roles: [
        { name: 'Coach', tier: 'leadership' },
        { name: 'Team Captain', tier: 'leadership' },
        { name: 'SCRUM Master', tier: 'leadership' },
        { name: 'Department Head', tier: 'lead' },
        { name: 'Safety Trainer', tier: 'lead' },
        { name: 'Team Member', tier: 'member' },
        { name: 'Class Member', tier: 'member' },
      ],
    };
  }

  async getTeamSettings(): Promise<TeamSettings> {
    const [row] = await db.select().from(teamSettings);
    if (row) return row;
    const defaults = this.defaultTeamSettings();
    const [created] = await db.insert(teamSettings).values(defaults).returning();
    return created;
  }

  async upsertTeamSettings(data: Partial<Omit<TeamSettings, 'id' | 'updatedAt'>>): Promise<TeamSettings> {
    const existing = await db.select().from(teamSettings);
    if (existing.length > 0) {
      const [updated] = await db.update(teamSettings)
        .set({ ...(data as Partial<InsertTeamSettings>), updatedAt: new Date() })
        .where(eq(teamSettings.id, existing[0].id))
        .returning();
      return updated;
    }
    const merged: InsertTeamSettings = { ...this.defaultTeamSettings(), ...data };
    const [created] = await db.insert(teamSettings).values(merged).returning();
    return created;
  }

  async seedDatabase(): Promise<void> {
    const existingUsers = await this.getUsers();
    if (existingUsers.length > 0) return;

    const defaultUsers = [
      {
        username: 'coach_mentor',
        password: 'changeme',
        name: 'Coach Mentor',
        roles: ['Coach'],
        departments: ['Leadership', 'Business'],
      },
      {
        username: 'team_captain',
        password: 'changeme',
        name: 'Team Captain',
        roles: ['Team Captain', 'SCRUM Master'],
        departments: ['Software', 'Leadership'],
      },
      {
        username: 'mech_lead',
        password: 'changeme',
        name: 'Mechanical Lead',
        roles: ['Department Head'],
        departments: ['Mechanical'],
      },
      {
        username: 'sw_lead',
        password: 'changeme',
        name: 'Software Lead',
        roles: ['Department Head'],
        departments: ['Software'],
      },
      {
        username: 'elec_lead',
        password: 'changeme',
        name: 'Electrical Lead',
        roles: ['Department Head'],
        departments: ['Electrical'],
      },
      {
        username: 'safety_trainer',
        password: 'changeme',
        name: 'Safety Trainer',
        roles: ['Safety Trainer'],
        departments: ['Mechanical', 'Electrical'],
      },
      {
        username: 'member1',
        password: 'changeme',
        name: 'Team Member',
        roles: ['Team Member'],
        departments: ['Software'],
      },
    ];

    for (const user of defaultUsers) {
      await this.createUser({ ...user, password: await hashPassword(user.password) });
    }

    await this.createProject({
      name: 'Competition Robot',
      description: 'Main build-season project.',
      archived: false,
    });
  }

  async getGuestTokenByPin(pin: string): Promise<(GuestToken & { eventName: string }) | null> {
    const rows = await db
      .select({ token: guestTokens, eventName: scoutEvents.name })
      .from(guestTokens)
      .innerJoin(scoutEvents, eq(guestTokens.eventId, scoutEvents.id))
      .where(and(eq(guestTokens.pin, pin), eq(guestTokens.active, true)))
      .limit(1);
    if (!rows.length) return null;
    return { ...rows[0].token, eventName: rows[0].eventName };
  }

  async getActiveGuestToken(eventId: number): Promise<GuestToken | null> {
    const rows = await db
      .select()
      .from(guestTokens)
      .where(and(eq(guestTokens.eventId, eventId), eq(guestTokens.active, true)))
      .limit(1);
    return rows[0] || null;
  }

  async createGuestToken(eventId: number, pin: string, label: string, createdBy: number): Promise<GuestToken> {
    await db.update(guestTokens).set({ active: false }).where(eq(guestTokens.eventId, eventId));
    const [row] = await db.insert(guestTokens).values({ eventId, pin, label, active: true, createdBy }).returning();
    return row;
  }

  async deactivateGuestToken(eventId: number): Promise<void> {
    await db.update(guestTokens).set({ active: false }).where(eq(guestTokens.eventId, eventId));
  }
}

export const storage = new DatabaseStorage();
