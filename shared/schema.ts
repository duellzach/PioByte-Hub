import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  roles: jsonb("roles").$type<string[]>().notNull().default([]),
  departments: jsonb("departments").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
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
  successCriteria: jsonb("success_criteria").$type<string[]>().notNull().default([]),
  attachments: jsonb("attachments").$type<{id: string; label: string; url: string; type: string}[]>().notNull().default([]),
  comments: jsonb("comments").$type<{id: string; userId: number; text: string; timestamp: number}[]>().notNull().default([]),
  history: jsonb("history").$type<{id: string; userId: number; action: string; timestamp: number}[]>().notNull().default([]),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  dependencies: jsonb("dependencies").$type<number[]>().notNull().default([]),
  helpRequested: boolean("help_requested").notNull().default(false),
  blockedReason: text("blocked_reason"),
  completedAt: timestamp("completed_at"),
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
