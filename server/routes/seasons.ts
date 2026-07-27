import { Router } from "express";
import { storage } from "../storage";
import { requireRoles } from "../middleware/auth";
import { validateTemplateFields, type ScoutKind, type TemplateField } from "../../shared/scoutingTemplates";

const router = Router();

// Writes are restricted to leadership; reads are available to any authed user
// (guest read access is added in the auth middleware for view rendering).
const canManage = requireRoles("Coach", "Team Captain");

function isKind(k: any): k is ScoutKind {
  return k === "pit" || k === "match";
}

// --- Seasons ---

router.get("/seasons", async (_req, res) => {
  try {
    res.json(await storage.getSeasons());
  } catch (e) {
    console.error("Error fetching seasons:", e);
    res.status(500).json({ error: "Failed to fetch seasons" });
  }
});

router.post("/seasons", canManage, async (req, res) => {
  try {
    const { name, gameName, year, active } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Season name is required" });
    const season = await storage.createSeason({ name: String(name).trim(), gameName, year, active });
    res.status(201).json(season);
  } catch (e) {
    console.error("Error creating season:", e);
    res.status(500).json({ error: "Failed to create season" });
  }
});

router.put("/seasons/:id", canManage, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const season = await storage.updateSeason(id, req.body || {});
    if (!season) return res.status(404).json({ error: "Season not found" });
    res.json(season);
  } catch (e) {
    console.error("Error updating season:", e);
    res.status(500).json({ error: "Failed to update season" });
  }
});

router.delete("/seasons/:id", canManage, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await storage.deleteSeason(id);
    if (!result.ok) return res.status(409).json({ error: result.reason });
    res.status(204).send();
  } catch (e) {
    console.error("Error deleting season:", e);
    res.status(500).json({ error: "Failed to delete season" });
  }
});

// --- Templates ---

router.get("/seasons/:id/templates", async (req, res) => {
  try {
    const seasonId = parseInt(req.params.id);
    const kind = req.query.kind;
    if (kind !== undefined) {
      if (!isKind(kind)) return res.status(400).json({ error: "kind must be 'pit' or 'match'" });
      const tpl = await storage.getTemplate(seasonId, kind);
      return res.json(tpl ?? null);
    }
    res.json(await storage.getTemplatesForSeason(seasonId));
  } catch (e) {
    console.error("Error fetching templates:", e);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Create the template for a (season, kind). 409 if one already exists — edits
// go through PUT /templates/:id.
router.post("/seasons/:id/templates", canManage, async (req, res) => {
  try {
    const seasonId = parseInt(req.params.id);
    const { kind, name, fields } = req.body || {};
    if (!isKind(kind)) return res.status(400).json({ error: "kind must be 'pit' or 'match'" });
    const existing = await storage.getTemplate(seasonId, kind);
    if (existing) return res.status(409).json({ error: `A ${kind} template already exists for this season` });
    const check = validateTemplateFields(kind, fields as TemplateField[]);
    if (!check.ok) return res.status(400).json({ error: check.error });
    const tpl = await storage.createTemplate({ seasonId, kind, name, fields, createdBy: req.userId ?? null });
    res.status(201).json(tpl);
  } catch (e) {
    console.error("Error creating template:", e);
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.put("/templates/:id", canManage, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const current = await storage.getTemplateById(id);
    if (!current) return res.status(404).json({ error: "Template not found" });
    const { name, fields } = req.body || {};
    if (fields !== undefined) {
      const check = validateTemplateFields(current.kind as ScoutKind, fields as TemplateField[], current.fields as TemplateField[]);
      if (!check.ok) return res.status(400).json({ error: check.error });
    }
    const tpl = await storage.updateTemplate(id, { name, fields });
    res.json(tpl);
  } catch (e) {
    console.error("Error updating template:", e);
    res.status(500).json({ error: "Failed to update template" });
  }
});

export default router;
