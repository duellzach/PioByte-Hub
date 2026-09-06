
import type { HourCategory } from './shared/hourCategories';

export enum Department {
  Mechanical = 'Mechanical',
  Software = 'Software',
  Modeling = 'Modeling',
  Logistics = 'Logistics',
  Electrical = 'Electrical',
  Business = 'Business',
  Leadership = 'Leadership'
}

export enum Role {
  ScrumMaster = 'SCRUM Master',
  TeamCaptain = 'Team Captain',
  DepartmentHead = 'Department Head',
  TeamMember = 'Team Member',
  ClassMember = 'Class Member',
  Coach = 'Coach',
  Trainer = 'Trainer'
}

export enum TaskStatus {
  Backlog = 'Backlog',
  NotStarted = 'Not Started',
  InProgress = 'In Progress',
  Blocked = 'Blocked',
  Complete = 'Complete'
}

export enum Priority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Urgent = 'Urgent'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  departments: Department[];
  roles: Role[];
  muted?: boolean;
  archived?: boolean;
  guestEventId?: number;
}

export type BadgeKind = 'level' | 'custom';

export interface BadgeDefinition {
  id: number;
  name: string;
  description: string;
  icon: string;   // key into BADGE_ICONS, components/badgeStyles.tsx
  color: string;  // hex
  archived: boolean;
  createdBy: number;
}

export interface Badge {
  id: number;
  userId: number;
  kind: BadgeKind;
  badgeDefinitionId?: number | null;
  department?: string | null; // null = General (kind = 'level')
  level?: number | null;
  awardedBy?: number | null;  // null = automatically earned
  note?: string | null;
  earnedAt: string;
}

export interface TrainerScope {
  id: number;
  userId: number;
  department: string | null; // null = General
  maxLevel: number;
}

export interface Attachment {
  id: string;
  label: string;
  url: string;
  type: 'doc' | 'github' | 'cad' | 'other';
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
}

export interface Activity {
  id: string;
  userId: string;
  action: string;
  timestamp: number;
}

export interface Notification {
  id: string;
  toUserId: string;
  fromUserId: string;
  taskId: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface Announcement {
  id: string;
  authorId: string;
  text: string;
  timestamp: number;
  scope: 'Global' | 'Department';
  targetDepartment?: Department;
  comments: Comment[];
}

export interface SuccessCriterion {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  effort?: number;
  departments: Department[];
  assignees: string[];
  contributors: string[];
  successCriteria: SuccessCriterion[];
  attachments: Attachment[];
  comments: Comment[];
  history: Activity[];
  // Nullable in the database (`text("start_date")` / `text("due_date")` in
  // shared/schema.ts) and TaskModal normalizes a cleared field back to null, so
  // these must be declared honestly — typing them as plain `string` hid a crash
  // where a task with no due date took the Boards page down inside
  // `parseLocalDate(task.dueDate)`.
  startDate: string | null;
  dueDate: string | null;
  dependencies: string[];
  helpRequested?: boolean;
  deptOnly?: boolean;
  blockedReason?: string;
  completedAt?: number;
  createdAt: number;
  requiredCertificationId?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  archived: boolean;
  department?: string;
  scrumMasters: string[];
  showInWarRoom: boolean;
  allowAllTaskCreation?: boolean;
  links: Attachment[];
}

export type TimeEntryStatus = 'pending_check_in' | 'checked_in' | 'pending_check_out' | 'completed';

export interface TimeEntry {
  id: string;
  userId: string;
  checkInAt: number;
  checkOutAt?: number;
  checkInConfirmedBy?: string;
  checkInConfirmedAt?: number;
  checkOutConfirmedBy?: string;
  checkOutConfirmedAt?: number;
  status: TimeEntryStatus;
  roundedMinutes?: number;
  notes?: string;
  createdAt: number;
  kind?: HourCategory;
  calendarEventId?: number | null;
}

export interface TimeEntryWithTaskInfo extends TimeEntry {
  workingOnTaskId?: number | null;
  workingOnGeneralTaskId?: number | null;
  workingOnTaskTitle?: string | null;
  workingOnGeneralTaskName?: string | null;
  taskHandoffNote?: string | null;
}

export interface AvailableTask {
  id: number;
  title: string;
  status: TaskStatus;
  priority: Priority;
  effort: number;
  /** Whether the viewer is an assignee — sorts their own work to the top.
   *  Not a permission: anyone may clock onto any live task they're helping with. */
  isAssigned: boolean;
  projectName: string;
  departments: string[];
}

/** Minutes by hour category for one member/window, plus the summed `total`. */
export type CategoryTotals = Record<string, number> & { total: number };

/** One row of the Team summary table, already scoped to the chosen window. */
export interface MemberProductivity {
  userId: number;
  name: string;
  username: string;
  departments: string[];
  roles: string[];
  muted: boolean;
  hours: CategoryTotals;
  sessions: number;
  tasksCompleted: number;
  effort: number;
  /** Live assigned tasks — a standing count, deliberately not windowed. */
  activeTasks: number;
  tasksWorked: number;
}

/** A task the member logged time against, with minutes attributed to it. */
export interface TaskContribution {
  taskId: number | null;
  generalTaskId: number | null;
  title: string;
  projectName: string | null;
  status: string | null;
  effort: number | null;
  minutes: number;
  sessions: number;
  lastWorkedAt: string | null;
  isAssignee: boolean;
}

export interface ProductivityDeepDive {
  user: { id: number; name: string; username: string; departments: string[]; roles: string[] };
  window: { start: string | null; end: string | null };
  hours: CategoryTotals;
  sessions: { id: number; date: string; kind: string; minutes: number; status: string; taskTitle: string | null; notes: string | null }[];
  byDay: { date: string; minutes: number }[];
  contributions: TaskContribution[];
  tasksCompleted: { id: number; title: string; projectName: string; effort: number | null; completedAt: string }[];
  tasksActive: { id: number; title: string; projectName: string; status: string; effort: number | null; dueDate: string | null }[];
}

export interface GeneralTask {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  createdBy: number;
  createdAt: string;
}

export interface TimeEntryAudit {
  id: string;
  entryId: string;
  actorId: string;
  actionType: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  deltaMinutes?: number;
  createdAt: number;
}

export interface AppState {
  users: User[];
  projects: Project[];
  tasks: Task[];
  notifications: Notification[];
  announcements: Announcement[];
  timeEntries: TimeEntryWithTaskInfo[];
  currentUser: User | null;
}
