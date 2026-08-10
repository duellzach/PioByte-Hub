import { storage } from "../storage";
import { hasAnyRole, LEADERSHIP_ALL } from "../helpers";
import type { CalendarEvent } from "../../shared/schema";

/**
 * Invite-only events are hidden from everyone except: leadership (who need
 * to see everything to manage the team), the event's creator, and anyone
 * explicitly invited. A recurring event's virtual instances aren't separate
 * rows here — the parent row (or the specific overridden-date row) carries
 * `inviteOnly`/`createdBy`, and invites are keyed off the actual event id
 * (parent or override), not a per-instance id — so no special-casing is
 * needed beyond the normal event fields already on each row.
 */
export async function filterVisibleEvents<T extends CalendarEvent>(
  events: T[],
  userId: number,
  roles: string[],
): Promise<T[]> {
  if (hasAnyRole(roles, LEADERSHIP_ALL)) return events;

  const privateEvents = events.filter((e) => e.inviteOnly);
  if (privateEvents.length === 0) return events;

  const inviteeMap = await storage.getInviteeIdsForEvents(privateEvents.map((e) => e.id));

  return events.filter((e) => {
    if (!e.inviteOnly) return true;
    if (e.createdBy === userId) return true;
    const invitees = inviteeMap[e.id] || [];
    return invitees.includes(userId);
  });
}
