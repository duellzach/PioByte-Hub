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

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
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
  scout: {
    getEvents: () => apiRequest<any[]>('/scout-events'),
    createEvent: (event: any) => apiRequest<any>('/scout-events', { method: 'POST', body: JSON.stringify(event) }),
    updateEvent: (id: number, event: any) => apiRequest<any>(`/scout-events/${id}`, { method: 'PUT', body: JSON.stringify(event) }),
    deleteEvent: (id: number) => apiRequest<void>(`/scout-events/${id}`, { method: 'DELETE' }),
    getPitScouts: (eventId: number) => apiRequest<any[]>(`/scout-events/${eventId}/pit-scouts`),
    createPitScout: (eventId: number, scout: any) => apiRequest<any>(`/scout-events/${eventId}/pit-scouts`, { method: 'POST', body: JSON.stringify(scout) }),
    updatePitScout: (id: number, scout: any) => apiRequest<any>(`/pit-scouts/${id}`, { method: 'PUT', body: JSON.stringify(scout) }),
    deletePitScout: (id: number) => apiRequest<void>(`/pit-scouts/${id}`, { method: 'DELETE' }),
    getMatchScouts: (eventId: number) => apiRequest<any[]>(`/scout-events/${eventId}/match-scouts`),
    createMatchScout: (eventId: number, scout: any) => apiRequest<any>(`/scout-events/${eventId}/match-scouts`, { method: 'POST', body: JSON.stringify(scout) }),
    updateMatchScout: (id: number, scout: any) => apiRequest<any>(`/match-scouts/${id}`, { method: 'PUT', body: JSON.stringify(scout) }),
    deleteMatchScout: (id: number) => apiRequest<void>(`/match-scouts/${id}`, { method: 'DELETE' }),
    getTeamAllMatches: (teamNumber: number) => apiRequest<any[]>(`/scout/team/${teamNumber}/all-matches`),
    exportEvent: (eventId: number) => apiRequest<any>(`/scout-events/${eventId}/export`),
    importEvent: (eventId: number, data: any) => apiRequest<any>(`/scout-events/${eventId}/import`, { method: 'POST', body: JSON.stringify(data) }),
  },
  tba: {
    getEventMatches: (eventKey: string) => apiRequest<any[]>(`/tba/event/${eventKey}/matches`),
    getEventTeams: (eventKey: string) => apiRequest<any[]>(`/tba/event/${eventKey}/teams`),
    getEventRankings: (eventKey: string) => apiRequest<any>(`/tba/event/${eventKey}/rankings`),
    getTeamMatches: (teamKey: string, eventKey: string) => apiRequest<any[]>(`/tba/team/${teamKey}/event/${eventKey}/matches`),
    getTeamStatus: (teamKey: string, eventKey: string) => apiRequest<any>(`/tba/team/${teamKey}/event/${eventKey}/status`),
    getTeamYearEvents: (teamKey: string, year: number) => apiRequest<any[]>(`/tba/team/${teamKey}/events/${year}`),
    getTeamYearStatuses: (teamKey: string, year: number) => apiRequest<any>(`/tba/team/${teamKey}/events/${year}/statuses`),
    getMatchVideos: (matchKey: string) => apiRequest<any>(`/tba/match/${matchKey}`),
  },
  nexus: {
    getEvent: (eventKey: string) => apiRequest<any>(`/nexus/${eventKey}`),
    getPits: (eventKey: string) => apiRequest<any>(`/nexus/${eventKey}/pits`),
  },
  eventInfo: {
    get: (eventId: number) => apiRequest<any>(`/scout-events/${eventId}/info`),
    update: (eventId: number, data: any) =>
      apiRequest<any>(`/scout-events/${eventId}/info`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  competitionAssignments: {
    list: (eventId: number) => apiRequest<any[]>(`/scout-events/${eventId}/assignments`),
    create: (eventId: number, data: any) =>
      apiRequest<any>(`/scout-events/${eventId}/assignments`, { method: 'POST', body: JSON.stringify(data) }),
    update: (eventId: number, id: number, data: any) =>
      apiRequest<any>(`/scout-events/${eventId}/assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (eventId: number, id: number, requesterId: number) =>
      apiRequest<void>(`/scout-events/${eventId}/assignments/${id}?requesterId=${requesterId}`, { method: 'DELETE' }),
  },
  competitionCheckins: {
    listByEvent: (eventId: number) => apiRequest<any[]>(`/competition-checkins?eventId=${eventId}`),
    listByUser: (userId: number) => apiRequest<any[]>(`/competition-checkins?userId=${userId}`),
    checkIn: (userId: number, eventId: number) =>
      apiRequest<any>('/competition-checkins/check-in', { method: 'POST', body: JSON.stringify({ userId, eventId }) }),
    checkOut: (id: number) =>
      apiRequest<any>(`/competition-checkins/${id}/check-out`, { method: 'POST', body: JSON.stringify({}) }),
    approve: (id: number, coachId: number, roundedMinutes?: number) =>
      apiRequest<any>(`/competition-checkins/${id}/approve`, { method: 'POST', body: JSON.stringify({ coachId, roundedMinutes }) }),
    update: (id: number, data: any) =>
      apiRequest<any>(`/competition-checkins/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      apiRequest<void>(`/competition-checkins/${id}`, { method: 'DELETE' }),
  },
  fullscreenAlerts: {
    list: (activeOnly = false) => apiRequest<any[]>(`/fullscreen-alerts${activeOnly ? '?active=true' : ''}`),
    create: (data: any) =>
      apiRequest<any>('/fullscreen-alerts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      apiRequest<any>(`/fullscreen-alerts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      apiRequest<void>(`/fullscreen-alerts/${id}`, { method: 'DELETE' }),
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
