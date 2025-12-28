const API_BASE = '/api';

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      apiRequest<any>('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
  },
  users: {
    getAll: () => apiRequest<any[]>('/users'),
    create: (user: any) =>
      apiRequest<any>('/users', { method: 'POST', body: JSON.stringify(user) }),
    update: (id: number, user: any) =>
      apiRequest<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(user) }),
    delete: (id: number) =>
      apiRequest<void>(`/users/${id}`, { method: 'DELETE' }),
  },
  projects: {
    getAll: () => apiRequest<any[]>('/projects'),
    get: (id: number) => apiRequest<any>(`/projects/${id}`),
    create: (project: any) =>
      apiRequest<any>('/projects', { method: 'POST', body: JSON.stringify(project) }),
    update: (id: number, project: any) =>
      apiRequest<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(project) }),
    delete: (id: number) =>
      apiRequest<void>(`/projects/${id}`, { method: 'DELETE' }),
  },
  tasks: {
    getAll: () => apiRequest<any[]>('/tasks'),
    get: (id: number) => apiRequest<any>(`/tasks/${id}`),
    create: (task: any) =>
      apiRequest<any>('/tasks', { method: 'POST', body: JSON.stringify(task) }),
    update: (id: number, task: any) =>
      apiRequest<any>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) }),
    delete: (id: number) =>
      apiRequest<void>(`/tasks/${id}`, { method: 'DELETE' }),
  },
  notifications: {
    getAll: () => apiRequest<any[]>('/notifications'),
    create: (notification: any) =>
      apiRequest<any>('/notifications', { method: 'POST', body: JSON.stringify(notification) }),
    update: (id: number, notification: any) =>
      apiRequest<any>(`/notifications/${id}`, { method: 'PUT', body: JSON.stringify(notification) }),
    delete: (id: number) =>
      apiRequest<void>(`/notifications/${id}`, { method: 'DELETE' }),
  },
  announcements: {
    getAll: () => apiRequest<any[]>('/announcements'),
    create: (announcement: any) =>
      apiRequest<any>('/announcements', { method: 'POST', body: JSON.stringify(announcement) }),
    update: (id: number, announcement: any) =>
      apiRequest<any>(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(announcement) }),
    delete: (id: number) =>
      apiRequest<void>(`/announcements/${id}`, { method: 'DELETE' }),
  },
  ai: {
    suggestCriteria: (taskTitle: string, department: string) =>
      apiRequest<string[]>('/ai/suggest-criteria', {
        method: 'POST',
        body: JSON.stringify({ taskTitle, department }),
      }),
    summarizeProgress: (tasks: any[]) =>
      apiRequest<{ summary: string }>('/ai/summarize-progress', {
        method: 'POST',
        body: JSON.stringify({ tasks }),
      }),
  },
  seed: () =>
    apiRequest<{ success: boolean }>('/seed', { method: 'POST' }),
  changePassword: (userId: number, currentPassword: string, newPassword: string) =>
    apiRequest<{ success: boolean }>(`/users/${userId}/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  timeEntries: {
    getAll: () => apiRequest<any[]>('/time-entries'),
    get: (id: number) => apiRequest<any>(`/time-entries/${id}`),
    checkIn: (userId: number) =>
      apiRequest<any>('/time-entries/check-in', { method: 'POST', body: JSON.stringify({ userId }) }),
    checkOut: (id: number, userId: number) =>
      apiRequest<any>(`/time-entries/${id}/check-out`, { method: 'POST', body: JSON.stringify({ userId }) }),
    confirm: (id: number, coachId: number, confirmType: 'check_in' | 'check_out') =>
      apiRequest<any>(`/time-entries/${id}/confirm`, { method: 'POST', body: JSON.stringify({ coachId, confirmType }) }),
    update: (id: number, coachId: number, data: { checkInAt?: string; checkOutAt?: string; notes?: string }) =>
      apiRequest<any>(`/time-entries/${id}`, { method: 'PUT', body: JSON.stringify({ coachId, ...data }) }),
    delete: (id: number, coachId: number) =>
      apiRequest<void>(`/time-entries/${id}`, { method: 'DELETE', body: JSON.stringify({ coachId }) }),
    getAudit: (id: number) => apiRequest<any[]>(`/time-entries/${id}/audit`),
    bulkAdd: (coachId: number, userIds: number[], minutes: number, notes?: string, date?: string) =>
      apiRequest<any[]>('/time-entries/bulk-add', { 
        method: 'POST', 
        body: JSON.stringify({ coachId, userIds, minutes, notes, date }) 
      }),
  },
};
