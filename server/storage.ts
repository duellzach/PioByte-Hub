import { db } from "./db";
import { users, projects, tasks, notifications, announcements, timeEntries, timeEntryAudit, scoutEvents, pitScouts, matchScouts, competitionAssignments, eventInfo, competitionCheckins, fullscreenAlerts } from "../shared/schema";
import type { User, InsertUser, Project, InsertProject, Task, InsertTask, Notification, InsertNotification, Announcement, InsertAnnouncement, TimeEntry, InsertTimeEntry, TimeEntryAudit, InsertTimeEntryAudit, ScoutEvent, InsertScoutEvent, PitScout, InsertPitScout, MatchScout, InsertMatchScout, CompetitionAssignment, InsertCompetitionAssignment, EventInfo, InsertEventInfo, CompetitionCheckin, InsertCompetitionCheckin, FullscreenAlert, InsertFullscreenAlert } from "../shared/schema";
import { eq, desc, and, isNull } from "drizzle-orm";

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

  async getTimeEntries(): Promise<TimeEntry[]> {
    return db.select().from(timeEntries).orderBy(desc(timeEntries.createdAt));
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
    const sanitized: any = { ...event };
    delete sanitized.id;
    const [updated] = await db.update(scoutEvents).set(sanitized).where(eq(scoutEvents.id, id)).returning();
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
