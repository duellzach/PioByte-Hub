import { Project } from '../types';

export interface BoardSelection {
  key: string;
  project?: Project;
  isDepartment: boolean;
  isArchived: boolean;
  isResolved: boolean;
}

/**
 * Resolves the displayed board synchronously. A remembered archived project is
 * never treated as deliberate archive browsing; callers must explicitly opt in
 * when the user chooses an archived selector option.
 */
export function resolveBoardSelection(
  requestedKey: string,
  accessibleProjects: Project[],
  departmentNames: string[],
  explicitlyBrowsingArchive = false,
): BoardSelection {
  const projectById = accessibleProjects.find(project => project.id === requestedKey);
  const validDepartment = requestedKey.startsWith('dept:')
    && departmentNames.includes(requestedKey.slice(5));

  if (projectById && (!projectById.archived || explicitlyBrowsingArchive)) {
    return {
      key: projectById.id,
      project: projectById,
      isDepartment: false,
      isArchived: !!projectById.archived,
      isResolved: true,
    };
  }
  if (validDepartment) {
    return { key: requestedKey, isDepartment: true, isArchived: false, isResolved: true };
  }

  // An empty project list is also the initial/loading state. Retain the user's
  // saved choice without granting it project permissions until data arrives.
  if (accessibleProjects.length === 0) {
    return { key: requestedKey, isDepartment: requestedKey.startsWith('dept:'), isArchived: false, isResolved: false };
  }

  const liveProject = accessibleProjects.find(project => !project.archived);
  if (liveProject) {
    return { key: liveProject.id, project: liveProject, isDepartment: false, isArchived: false, isResolved: true };
  }

  const department = departmentNames[0];
  if (department) {
    return { key: `dept:${department}`, isDepartment: true, isArchived: false, isResolved: true };
  }
  return { key: '', isDepartment: false, isArchived: false, isResolved: false };
}

export function canCreateTaskOnBoard(
  selection: BoardSelection,
  isLeader: boolean,
  accessibleProjects: Project[],
): boolean {
  if (selection.isDepartment) {
    // Existing department placement prefers a department-owned project, then
    // uses the first accessible live project. Do not narrow that policy here.
    const hasLiveHomeProject = accessibleProjects.some(project => !project.archived);
    return isLeader && hasLiveHomeProject;
  }
  if (!selection.project || selection.project.archived || !selection.isResolved) return false;
  return isLeader || selection.project.allowAllTaskCreation === true;
}

export function rememberedBoardStorageKey(userId: string | number): string {
  return `piobytes:lastActiveBoard:${String(userId)}`;
}
