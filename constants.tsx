
import React from 'react';
import { Department, TaskStatus, Priority, Role } from './types';

export const DEPARTMENTS = Object.values(Department);
export const STATUSES = Object.values(TaskStatus);
export const PRIORITIES = Object.values(Priority);
export const ROLES = Object.values(Role);

export const EFFORT_POINTS = [1, 2, 3, 5, 8];

// Team Colors: Red (#E11D48), Black (#0F172A), White (#FFFFFF)
export const DEPARTMENT_COLORS: Record<Department, string> = {
  [Department.Mechanical]: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
  [Department.Software]: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  [Department.Modeling]: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700',
  [Department.Logistics]: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
  [Department.Electrical]: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
  [Department.Business]: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700',
  [Department.Leadership]: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
};

export const DEPT_BORDER_COLORS: Record<Department, string> = {
  [Department.Mechanical]: 'border-l-[3px] border-l-orange-400',
  [Department.Software]: 'border-l-[3px] border-l-blue-500',
  [Department.Modeling]: 'border-l-[3px] border-l-violet-500',
  [Department.Logistics]: 'border-l-[3px] border-l-green-500',
  [Department.Electrical]: 'border-l-[3px] border-l-yellow-400',
  [Department.Business]: 'border-l-[3px] border-l-teal-400',
  [Department.Leadership]: 'border-l-[3px] border-l-red-600',
};

export const DEPT_DOT_COLORS: Record<Department, string> = {
  [Department.Mechanical]: 'bg-orange-400',
  [Department.Software]: 'bg-blue-500',
  [Department.Modeling]: 'bg-violet-500',
  [Department.Logistics]: 'bg-green-500',
  [Department.Electrical]: 'bg-yellow-400',
  [Department.Business]: 'bg-teal-400',
  [Department.Leadership]: 'bg-red-600',
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
  'Safety Trainer': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};
