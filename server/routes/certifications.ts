import { Router } from "express";
import { storage } from "../storage";
import { requireRoles } from "../middleware/auth";
import { getUserRoles, hasAnyRole, COACH_CAPTAIN, COACH_CAPTAIN_TRAINER, TRAINER_COACH } from "../helpers";
import { trainerAuthority, scopeCovers, scopeDenial } from "../certScopes";
import {
  isLevelUnlocked,
  normalizeLevel,
  normalizeDepartment,
  MAX_LEVEL,
  type EarnedLevelBadge,
} from "../../shared/certifications";

const router = Router();

/**
 * Is this user allowed to START the given certification?
 *
 * Reads the user's RECORDED level badges rather than recomputing completion, so
 * a student already working at Lvl 2 is never re-locked when a coach adds a new
 * Lvl 1 certification. See shared/certifications.ts.
 */
async function levelGate(userId: number, cert: { department: string | null; level: number }) {
  const [allCerts, badges] = await Promise.all([
    storage.getCertifications(),
    storage.getUserBadges(userId),
  ]);
  const earned: EarnedLevelBadge[] = badges
    .filter((b: any) => b.kind === "level")
    .map((b: any) => ({ department: b.department, level: b.level }));
  const unlocked = isLevelUnlocked(allCerts as any[], cert.department, cert.level, earned);
  return {
    unlocked,
    reason: unlocked
      ? undefined
      : `Finish every ${cert.department ?? "General"} Level ${cert.level - 1} certification first.`,
  };
}

router.get("/certifications", async (req, res) => {
  try {
    const certs = await storage.getCertifications();
    res.json(certs);
  } catch (error) {
    console.error("Error fetching certifications:", error);
    res.status(500).json({ error: "Failed to fetch certifications" });
  }
});

/**
 * Everything the Certifications page needs to render lock state for one user:
 * which certs they hold, which level sets are unlocked, and their badges.
 * Server-computed because the gate is server-enforced — a client that derived
 * it independently would produce mystery 403s when the two drifted.
 */
router.get("/certifications/progress", async (req, res) => {
  try {
    const targetId = req.query.userId ? parseInt(req.query.userId as string) : req.userId!;
    if (targetId !== req.userId) {
      const actorRoles = await getUserRoles(req.userId!);
      if (!hasAnyRole(actorRoles, COACH_CAPTAIN_TRAINER)) {
        return res.status(403).json({ error: "You can only view your own certification progress" });
      }
    }
    const [allCerts, held, badges] = await Promise.all([
      storage.getCertifications(),
      storage.getUserCertifications(targetId),
      storage.getUserBadges(targetId),
    ]);
    const earned: EarnedLevelBadge[] = badges
      .filter((b: any) => b.kind === "level")
      .map((b: any) => ({ department: b.department, level: b.level }));
    const heldIds = new Set<number>(held.map((h: any) => h.certificationId));

    // One entry per (department, level) set that actually has certifications.
    const seen = new Set<string>();
    const levels: any[] = [];
    for (const c of allCerts as any[]) {
      const key = `${c.department ?? ""}::${c.level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const inSet = (allCerts as any[]).filter(
        (x: any) => (x.department ?? null) === (c.department ?? null) && x.level === c.level,
      );
      levels.push({
        department: c.department ?? null,
        level: c.level,
        total: inSet.length,
        heldCount: inSet.filter((x: any) => heldIds.has(x.id)).length,
        unlocked: isLevelUnlocked(allCerts as any[], c.department ?? null, c.level, earned),
        earned: earned.some(e => (e.department ?? null) === (c.department ?? null) && e.level === c.level),
      });
    }
    res.json({ userId: targetId, held: [...heldIds], levels, badges });
  } catch (error) {
    console.error("Error fetching certification progress:", error);
    res.status(500).json({ error: "Failed to fetch certification progress" });
  }
});

router.get("/certifications/:id", async (req, res) => {
  try {
    const cert = await storage.getCertification(parseInt(req.params.id));
    if (!cert) return res.status(404).json({ error: "Certification not found" });
    res.json(cert);
  } catch (error) {
    console.error("Error fetching certification:", error);
    res.status(500).json({ error: "Failed to fetch certification" });
  }
});

router.post("/certifications", async (req, res) => {
  try {
    const { name, equipment, description, safetyGuide, checklistItems, links, department, level, createdBy } = req.body;
    if (!name || !createdBy) {
      return res.status(400).json({ error: "name and createdBy are required" });
    }
    const actorRoles = await getUserRoles(parseInt(createdBy));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Team Captains can create certifications" });
    }
    const cert = await storage.createCertification({
      name,
      equipment: equipment || "",
      description: description || "",
      safetyGuide: safetyGuide || "",
      checklistItems: checklistItems || [],
      links: links || [],
      department: normalizeDepartment(department),
      level: normalizeLevel(level),
      createdBy: parseInt(createdBy),
    });
    res.status(201).json(cert);
  } catch (error) {
    console.error("Error creating certification:", error);
    res.status(500).json({ error: "Failed to create certification" });
  }
});

router.put("/certifications/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { requesterId, ...updateData } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Team Captains can update certifications" });
    }
    if (updateData.department !== undefined) updateData.department = normalizeDepartment(updateData.department);
    if (updateData.level !== undefined) updateData.level = normalizeLevel(updateData.level);
    const cert = await storage.updateCertification(id, updateData);
    if (!cert) return res.status(404).json({ error: "Certification not found" });
    res.json(cert);
  } catch (error) {
    console.error("Error updating certification:", error);
    res.status(500).json({ error: "Failed to update certification" });
  }
});

router.delete("/certifications/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const requesterId = parseInt(req.query.requesterId as string);
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(requesterId);
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Team Captains can delete certifications" });
    }
    await storage.deleteCertification(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting certification:", error);
    res.status(500).json({ error: "Failed to delete certification" });
  }
});

router.get("/certifications/:id/certified-users", async (req, res) => {
  try {
    const certifiedUsers = await storage.getCertifiedUsers(parseInt(req.params.id));
    res.json(certifiedUsers);
  } catch (error) {
    console.error("Error fetching certified users:", error);
    res.status(500).json({ error: "Failed to fetch certified users" });
  }
});

router.get("/certifications/:id/trainers", async (req, res) => {
  try {
    const trainers = await storage.getTrainersForCert(parseInt(req.params.id));
    res.json(trainers);
  } catch (error) {
    console.error("Error fetching trainers:", error);
    res.status(500).json({ error: "Failed to fetch trainers" });
  }
});

router.get("/users/:id/certifications", async (req, res) => {
  try {
    const certs = await storage.getUserCertifications(parseInt(req.params.id));
    res.json(certs);
  } catch (error) {
    console.error("Error fetching user certifications:", error);
    res.status(500).json({ error: "Failed to fetch user certifications" });
  }
});

router.post("/users/:id/certifications", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { certId, grantedBy } = req.body;
    if (!certId || !grantedBy) {
      return res.status(400).json({ error: "certId and grantedBy are required" });
    }
    const actorRoles = await getUserRoles(parseInt(grantedBy));
    if (!hasAnyRole(actorRoles, TRAINER_COACH)) {
      return res.status(403).json({ error: "Only Trainers or Coaches can grant certifications" });
    }
    const cert = await storage.getCertification(parseInt(certId));
    if (!cert) return res.status(404).json({ error: "Certification not found" });

    // Coaches bypass both the scope and the level gate — a direct coach grant
    // IS the override valve. Everyone else must be scoped for it, and the
    // recipient must have the level unlocked.
    const authority = await trainerAuthority(parseInt(grantedBy));
    if (!authority.bypass) {
      if (!scopeCovers(authority.scopes, cert)) {
        return res.status(403).json({ error: scopeDenial(cert) });
      }
      const gate = await levelGate(userId, cert);
      if (!gate.unlocked) return res.status(409).json({ error: gate.reason });
    }

    const result = await storage.grantCertificationWithBadges(userId, parseInt(certId), parseInt(grantedBy));
    res.status(201).json({ ...result.row, newBadges: result.newBadges });
  } catch (error) {
    console.error("Error granting certification:", error);
    res.status(500).json({ error: "Failed to grant certification" });
  }
});

router.delete("/users/:userId/certifications/:certId", async (req, res) => {
  try {
    const requesterId = parseInt(req.query.requesterId as string);
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(requesterId);
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Team Captains can revoke certifications" });
    }
    await storage.revokeCertification(parseInt(req.params.userId), parseInt(req.params.certId));
    res.status(204).send();
  } catch (error) {
    console.error("Error revoking certification:", error);
    res.status(500).json({ error: "Failed to revoke certification" });
  }
});

router.get("/cert-requests", async (req, res) => {
  try {
    // The actor is ALWAYS the session user. Previously this read `requesterId`
    // from the query and, when the client omitted it, fell through to a branch
    // that returned every pending request unscoped — which after scoping became
    // a leak: any signed-in student could read the whole trainer queue just by
    // dropping the parameter.
    const requesterId = req.userId!;
    const targetUserId = req.query.targetUserId ? parseInt(req.query.targetUserId as string) : undefined;
    const statusParam = req.query.statuses ? (req.query.statuses as string).split(",") : undefined;
    let filters: { userId?: number; statuses?: string[]; scope?: any };
    const actorRoles = await getUserRoles(requesterId);
    if (hasAnyRole(actorRoles, COACH_CAPTAIN_TRAINER)) {
      if (targetUserId) {
        filters = { userId: targetUserId, statuses: statusParam };
      } else {
        // The trainer queue: narrowed to the (department, level) sets this
        // trainer is scoped for, so a Mechanical Lvl 1 trainer never even
        // sees a Lvl 3 request.
        const authority = await trainerAuthority(requesterId);
        filters = { statuses: statusParam ?? ["pending", "in_progress"], scope: authority };
      }
    } else {
      // Everyone else sees only their own requests, whatever they asked for.
      filters = { userId: requesterId, statuses: statusParam };
    }
    const requests = await storage.getCertRequests(filters);
    res.json(requests);
  } catch (error) {
    console.error("Error fetching cert requests:", error);
    res.status(500).json({ error: "Failed to fetch certification requests" });
  }
});

router.post("/cert-requests", async (req, res) => {
  try {
    const { certId } = req.body;
    if (!certId) {
      return res.status(400).json({ error: "certId is required" });
    }
    // Students request for themselves; only Trainers/Coaches may file a request
    // on behalf of another user (otherwise the body `userId` is ignored).
    const actorRoles = await getUserRoles(req.userId!);
    const canActForOthers = hasAnyRole(actorRoles, TRAINER_COACH);
    const parsedUserId = canActForOthers && req.body.userId
      ? parseInt(req.body.userId)
      : req.userId!;
    const parsedCertId = parseInt(certId);
    const existingCerts = await storage.getUserCertifications(parsedUserId);
    if (existingCerts.some((c: any) => c.certificationId === parsedCertId)) {
      return res.status(409).json({ error: "User already holds this certification" });
    }
    const activeRequests = await storage.getCertRequests({ userId: parsedUserId, statuses: ['pending', 'in_progress'] });
    if (activeRequests.some((r: any) => r.certificationId === parsedCertId)) {
      return res.status(409).json({ error: "An active certification request already exists for this certification" });
    }
    // Sequential level gate. Enforced here rather than only in the UI, so a
    // hand-rolled request can't skip a level.
    const cert = await storage.getCertification(parsedCertId);
    if (!cert) return res.status(404).json({ error: "Certification not found" });
    const gate = await levelGate(parsedUserId, cert);
    if (!gate.unlocked) return res.status(409).json({ error: gate.reason });

    const request = await storage.createCertRequest(parsedUserId, parsedCertId);
    res.status(201).json(request);
  } catch (error) {
    console.error("Error creating cert request:", error);
    res.status(500).json({ error: "Failed to create certification request" });
  }
});

router.post("/cert-requests/:id/claim", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { trainerId } = req.body;
    if (!trainerId) return res.status(400).json({ error: "trainerId is required" });
    const actorRoles = await getUserRoles(parseInt(trainerId));
    if (!hasAnyRole(actorRoles, TRAINER_COACH)) {
      return res.status(403).json({ error: "Only Trainers or Coaches can claim certification requests" });
    }
    const denial = await denyIfOutOfScope(requestId, parseInt(trainerId));
    if (denial) return res.status(denial.status).json({ error: denial.error });

    const request = await storage.claimCertRequest(requestId, parseInt(trainerId));
    if (!request) return res.status(409).json({ error: "Request is no longer pending" });
    res.json(request);
  } catch (error) {
    console.error("Error claiming cert request:", error);
    res.status(500).json({ error: "Failed to claim certification request" });
  }
});

/**
 * Shared scope guard for the trainer actions. Returns a denial to send, or null
 * when the actor may proceed.
 */
async function denyIfOutOfScope(
  requestId: number,
  actorId: number,
): Promise<{ status: number; error: string } | null> {
  const request = await storage.getCertRequestDetail(requestId);
  if (!request) return { status: 404, error: "Request not found" };
  const authority = await trainerAuthority(actorId);
  if (authority.bypass) return null;
  const cert = { department: request.certDepartment ?? null, level: request.certLevel };
  if (!scopeCovers(authority.scopes, cert)) {
    return { status: 403, error: scopeDenial(cert) };
  }
  return null;
}

router.put("/cert-requests/:id/progress", requireRoles(...TRAINER_COACH), async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { checklistProgress, notes } = req.body;
    if (!checklistProgress) return res.status(400).json({ error: "checklistProgress is required" });
    const denial = await denyIfOutOfScope(requestId, req.userId!);
    if (denial) return res.status(denial.status).json({ error: denial.error });

    const request = await storage.updateCertRequestProgress(requestId, checklistProgress, notes);
    if (!request) return res.status(404).json({ error: "Request not found" });
    res.json(request);
  } catch (error) {
    console.error("Error updating cert request progress:", error);
    res.status(500).json({ error: "Failed to update certification request progress" });
  }
});

router.post("/cert-requests/:id/complete", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { trainerId } = req.body;
    if (!trainerId) return res.status(400).json({ error: "trainerId is required" });
    const actorRoles = await getUserRoles(parseInt(trainerId));
    if (!hasAnyRole(actorRoles, TRAINER_COACH)) {
      return res.status(403).json({ error: "Only Trainers or Coaches can complete certification requests" });
    }
    const denial = await denyIfOutOfScope(requestId, parseInt(trainerId));
    if (denial) return res.status(denial.status).json({ error: denial.error });

    // Re-check the level gate at completion: the request may have been filed
    // before a coach reshuffled the levels, and this is where the certification
    // actually lands, so it's the last honest place to stop it.
    const request = await storage.getCertRequestDetail(requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    const gate = await levelGate(request.userId, {
      department: request.certDepartment ?? null,
      level: request.certLevel,
    });
    if (!gate.unlocked) return res.status(409).json({ error: gate.reason });

    const completed = await storage.completeCertRequest(requestId, parseInt(trainerId));
    if (!completed) return res.status(404).json({ error: "Request not found" });
    res.json(completed);
  } catch (error) {
    console.error("Error completing cert request:", error);
    res.status(500).json({ error: "Failed to complete certification request" });
  }
});

router.post("/cert-requests/:id/reject", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { trainerId, notes } = req.body;
    if (!trainerId) return res.status(400).json({ error: "trainerId is required" });
    const actorRoles = await getUserRoles(parseInt(trainerId));
    if (!hasAnyRole(actorRoles, TRAINER_COACH)) {
      return res.status(403).json({ error: "Only Trainers or Coaches can reject certification requests" });
    }
    const denial = await denyIfOutOfScope(requestId, parseInt(trainerId));
    if (denial) return res.status(denial.status).json({ error: denial.error });

    const request = await storage.rejectCertRequest(requestId, parseInt(trainerId), notes);
    if (!request) return res.status(404).json({ error: "Request not found" });
    res.json(request);
  } catch (error) {
    console.error("Error rejecting cert request:", error);
    res.status(500).json({ error: "Failed to reject certification request" });
  }
});

// --- Trainer scopes ---------------------------------------------------------

router.get("/trainer-scopes", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const scopes = await storage.getTrainerScopesWithUsers();
    res.json(scopes);
  } catch (error) {
    console.error("Error fetching trainer scopes:", error);
    res.status(500).json({ error: "Failed to fetch trainer scopes" });
  }
});

router.get("/users/:id/trainer-scopes", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    if (targetId !== req.userId) {
      const actorRoles = await getUserRoles(req.userId!);
      if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
        return res.status(403).json({ error: "You can only view your own training scopes" });
      }
    }
    const scopes = await storage.getTrainerScopes(targetId);
    res.json(scopes);
  } catch (error) {
    console.error("Error fetching trainer scopes:", error);
    res.status(500).json({ error: "Failed to fetch trainer scopes" });
  }
});

/** Replace a user's entire scope set. Coach/Captain only. */
router.put("/users/:id/trainer-scopes", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const { scopes } = req.body;
    if (!Array.isArray(scopes)) return res.status(400).json({ error: "scopes must be an array" });

    const settings = await storage.getTeamSettings();
    const validDepts = new Set((settings.departments as { name: string }[]).map(d => d.name));
    const seen = new Set<string>();
    const cleaned: { department: string | null; maxLevel: number }[] = [];
    for (const raw of scopes) {
      const department = normalizeDepartment(raw?.department);
      if (department !== null && !validDepts.has(department)) {
        return res.status(400).json({ error: `"${department}" is not a department` });
      }
      const key = department ?? "";
      if (seen.has(key)) {
        return res.status(400).json({ error: `Duplicate scope for ${department ?? "General"}` });
      }
      seen.add(key);
      const maxLevel = normalizeLevel(raw?.maxLevel);
      if (maxLevel < 1 || maxLevel > MAX_LEVEL) {
        return res.status(400).json({ error: `Level must be between 1 and ${MAX_LEVEL}` });
      }
      cleaned.push({ department, maxLevel });
    }
    const saved = await storage.setTrainerScopes(targetId, cleaned, req.userId!);
    res.json(saved);
  } catch (error) {
    console.error("Error saving trainer scopes:", error);
    res.status(500).json({ error: "Failed to save trainer scopes" });
  }
});

export default router;
