import { api } from './api';

export async function suggestSuccessCriteria(taskTitle: string, department: string) {
  try {
    return await api.ai.suggestCriteria(taskTitle, department);
  } catch (error) {
    console.error("Failed to suggest criteria:", error);
    return [];
  }
}

export async function summarizeProjectProgress(projectTasks: any[]) {
  try {
    const result = await api.ai.summarizeProgress(projectTasks);
    return result.summary;
  } catch (error) {
    console.error("Failed to summarize progress:", error);
    return "Unable to generate summary at this time.";
  }
}
