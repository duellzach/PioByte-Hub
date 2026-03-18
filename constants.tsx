
import React from 'react';
import { Department, TaskStatus, Priority, Role } from './types';

export const DEPARTMENTS = Object.values(Department);
export const STATUSES = Object.values(TaskStatus);
export const PRIORITIES = Object.values(Priority);
export const ROLES = Object.values(Role);

export const EFFORT_POINTS = [1, 2, 3, 5, 8];

// Team Colors: Red (#E11D48), Black (#0F172A), White (#FFFFFF)
export const DEPARTMENT_COLORS: Record<Department, string> = {
  [Department.Mechanical]: 'bg-slate-100 text-slate-800 border-slate-300',
  [Department.Software]: 'bg-slate-100 text-slate-800 border-slate-300',
  [Department.Modeling]: 'bg-slate-100 text-slate-800 border-slate-300',
  [Department.Logistics]: 'bg-slate-100 text-slate-800 border-slate-300',
  [Department.Electrical]: 'bg-slate-100 text-slate-800 border-slate-300',
  [Department.Business]: 'bg-slate-100 text-slate-800 border-slate-300',
  [Department.Leadership]: 'bg-slate-100 text-slate-800 border-slate-300',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.Backlog]: 'bg-purple-50 text-purple-600 border-purple-100',
  [TaskStatus.NotStarted]: 'bg-slate-100 text-slate-600',
  [TaskStatus.InProgress]: 'bg-red-50 text-red-600 border-red-100',
  [TaskStatus.Blocked]: 'bg-black text-white',
  [TaskStatus.Complete]: 'bg-green-100 text-green-600',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  [Priority.Low]: 'bg-slate-100 text-slate-600',
  [Priority.Medium]: 'bg-slate-100 text-slate-700 font-bold',
  [Priority.High]: 'bg-red-100 text-red-700 font-bold border-red-200',
  [Priority.Urgent]: 'bg-red-600 text-white font-black',
};

export const ROLE_COLORS: Record<string, string> = {
  'Scout - Stands': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Pit Crew': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Networking': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Media': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Free Time': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'Driver/Coach Support': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
};
