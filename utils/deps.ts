import { Task, TaskStatus } from '../types';

export function getUnmetDependencies(task: Task, allTasks: Task[]): Task[] {
  return (task.dependencies || [])
    .map(depId => allTasks.find(t => t.id === depId))
    .filter((dep): dep is Task => !!dep && dep.status !== TaskStatus.Complete);
}

export function getUnmetDepNames(task: Task, allTasks: Task[]): string[] {
  return getUnmetDependencies(task, allTasks)
    .map(dep => dep.title);
}
