import { pgTable, serial, text, integer, boolean, timestamp, jsonb, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  roles: jsonb("roles").$type<string[]>().notNull().default([]),
  departments: jsonb("departments").$type<string[]>().notNull().default([]),
  muted: boolean("muted").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  department: text("department"),
  scrumMasters: jsonb("scrum_masters").$type<number[]>().notNull().default([]),
  showInWarRoom: boolean("show_in_war_room").notNull().default(true),
  allowAllTaskCreation: boolean("allow_all_task_creation").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("Not Started"),
  priority: text("priority").notNull().default("Medium"),
  effort: integer("effort"),
  departments: jsonb("departments").$type<string[]>().notNull().default([]),
  assignees: jsonb("assignees").$type<number[]>().notNull().default([]),
  contributors: jsonb("contributors").$type<number[]>().notNull().default([]),
  successCriteria: jsonb("success_criteria").$type<{id: string; text: string; completed: boolean}[]>().notNull().default([]),
  attachments: jsonb("attachments").$type<{id: string; label: string; url: string; type: string}[]>().notNull().default([]),
  comments: jsonb("comments").$type<{id: string; userId: number; text: string; timestamp: number}[]>().notNull().default([]),
  history: jsonb("history").$type<{id: string; userId: number; action: string; timestamp: number}[]>().notNull().default([]),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  dependencies: jsonb("dependencies").$type<number[]>().notNull().default([]),
  helpRequested: boolean("help_requested").notNull().default(false),
  deptOnly: boolean("dept_only").notNull().default(false),
  blockedReason: text("blocked_reason"),
  completedAt: timestamp("completed_at"),
  requiredCertificationId: integer("required_certification_id").references(() => safetyCertifications.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  toUserId: integer("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fromUserId: integer("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  timestamp: timestamp("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  scope: text("scope").notNull().default("Global"),
  targetDepartment: text("target_department"),
  comments: jsonb("comments").$type<{id: string; userId: number; text: string; timestamp: number}[]>().notNull().default([]),
  timestamp: timestamp("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sentNotifications: many(notifications, { relationName: "sentNotifications" }),
  receivedNotifications: many(notifications, { relationName: "receivedNotifications" }),
  announcements: many(announcements),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  toUser: one(users, { fields: [notifications.toUserId], references: [users.id], relationName: "receivedNotifications" }),
  fromUser: one(users, { fields: [notifications.fromUserId], references: [users.id], relationName: "sentNotifications" }),
  task: one(tasks, { fields: [notifications.taskId], references: [tasks.id] }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  author: one(users, { fields: [announcements.authorId], references: [users.id] }),
}));

export const generalTasks = pgTable("general_tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  checkInAt: timestamp("check_in_at").notNull(),
  checkOutAt: timestamp("check_out_at"),
  checkInConfirmedBy: integer("check_in_confirmed_by").references(() => users.id),
  checkInConfirmedAt: timestamp("check_in_confirmed_at"),
  checkOutConfirmedBy: integer("check_out_confirmed_by").references(() => users.id),
  checkOutConfirmedAt: timestamp("check_out_confirmed_at"),
  status: text("status").notNull().default("pending_check_in"),
  roundedMinutes: integer("rounded_minutes"),
  notes: text("notes"),
  workingOnTaskId: integer("working_on_task_id").references(() => tasks.id, { onDelete: "set null" }),
  workingOnGeneralTaskId: integer("working_on_general_task_id").references(() => generalTasks.id, { onDelete: "set null" }),
  taskHandoffNote: text("task_handoff_note"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const timeEntryAudit = pgTable("time_entry_audit", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull().references(() => timeEntries.id, { onDelete: "cascade" }),
  actorId: integer("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  previousValues: jsonb("previous_values").$type<Record<string, any>>(),
  newValues: jsonb("new_values").$type<Record<string, any>>(),
  deltaMinutes: integer("delta_minutes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const timeEntriesRelations = relations(timeEntries, ({ one, many }) => ({
  user: one(users, { fields: [timeEntries.userId], references: [users.id] }),
  checkInConfirmer: one(users, { fields: [timeEntries.checkInConfirmedBy], references: [users.id] }),
  checkOutConfirmer: one(users, { fields: [timeEntries.checkOutConfirmedBy], references: [users.id] }),
  auditLogs: many(timeEntryAudit),
}));

export const timeEntryAuditRelations = relations(timeEntryAudit, ({ one }) => ({
  entry: one(timeEntries, { fields: [timeEntryAudit.entryId], references: [timeEntries.id] }),
  actor: one(users, { fields: [timeEntryAudit.actorId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;
export const scoutEvents = pgTable("scout_events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull().default(""),
  startDate: text("start_date"),
  endDate: text("end_date"),
  tbaEventKey: text("tba_event_key"),
  nexusEventKey: text("nexus_event_key"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const pitScouts = pgTable("pit_scouts", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => scoutEvents.id, { onDelete: "cascade" }),
  teamNumber: integer("team_number").notNull(),
  teamName: text("team_name").notNull().default(""),
  robotName: text("robot_name").notNull().default(""),
  drivetrain: text("drivetrain").notNull().default(""),
  weight: integer("weight"),
  speed: integer("speed"),
  height: integer("height"),
  fuelCapacity: integer("fuel_capacity").notNull().default(0),
  traversalAbility: text("traversal_ability").notNull().default(""),
  shooterType: text("shooter_type").notNull().default(""),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  deficiencies: jsonb("deficiencies").$type<string[]>().notNull().default([]),
  autonomousRoutine: text("autonomous_routine").notNull().default(""),
  autoOptions: jsonb("auto_options").$type<string[]>().notNull().default([]),
  notes: text("notes").notNull().default(""),
  photoUrl: text("photo_url"),
  offenseRating: integer("offense_rating").notNull().default(5),
  defenseRating: integer("defense_rating").notNull().default(5),
  overallRating: integer("overall_rating").notNull().default(5),
  coreValuesRating: integer("core_values_rating").notNull().default(3),
  scoutedBy: integer("scouted_by").notNull().references(() => users.id),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const matchScouts = pgTable("match_scouts", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => scoutEvents.id, { onDelete: "cascade" }),
  matchNumber: integer("match_number").notNull(),
  matchType: text("match_type").notNull().default("qualification"),
  teamNumber: integer("team_number").notNull(),
  alliance: text("alliance").notNull().default("Red"),
  autoScore: integer("auto_score").notNull().default(0),
  teleopScore: integer("teleop_score").notNull().default(0),
  endgameScore: integer("endgame_score").notNull().default(0),
  penalties: integer("penalties").notNull().default(0),
  autoClimb: boolean("auto_climb").notNull().default(false),
  endClimbLevel: integer("end_climb_level").notNull().default(0),
  coralScored: integer("coral_scored").notNull().default(0),
  algaeScored: integer("algae_scored").notNull().default(0),
  autoFuelTotal: integer("auto_fuel_total").notNull().default(0),
  teleopFuelTotal: integer("teleop_fuel_total").notNull().default(0),
  humanPlayerScore: integer("human_player_score").notNull().default(0),
  defenseRating: integer("defense_rating").notNull().default(3),
  drivingSkillRating: integer("driving_skill_rating").notNull().default(3),
  coreValuesRating: integer("core_values_rating").notNull().default(3),
  autoUsed: text("auto_used").notNull().default(""),
  notes: text("notes").notNull().default(""),
  scoutedBy: integer("scouted_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type GeneralTask = typeof generalTasks.$inferSelect;
export type InsertGeneralTask = typeof generalTasks.$inferInsert;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = typeof timeEntries.$inferInsert;
export type TimeEntryAudit = typeof timeEntryAudit.$inferSelect;
export type InsertTimeEntryAudit = typeof timeEntryAudit.$inferInsert;
export type ScoutEvent = typeof scoutEvents.$inferSelect;
export type InsertScoutEvent = typeof scoutEvents.$inferInsert;
export type PitScout = typeof pitScouts.$inferSelect;
export type InsertPitScout = typeof pitScouts.$inferInsert;
export type MatchScout = typeof matchScouts.$inferSelect;
export type InsertMatchScout = typeof matchScouts.$inferInsert;

export const competitionAssignments = pgTable("competition_assignments", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => scoutEvents.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fromMatch: integer("from_match").notNull(),
  toMatch: integer("to_match").notNull(),
  role: text("role").notNull().default("Scout - Stands"),
  notes: text("notes"),
  autoAssignScouting: boolean("auto_assign_scouting").notNull().default(false),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const eventInfo = pgTable("event_info", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().unique().references(() => scoutEvents.id, { onDelete: "cascade" }),
  venueInfo: text("venue_info"),
  wifiNetwork: text("wifi_network"),
  wifiPassword: text("wifi_password"),
  parkingInfo: text("parking_info"),
  schedule: text("schedule"),
  resources: text("resources"),
  notes: text("notes"),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const competitionCheckinAudit = pgTable("competition_checkin_audit", {
  id: serial("id").primaryKey(),
  checkinId: integer("checkin_id").notNull(),
  actorId: integer("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  previousValues: jsonb("previous_values").$type<Record<string, any>>(),
  newValues: jsonb("new_values").$type<Record<string, any>>(),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const competitionCheckins = pgTable("competition_checkins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull().references(() => scoutEvents.id, { onDelete: "cascade" }),
  checkInAt: timestamp("check_in_at").notNull(),
  checkOutAt: timestamp("check_out_at"),
  status: text("status").notNull().default("checked_in"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  roundedMinutes: integer("rounded_minutes"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const fullscreenAlerts = pgTable("fullscreen_alerts", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => scoutEvents.id, { onDelete: "set null" }),
  type: text("type").notNull().default("general"),
  message: text("message").notNull(),
  targetAll: boolean("target_all").notNull().default(true),
  targetPitDisplay: boolean("target_pit_display").notNull().default(false),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  expiresAt: timestamp("expires_at"),
  active: boolean("active").notNull().default(true),
});

export type CompetitionAssignment = typeof competitionAssignments.$inferSelect;
export type InsertCompetitionAssignment = typeof competitionAssignments.$inferInsert;
export type EventInfo = typeof eventInfo.$inferSelect;
export type InsertEventInfo = typeof eventInfo.$inferInsert;
export type CompetitionCheckin = typeof competitionCheckins.$inferSelect;
export type InsertCompetitionCheckin = typeof competitionCheckins.$inferInsert;
export type CompetitionCheckinAudit = typeof competitionCheckinAudit.$inferSelect;
export type InsertCompetitionCheckinAudit = typeof competitionCheckinAudit.$inferInsert;
export type FullscreenAlert = typeof fullscreenAlerts.$inferSelect;
export type InsertFullscreenAlert = typeof fullscreenAlerts.$inferInsert;

export const teamClaims = pgTable("team_claims", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => scoutEvents.id, { onDelete: "cascade" }),
  matchKey: text("match_key").notNull(),
  teamNumber: integer("team_number").notNull(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  claimedAt: timestamp("claimed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => ({
  uniqSlot: uniqueIndex("team_claims_slot_idx").on(t.eventId, t.matchKey, t.teamNumber),
}));

export type TeamClaim = typeof teamClaims.$inferSelect;
export type InsertTeamClaim = typeof teamClaims.$inferInsert;

export const safetyCertifications = pgTable("safety_certifications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  equipment: text("equipment").notNull().default(""),
  description: text("description").notNull().default(""),
  safetyGuide: text("safety_guide").notNull().default(""),
  checklistItems: jsonb("checklist_items").$type<{ id: string; text: string }[]>().notNull().default([]),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const userCertifications = pgTable("user_certifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  certificationId: integer("certification_id").notNull().references(() => safetyCertifications.id, { onDelete: "cascade" }),
  grantedBy: integer("granted_by").notNull().references(() => users.id),
  grantedAt: timestamp("granted_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => ({
  uniqUserCert: uniqueIndex("user_certifications_user_cert_idx").on(t.userId, t.certificationId),
}));

export const certificationRequests = pgTable("certification_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  certificationId: integer("certification_id").notNull().references(() => safetyCertifications.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  trainerId: integer("trainer_id").references(() => users.id),
  checklistProgress: jsonb("checklist_progress").$type<{ id: string; completed: boolean }[]>().notNull().default([]),
  notes: text("notes"),
  requestedAt: timestamp("requested_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (t) => ({
  uniqActiveRequest: uniqueIndex("cert_requests_active_uniq_idx")
    .on(t.userId, t.certificationId)
    .where(sql`status IN ('pending', 'in_progress')`),
}));

export type SafetyCertification = typeof safetyCertifications.$inferSelect;
export type InsertSafetyCertification = typeof safetyCertifications.$inferInsert;
export type UserCertification = typeof userCertifications.$inferSelect;
export type InsertUserCertification = typeof userCertifications.$inferInsert;
export type CertificationRequest = typeof certificationRequests.$inferSelect;
export type InsertCertificationRequest = typeof certificationRequests.$inferInsert;

export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  type: text("type").notNull().default("shop"),
  location: text("location").notNull().default(""),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  recurrenceType: text("recurrence_type"),
  recurrenceEndsOn: text("recurrence_ends_on"),
  parentEventId: integer("parent_event_id").references((): AnyPgColumn => calendarEvents.id, { onDelete: 'cascade' }),
  instanceDate: text("instance_date"),
  deletedDates: text("deleted_dates"),
  attending: boolean("attending").notNull().default(true),
});

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("Other"),
  addedBy: integer("added_by").notNull().references(() => users.id),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Resource = typeof resources.$inferSelect;
export type InsertResource = typeof resources.$inferInsert;
