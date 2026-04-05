import { Router } from "express";
import { storage } from "../storage";
import { getUserRoles, hasAnyRole, COACH_CAPTAIN } from "../helpers";

const router = Router();

const DEFAULT_DEPARTMENTS = [
  { name: 'Mechanical', color: '#f97316' },
  { name: 'Software', color: '#3b82f6' },
  { name: 'Modeling', color: '#8b5cf6' },
  { name: 'Logistics', color: '#22c55e' },
  { name: 'Electrical', color: '#eab308' },
  { name: 'Business', color: '#14b8a6' },
  { name: 'Leadership', color: '#ef4444' },
];

const DEFAULT_ROLES = [
  { name: 'Coach', tier: 'leadership' },
  { name: 'Team Captain', tier: 'leadership' },
  { name: 'SCRUM Master', tier: 'leadership' },
  { name: 'Department Head', tier: 'lead' },
  { name: 'Safety Trainer', tier: 'lead' },
  { name: 'Team Member', tier: 'member' },
  { name: 'Class Member', tier: 'member' },
];

router.get("/settings", async (req, res) => {
  try {
    const settings = await storage.getTeamSettings();
    res.json(settings);
  } catch (error) {
    console.error("Error fetching team settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const { requesterId, ...data } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Captains can modify team settings" });
    }
    const settings = await storage.upsertTeamSettings(data);
    res.json(settings);
  } catch (error) {
    console.error("Error updating team settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.post("/settings/reset", async (req, res) => {
  try {
    const { requesterId } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Captains can reset team settings" });
    }
    const settings = await storage.upsertTeamSettings({
      teamNumber: 10991,
      teamName: 'piobyte',
      themeColor: '#dc2626',
      logoUrl: null,
      departments: DEFAULT_DEPARTMENTS,
      roles: DEFAULT_ROLES,
    });
    res.json(settings);
  } catch (error) {
    console.error("Error resetting team settings:", error);
    res.status(500).json({ error: "Failed to reset settings" });
  }
});

router.get("/settings/tba-logo", async (req, res) => {
  try {
    const teamNum = req.query.team as string;
    if (!teamNum) return res.status(400).json({ error: "team query param required" });

    const apiKey = process.env.TBA_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "TBA_API_KEY not configured" });

    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear + 1];

    for (const year of years) {
      const url = `https://www.thebluealliance.com/api/v3/team/frc${teamNum}/media/${year}`;
      const response = await fetch(url, {
        headers: { "X-TBA-Auth-Key": apiKey },
      });
      if (!response.ok) continue;
      const media: any[] = await response.json();
      const avatar = media.find((m: any) => m.type === 'avatar' && m.details?.base64Image);
      if (avatar) {
        return res.json({ logoUrl: `data:image/png;base64,${avatar.details.base64Image}` });
      }
    }

    res.json({ logoUrl: null });
  } catch (error) {
    console.error("Error fetching TBA logo:", error);
    res.status(500).json({ error: "Failed to fetch TBA logo" });
  }
});

export default router;
