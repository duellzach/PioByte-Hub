import { Router } from "express";
import { storage } from "../storage";
import { requireRoles } from "../middleware/auth";
import { getUserRoles, hasAnyRole, COACH_CAPTAIN, COACH_CAPTAIN_TRAINER, TRAINER_COACH } from "../helpers";

const router = Router();

router.get("/certifications", async (req, res) => {
  try {
    const certs = await storage.getCertifications();
    res.json(certs);
  } catch (error) {
    console.error("Error fetching certifications:", error);
    res.status(500).json({ error: "Failed to fetch certifications" });
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
    const { name, equipment, description, safetyGuide, checklistItems, createdBy } = req.body;
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
      return res.status(403).json({ error: "Only Safety Trainers or Coaches can grant certifications" });
    }
    const result = await storage.grantCertification(userId, parseInt(certId), parseInt(grantedBy));
    res.status(201).json(result);
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
    const requesterId = req.query.requesterId ? parseInt(req.query.requesterId as string) : undefined;
    const targetUserId = req.query.targetUserId ? parseInt(req.query.targetUserId as string) : undefined;
    const statusParam = req.query.statuses ? (req.query.statuses as string).split(",") : undefined;
    let filters: { userId?: number; statuses?: string[] };
    if (requesterId) {
      const actorRoles = await getUserRoles(requesterId);
      if (hasAnyRole(actorRoles, COACH_CAPTAIN_TRAINER)) {
        if (targetUserId) {
          filters = { userId: targetUserId, statuses: statusParam };
        } else {
          filters = { statuses: statusParam ?? ['pending', 'in_progress'] };
        }
      } else {
        filters = { userId: requesterId, statuses: statusParam };
      }
    } else {
      filters = { statuses: ['pending', 'in_progress'] };
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
      return res.status(403).json({ error: "Only Safety Trainers or Coaches can claim certification requests" });
    }
    const request = await storage.claimCertRequest(requestId, parseInt(trainerId));
    if (!request) return res.status(409).json({ error: "Request is no longer pending" });
    res.json(request);
  } catch (error) {
    console.error("Error claiming cert request:", error);
    res.status(500).json({ error: "Failed to claim certification request" });
  }
});

router.put("/cert-requests/:id/progress", requireRoles(...TRAINER_COACH), async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { checklistProgress, notes } = req.body;
    if (!checklistProgress) return res.status(400).json({ error: "checklistProgress is required" });
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
      return res.status(403).json({ error: "Only Safety Trainers or Coaches can complete certification requests" });
    }
    const request = await storage.completeCertRequest(requestId, parseInt(trainerId));
    if (!request) return res.status(404).json({ error: "Request not found" });
    res.json(request);
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
      return res.status(403).json({ error: "Only Safety Trainers or Coaches can reject certification requests" });
    }
    const request = await storage.rejectCertRequest(requestId, parseInt(trainerId), notes);
    if (!request) return res.status(404).json({ error: "Request not found" });
    res.json(request);
  } catch (error) {
    console.error("Error rejecting cert request:", error);
    res.status(500).json({ error: "Failed to reject certification request" });
  }
});

export default router;
