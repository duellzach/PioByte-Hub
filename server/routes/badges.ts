import { Router } from "express";
import { storage } from "../storage";
import { requireRoles } from "../middleware/auth";
import { COACH_CAPTAIN } from "../helpers";
import { isBadgeIconKey, isBadgeColor } from "../../shared/badgeIcons";

const router = Router();

// Badges are visible to everyone in the Hub — the reads below are session-only.
// Only the write paths are Coach/Captain gated.

router.get("/badge-definitions", async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const definitions = await storage.getBadgeDefinitions(includeArchived);
    res.json(definitions);
  } catch (error) {
    console.error("Error fetching badge definitions:", error);
    res.status(500).json({ error: "Failed to fetch badge definitions" });
  }
});

router.post("/badge-definitions", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    // `color` is written straight into a style attribute, so validate the shape
    // rather than trusting the picker to be the only caller.
    if (icon && !isBadgeIconKey(icon)) return res.status(400).json({ error: "Unknown badge icon" });
    if (color && !isBadgeColor(color)) return res.status(400).json({ error: "Color must be a #rrggbb hex value" });

    const definition = await storage.createBadgeDefinition({
      name: name.trim(),
      description: (description || "").trim(),
      icon: icon || "award",
      color: color || "#dc2626",
      createdBy: req.userId!,
    });
    res.status(201).json(definition);
  } catch (error) {
    console.error("Error creating badge definition:", error);
    res.status(500).json({ error: "Failed to create badge definition" });
  }
});

router.put("/badge-definitions/:id", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, icon, color, archived } = req.body;
    if (icon !== undefined && !isBadgeIconKey(icon)) return res.status(400).json({ error: "Unknown badge icon" });
    if (color !== undefined && !isBadgeColor(color)) return res.status(400).json({ error: "Color must be a #rrggbb hex value" });

    // Explicit allowlist rather than spreading the body, matching the other
    // update routes in this codebase.
    const fields: Record<string, any> = {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "Name is required" });
      fields.name = name.trim();
    }
    if (description !== undefined) fields.description = description.trim();
    if (icon !== undefined) fields.icon = icon;
    if (color !== undefined) fields.color = color;
    if (archived !== undefined) fields.archived = !!archived;

    const definition = await storage.updateBadgeDefinition(id, fields);
    if (!definition) return res.status(404).json({ error: "Badge not found" });
    res.json(definition);
  } catch (error) {
    console.error("Error updating badge definition:", error);
    res.status(500).json({ error: "Failed to update badge definition" });
  }
});

/** Archives rather than deletes, so already-awarded badges never dangle. */
router.delete("/badge-definitions/:id", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    await storage.deleteBadgeDefinition(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting badge definition:", error);
    res.status(500).json({ error: "Failed to delete badge definition" });
  }
});

/**
 * Every user's badges at once, keyed by user id. The team page renders a chip
 * row on every member card, so one call beats one call per card.
 */
router.get("/badges", async (req, res) => {
  try {
    const all = await storage.getUserBadges();
    const byUser: Record<number, any[]> = {};
    for (const badge of all) {
      (byUser[badge.userId] ||= []).push(badge);
    }
    res.json(byUser);
  } catch (error) {
    console.error("Error fetching badges:", error);
    res.status(500).json({ error: "Failed to fetch badges" });
  }
});

router.get("/users/:id/badges", async (req, res) => {
  try {
    const badges = await storage.getUserBadges(parseInt(req.params.id));
    res.json(badges);
  } catch (error) {
    console.error("Error fetching user badges:", error);
    res.status(500).json({ error: "Failed to fetch user badges" });
  }
});

/**
 * Award a CUSTOM badge by hand. Level badges are earned by completing a level
 * and are never hand-awarded, so this route only accepts a definition id.
 */
router.post("/users/:id/badges", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { badgeDefinitionId, note } = req.body;
    if (!badgeDefinitionId) return res.status(400).json({ error: "badgeDefinitionId is required" });

    const definitions = await storage.getBadgeDefinitions(true);
    const definition = definitions.find(d => d.id === parseInt(badgeDefinitionId));
    if (!definition) return res.status(404).json({ error: "Badge not found" });
    if (definition.archived) return res.status(409).json({ error: "That badge has been archived" });

    const badge = await storage.awardCustomBadge(userId, definition.id, req.userId!, note);
    res.status(201).json(badge);
  } catch (error) {
    console.error("Error awarding badge:", error);
    res.status(500).json({ error: "Failed to award badge" });
  }
});

/**
 * Revoke one awarded badge. Works for level badges too: a coach may need to
 * correct one, and level badges are otherwise only removed automatically when
 * the underlying certification is revoked.
 */
router.delete("/users/:userId/badges/:badgeId", requireRoles(...COACH_CAPTAIN), async (req, res) => {
  try {
    await storage.revokeBadge(parseInt(req.params.userId), parseInt(req.params.badgeId));
    res.status(204).send();
  } catch (error) {
    console.error("Error revoking badge:", error);
    res.status(500).json({ error: "Failed to revoke badge" });
  }
});

export default router;
