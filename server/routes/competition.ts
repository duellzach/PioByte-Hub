import { Router } from "express";
import { storage } from "../storage";
import { requireRoles } from "../middleware/auth";
import { COACH_CAPTAIN, hasAnyRole } from "../helpers";
import { AttendanceError, changeCompetitionSession } from "../services/competitionSessions";

const router = Router();

// Competition attendance is stored on the shared clock (time_entries, kind =
// "competition", scoutEventId set) — see storage.ensureCompetitionUnification
// for why. These routes translate between that internal shape and the
// competition-specific vocabulary the client already speaks, so the URLs and
// response shape below are the external API contract and stay stable even
// though the storage underneath changed.
//
// Internal time_entries.status -> external competition status:
//   checked_in        -> checked_in
//   pending_check_out  -> pending_approval
//   completed          -> approved
//   rejected           -> rejected
const toExternalStatus = (status: string): string => {
  if (status === "pending_check_out") return "pending_approval";
  if (status === "completed") return "approved";
  return status;
};

// checkOutConfirmedBy/At double as "who approved/rejected this, and when" for
// competition rows — the shop clock's "coach confirmed the checkout" concept
// maps directly onto "coach approved/rejected the competition attendance".
function toApi(e: any) {
  return {
    id: e.id,
    userId: e.userId,
    eventId: e.scoutEventId,
    checkInAt: e.checkInAt,
    checkOutAt: e.checkOutAt,
    status: toExternalStatus(e.status),
    approvedBy: e.checkOutConfirmedBy ?? null,
    approvedAt: e.checkOutConfirmedAt ?? null,
    roundedMinutes: e.roundedMinutes,
    notes: e.notes,
    createdAt: e.createdAt,
  };
}

router.get("/competition-checkins", async (req, res) => {
  try {
    const { eventId, userId } = req.query;
    let entries: any[];
    if (eventId) {
      entries = await storage.getTimeEntriesByScoutEvent(parseInt(eventId as string));
    } else if (userId) {
      entries = await storage.getTimeEntriesByUserAndKind(parseInt(userId as string), "competition");
    } else {
      return res.status(400).json({ error: "eventId or userId query param required" });
    }
    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u: any) => [u.id, u.name || u.username]));
    const enriched = entries.map((e) => {
      const api = toApi(e);
      if (eventId) api.eventId = parseInt(eventId as string);
      return {
        ...api,
        userName: userMap.get(e.userId) || `User ${e.userId}`,
        approvedByName: api.approvedBy ? (userMap.get(api.approvedBy) || `User ${api.approvedBy}`) : null,
      };
    });
    res.json(enriched);
  } catch (error) {
    console.error("Error fetching competition checkins:", error);
    res.status(500).json({ error: "Failed to fetch competition checkins" });
  }
});

// Scouting-event check-in is retired: competitions are calendar events now,
// and attendance is clocked against them from the Time Clock (which records
// the same shared competition session). Existing scouting-event sessions can
// still be checked out, approved, rejected, edited and audited below.
export const SCOUT_CHECKIN_RETIRED = "Scouting-event check-in is retired — check in to the competition's calendar event from the Time Clock.";

router.post("/competition-checkins/check-in", async (_req, res) => {
  res.status(410).json({ error: SCOUT_CHECKIN_RETIRED });
});

router.post("/competition-checkins/:id/check-out", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const prev = await storage.getTimeEntry(id);
    if (!prev) return res.status(404).json({ error: "Checkin not found" });
    if (prev.userId !== req.userId && !hasAnyRole(req.userRoles || [], COACH_CAPTAIN)) return res.status(403).json({error: "You can only check yourself out"});
    const updated = await changeCompetitionSession(id, req.userId!, "checkout");
    res.json(toApi(updated!));
  } catch (error) {
    if (error instanceof AttendanceError) return res.status(error.status).json({error: error.message});
    console.error("Error checking out from competition:", error);
    res.status(500).json({ error: "Failed to check out" });
  }
});

router.post("/competition-checkins/:id/approve", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { roundedMinutes, reason } = req.body;
    const coachId = req.userId!;
    const prev = await storage.getTimeEntry(id);
    if (!prev) return res.status(404).json({ error: "Checkin not found" });
    const updated = await changeCompetitionSession(id, coachId, "approve", {roundedMinutes: roundedMinutes != null ? Number(roundedMinutes) : undefined, reason});
    res.json(toApi(updated!));
  } catch (error) {
    if (error instanceof AttendanceError) return res.status(error.status).json({error: error.message});
    console.error("Error approving competition checkin:", error);
    res.status(500).json({ error: "Failed to approve checkin" });
  }
});

router.post("/competition-checkins/:id/reject", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const coachId = req.userId!;
    const prev = await storage.getTimeEntry(id);
    if (!prev) return res.status(404).json({ error: "Checkin not found" });
    const updated = await changeCompetitionSession(id, coachId, "reject");
    res.json(toApi(updated!));
  } catch (error) {
    if (error instanceof AttendanceError) return res.status(error.status).json({error: error.message});
    console.error("Error rejecting competition checkin:", error);
    res.status(500).json({ error: "Failed to reject checkin" });
  }
});

// Retired with scouting-event check-in: new competition credit goes on the
// calendar event (Coach Tools → Bulk Add Time, or the event roster).
router.post("/competition-checkins/manual-add", requireRoles(...COACH_CAPTAIN), async (_req, res) => {
  res.status(410).json({ error: SCOUT_CHECKIN_RETIRED });
});

router.get("/competition-checkins/:id/audit", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const logs = await storage.getTimeEntryAudit(id);
    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map((u: any) => [u.id, u.name || u.username]));
    const enriched = logs.map((l) => ({ ...l, actorName: userMap.get(l.actorId) || `User ${l.actorId}` }));
    res.json(enriched);
  } catch (error) {
    console.error("Error fetching competition checkin audit:", error);
    res.status(500).json({ error: "Failed to fetch audit" });
  }
});

router.put("/competition-checkins/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { actorId, ...data } = req.body;
    if (!actorId) return res.status(400).json({ error: "actorId is required" });
    if (parseInt(actorId) !== req.userId) return res.status(403).json({error: "Actor must be the signed-in member"});
    const actorRoles = req.userRoles || [];
    const existing = await storage.getTimeEntry(id);
    if (!existing) return res.status(404).json({ error: "Checkin not found" });
    const isCoachOrCaptain = hasAnyRole(actorRoles, COACH_CAPTAIN);
    const ownsRecord = existing.userId === parseInt(actorId);
    if (!isCoachOrCaptain && !ownsRecord) {
      return res.status(403).json({ error: "Not authorized to update this checkin" });
    }
    // Only `notes` is editable through this route — every real state
    // transition (check-out, approve, reject, correct hours) has its own
    // dedicated, role-guarded endpoint below. Forwarding the body unfiltered
    // used to let a record's owner (a plain student, via ownsRecord above)
    // rewrite status/roundedMinutes/checkInAt directly, which both
    // self-awards hours into the ledger and — via checkInAt — is what caused
    // duplicate rows on every republish (see ensureCompetitionUnification).
    const patch: Record<string, unknown> = {};
    if (typeof data.notes === "string") patch.notes = data.notes;
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "Nothing to update — only `notes` is editable here" });
    }
    const updated = await storage.updateTimeEntry(id, patch as any);
    await storage.createTimeEntryAudit({
      entryId: id,
      actorId: parseInt(actorId),
      actionType: "update",
      previousValues: { status: existing.status, notes: existing.notes },
      newValues: patch,
    });
    res.json(toApi(updated!));
  } catch (error) {
    console.error("Error updating competition checkin:", error);
    res.status(500).json({ error: "Failed to update checkin" });
  }
});

router.delete("/competition-checkins/:id", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await storage.getTimeEntry(id);
    if ((await storage.getTimeEntryAudit(id)).some(a => a.actionType === "first_chance_correction")) throw new AttendanceError("Reviewed FIRST Chance history must be preserved");
    await storage.createTimeEntryAudit({
      entryId: id,
      actorId: req.userId!,
      actionType: "delete",
      previousValues: existing ? { status: existing.status, userId: existing.userId, roundedMinutes: existing.roundedMinutes } : undefined,
    });
    await storage.deleteTimeEntry(id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof AttendanceError) return res.status(error.status).json({error: error.message});
    console.error("Error deleting competition checkin:", error);
    res.status(500).json({ error: "Failed to delete checkin" });
  }
});

export default router;
