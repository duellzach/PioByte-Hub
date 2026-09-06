import { Router } from "express";
import { getTeamProductivity, getUserProductivity, type Window } from "../services/productivity";
import { LEADERSHIP_ALL } from "../helpers";
import { requireRoles } from "../middleware/auth";

const router = Router();

/**
 * Both bounds are optional team-local YYYY-MM-DD dates, inclusive. Anything
 * that isn't a well-formed date is treated as absent rather than 400'd, so a
 * half-filled date picker degrades to a wider window instead of an error.
 */
function readWindow(query: Record<string, unknown>): Window {
  const parse = (v: unknown) => {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    // Shape alone isn't enough: "2026-13-99" matches the pattern but isn't a
    // date, and these bounds are compared as strings against real ledger dates,
    // so an impossible one would silently widen the window instead of failing.
    const [y, m, d] = v.split("-").map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    const roundTrips =
      probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
    return roundTrips ? v : null;
  };
  const start = parse(query.start);
  const end = parse(query.end);
  // A backwards window would silently return nothing; swap instead.
  if (start && end && start > end) return { start: end, end: start };
  return { start, end };
}

// Per-member contribution/hour rollup for the Team summary table.
router.get("/productivity/team", requireRoles(...LEADERSHIP_ALL), async (req, res) => {
  try {
    res.json(await getTeamProductivity(readWindow(req.query as Record<string, unknown>)));
  } catch (error) {
    console.error("Error computing team productivity:", error);
    res.status(500).json({ error: "Failed to compute team productivity" });
  }
});

// One member's deep dive. Leadership can open anyone's; everyone else, only
// their own — a student seeing their own numbers is the point of the page.
router.get("/productivity/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid user id" });
    const isLeadership = (req.userRoles || []).some((r) => LEADERSHIP_ALL.includes(r));
    if (id !== req.userId && !isLeadership) {
      return res.status(403).json({ error: "Not allowed" });
    }
    const result = await getUserProductivity(id, readWindow(req.query as Record<string, unknown>));
    if (!result) return res.status(404).json({ error: "User not found" });
    res.json(result);
  } catch (error) {
    console.error("Error computing user productivity:", error);
    res.status(500).json({ error: "Failed to compute user productivity" });
  }
});

export default router;
