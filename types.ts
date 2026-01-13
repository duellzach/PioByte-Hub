
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
  Coach = 'Coach'
}

export enum TaskStatus {
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
  successCriteria: string[];
  attachments: Attachment[];
  comments: Comment[];
  history: Activity[];
  startDate: string;
  dueDate: string;
  dependencies: string[];
  helpRequested?: boolean;
  blockedReason?: string;
  completedAt?: number;
  createdAt: number;
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
  timeEntries: TimeEntry[];
  currentUser: User | null;
}
