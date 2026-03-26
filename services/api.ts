import type { AvailableTask, GeneralTask } from '../types';

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
    const err: any = new Error(`API error: ${response.status} ${response.statusText}`);
    err.status = response.status;
    throw err;
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
    getTeamClaims: (eventId: number) => apiRequest<any[]>(`/events/${eventId}/team-claims`),
    upsertTeamClaim: (eventId: number, data: { matchKey: string; teamNumber: number; userId: number; userName: string }) =>
      apiRequest<any>(`/events/${eventId}/team-claims`, { method: 'POST', body: JSON.stringify(data) }),
    deleteTeamClaim: (eventId: number, matchKey: string, teamNumber: number, userId: number) =>
      apiRequest<void>(`/events/${eventId}/team-claims`, { method: 'DELETE', body: JSON.stringify({ matchKey, teamNumber, userId }) }),
  },
  matchExceptions: {
    list: (eventId: number) => apiRequest<any[]>(`/events/${eventId}/match-exceptions`),
    upsert: (eventId: number, data: { userId: number; matchNumber: number; type?: string; createdBy: number }) =>
      apiRequest<any>(`/events/${eventId}/match-exceptions`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (eventId: number, userId: number, matchNumber: number, requesterId: number) =>
      apiRequest<void>(`/events/${eventId}/match-exceptions`, { method: 'DELETE', body: JSON.stringify({ userId, matchNumber, requesterId }) }),
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
    getPitMap: (eventKey: string) => apiRequest<any>(`/nexus/${eventKey}/map`),
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
    reject: (id: number, coachId: number) =>
      apiRequest<any>(`/competition-checkins/${id}/reject`, { method: 'POST', body: JSON.stringify({ coachId }) }),
    manualAdd: (coachId: number, userId: number, eventId: number, minutes: number, notes?: string) =>
      apiRequest<any>('/competition-checkins/manual-add', { method: 'POST', body: JSON.stringify({ coachId, userId, eventId, minutes, notes }) }),
    update: (id: number, actorId: number, data: any) =>
      apiRequest<any>(`/competition-checkins/${id}`, { method: 'PUT', body: JSON.stringify({ actorId, ...data }) }),
    delete: (id: number, actorId: number) =>
      apiRequest<void>(`/competition-checkins/${id}?actorId=${actorId}`, { method: 'DELETE' }),
    getAudit: (checkinId: number) => apiRequest<any[]>(`/competition-checkins/${checkinId}/audit`),
  },
  fullscreenAlerts: {
    list: (activeOnly = false) => apiRequest<any[]>(`/fullscreen-alerts${activeOnly ? '?active=true' : ''}`),
    create: (data: any) =>
      apiRequest<any>('/fullscreen-alerts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, actorId: number, data: any) =>
      apiRequest<any>(`/fullscreen-alerts/${id}`, { method: 'PUT', body: JSON.stringify({ ...data, actorId }) }),
    delete: (id: number, actorId: number) =>
      apiRequest<void>(`/fullscreen-alerts/${id}?actorId=${actorId}`, { method: 'DELETE' }),
  },
  certifications: {
    getAll: () => apiRequest<any[]>('/certifications'),
    get: (id: number) => apiRequest<any>(`/certifications/${id}`),
    create: (data: any) => apiRequest<any>('/certifications', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, requesterId: number, data: any) =>
      apiRequest<any>(`/certifications/${id}`, { method: 'PUT', body: JSON.stringify({ ...data, requesterId }) }),
    delete: (id: number, requesterId: number) =>
      apiRequest<void>(`/certifications/${id}?requesterId=${requesterId}`, { method: 'DELETE' }),
    getCertifiedUsers: (id: number) => apiRequest<any[]>(`/certifications/${id}/certified-users`),
    getTrainers: (id: number) => apiRequest<any[]>(`/certifications/${id}/trainers`),
    getForUser: (userId: number) => apiRequest<any[]>(`/users/${userId}/certifications`),
    grantUser: (userId: number, certId: number, grantedBy: number) =>
      apiRequest<any>(`/users/${userId}/certifications`, { method: 'POST', body: JSON.stringify({ certId, grantedBy }) }),
    revokeUser: (userId: number, certId: number, requesterId: number) =>
      apiRequest<void>(`/users/${userId}/certifications/${certId}?requesterId=${requesterId}`, { method: 'DELETE' }),
  },
  certRequests: {
    getAll: (filters?: { requesterId?: number; targetUserId?: number; statuses?: string[] }) => {
      const params = new URLSearchParams();
      if (filters?.requesterId !== undefined) params.set('requesterId', String(filters.requesterId));
      if (filters?.targetUserId !== undefined) params.set('targetUserId', String(filters.targetUserId));
      if (filters?.statuses?.length) params.set('statuses', filters.statuses.join(','));
      const qs = params.toString();
      return apiRequest<any[]>(`/cert-requests${qs ? `?${qs}` : ''}`);
    },
    create: (userId: number, certId: number) =>
      apiRequest<any>('/cert-requests', { method: 'POST', body: JSON.stringify({ userId, certId }) }),
    claim: (requestId: number, trainerId: number) =>
      apiRequest<any>(`/cert-requests/${requestId}/claim`, { method: 'POST', body: JSON.stringify({ trainerId }) }),
    updateProgress: (requestId: number, checklistProgress: any[], notes?: string) =>
      apiRequest<any>(`/cert-requests/${requestId}/progress`, { method: 'PUT', body: JSON.stringify({ checklistProgress, notes }) }),
    complete: (requestId: number, trainerId: number) =>
      apiRequest<any>(`/cert-requests/${requestId}/complete`, { method: 'POST', body: JSON.stringify({ trainerId }) }),
    reject: (requestId: number, trainerId: number, notes?: string) =>
      apiRequest<any>(`/cert-requests/${requestId}/reject`, { method: 'POST', body: JSON.stringify({ trainerId, notes }) }),
  },
  calendar: {
    getAll: () => apiRequest<any[]>('/calendar'),
    create: (requesterId: number, data: any) =>
      apiRequest<any>('/calendar', { method: 'POST', body: JSON.stringify({ ...data, requesterId }) }),
    update: (id: number, requesterId: number, data: any) =>
      apiRequest<any>(`/calendar/${id}`, { method: 'PUT', body: JSON.stringify({ ...data, requesterId }) }),
    delete: (id: number, requesterId: number) =>
      apiRequest<void>(`/calendar/${id}?requesterId=${requesterId}`, { method: 'DELETE' }),
    patchDeletedDates: (id: number, requesterId: number, deletedDates: string[]) =>
      apiRequest<any>(`/calendar/${id}/deleted-dates`, { method: 'PATCH', body: JSON.stringify({ requesterId, deletedDates }) }),
    tbaPreview: (requesterId: number) =>
      apiRequest<any[]>(`/calendar/tba-preview?requesterId=${requesterId}`),
    tbaImport: (requesterId: number, events: any[]) =>
      apiRequest<{ created: number; skipped: number }>('/calendar/tba-import', { method: 'POST', body: JSON.stringify({ requesterId, events }) }),
  },
  resources: {
    getAll: (category?: string) =>
      apiRequest<any[]>(`/resources${category ? `?category=${encodeURIComponent(category)}` : ''}`),
    create: (requesterId: number, data: any) =>
      apiRequest<any>('/resources', { method: 'POST', body: JSON.stringify({ ...data, requesterId }) }),
    update: (id: number, requesterId: number, data: any) =>
      apiRequest<any>(`/resources/${id}`, { method: 'PUT', body: JSON.stringify({ ...data, requesterId }) }),
    delete: (id: number, requesterId: number) =>
      apiRequest<void>(`/resources/${id}?requesterId=${requesterId}`, { method: 'DELETE' }),
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
    checkOut: (id: number, userId: number, opts?: { taskHandoffNote?: string; markTaskComplete?: boolean }) =>
      apiRequest<any>(`/time-entries/${id}/check-out`, { method: 'POST', body: JSON.stringify({ userId, ...opts }) }),
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
    availableTasks: (userId: number) =>
      apiRequest<AvailableTask[]>(`/time-entries/available-tasks?userId=${userId}`),
    setWorkingOn: (id: number, userId: number, taskId?: number | null, generalTaskId?: number | null) =>
      apiRequest<Record<string, unknown>>(`/time-entries/${id}/set-working-on`, { method: 'PATCH', body: JSON.stringify({ userId, taskId, generalTaskId }) }),
  },
  generalTasks: {
    getAll: (includeArchived = false, requesterId?: number) =>
      apiRequest<GeneralTask[]>(`/general-tasks${includeArchived ? `?includeArchived=true&requesterId=${requesterId ?? ''}` : ''}`),
    create: (name: string, description: string, createdBy: number) =>
      apiRequest<GeneralTask>('/general-tasks', { method: 'POST', body: JSON.stringify({ name, description, createdBy }) }),
    update: (id: number, data: { name?: string; description?: string; active?: boolean }, updatedBy: number) =>
      apiRequest<GeneralTask>(`/general-tasks/${id}`, { method: 'PUT', body: JSON.stringify({ ...data, updatedBy }) }),
    delete: (id: number, deletedBy: number) =>
      apiRequest<void>(`/general-tasks/${id}`, { method: 'DELETE', body: JSON.stringify({ deletedBy }) }),
  },
};
