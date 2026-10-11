export class AttendanceError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

export function attendanceMinutes(checkIn: Date | string, checkOut: Date | string): number {
  const duration = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (!Number.isFinite(duration) || duration < 0) throw new AttendanceError("Check-out must be at or after check-in", 400);
  return Math.ceil(Math.floor(duration / 60000) / 15) * 15;
}

export function resolvedSession(status: string): boolean {
  return status === "completed" || status === "rejected";
}

export function sameCompetition(a: {calendarEventId?: number | null; scoutEventId?: number | null}, b: {calendarEventId?: number | null; scoutEventId?: number | null}): boolean {
  return !!((a.calendarEventId && a.calendarEventId === b.calendarEventId) || (a.scoutEventId && a.scoutEventId === b.scoutEventId));
}

export function validReason(reason: unknown): string {
  if (typeof reason !== "string" || reason.trim().length < 8) throw new AttendanceError("Explain the attendance adjustment (at least 8 characters)", 400);
  return reason.trim().slice(0, 4000);
}
