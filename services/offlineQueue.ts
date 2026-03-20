const QUEUE_KEY = 'piobyte_offline_match_queue';

export interface OfflineMatchEntry {
  id: string;
  eventId: number;
  data: Record<string, unknown>;
  timestamp: number;
}

export function getOfflineQueue(): OfflineMatchEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToOfflineQueue(entry: Omit<OfflineMatchEntry, 'id' | 'timestamp'>): void {
  const queue = getOfflineQueue();
  queue.push({
    ...entry,
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue().filter(e => e.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export async function syncOfflineQueue(
  apiCall: (eventId: number, data: any) => Promise<any>
): Promise<{ synced: number; failed: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      await apiCall(entry.eventId, entry.data);
      removeFromOfflineQueue(entry.id);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
