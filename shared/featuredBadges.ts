// A member picks up to three of their own badges to show first on their card.
// Shared so the client's picker and the server's check agree on the cap.

export const MAX_FEATURED_BADGES = 3;

/**
 * Validate a requested featured list against the badge ids the member holds.
 * Returns the cleaned list (deduped, order kept) or an error message.
 */
export function validateFeaturedBadgeIds(
  requested: unknown,
  ownedIds: readonly number[],
): { ok: true; ids: number[] } | { ok: false; error: string } {
  if (!Array.isArray(requested)) return { ok: false, error: "badgeIds must be an array" };
  const ids: number[] = [];
  for (const raw of requested) {
    const id = typeof raw === "number" ? raw : parseInt(String(raw));
    if (!Number.isInteger(id)) return { ok: false, error: "badgeIds must be integers" };
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length > MAX_FEATURED_BADGES) {
    return { ok: false, error: `You can feature at most ${MAX_FEATURED_BADGES} badges` };
  }
  const owned = new Set(ownedIds);
  if (ids.some((id) => !owned.has(id))) return { ok: false, error: "You can only feature badges you have earned" };
  return { ok: true, ids };
}

/**
 * The badges to show first: the chosen ones that still exist (a revoked badge
 * simply drops out), else the most recent few.
 */
export function pickFeaturedBadges<T extends { id: number | string; earnedAt?: string | Date | null }>(
  badges: readonly T[],
  featuredIds: readonly number[] | null | undefined,
): T[] {
  const chosen = (featuredIds || [])
    .map((id) => badges.find((b) => Number(b.id) === id))
    .filter((b): b is T => !!b);
  if (chosen.length > 0) return chosen.slice(0, MAX_FEATURED_BADGES);
  return [...badges]
    .sort((a, b) => new Date(b.earnedAt ?? 0).getTime() - new Date(a.earnedAt ?? 0).getTime())
    .slice(0, MAX_FEATURED_BADGES);
}
