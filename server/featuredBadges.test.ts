/**
 * Standalone tests for shared/featuredBadges.ts. No framework, no database:
 *
 *   node_modules/.bin/tsx server/featuredBadges.test.ts
 */
import assert from "node:assert/strict";
import { validateFeaturedBadgeIds, pickFeaturedBadges, MAX_FEATURED_BADGES } from "../shared/featuredBadges";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

const owned = [10, 11, 12, 13];

test("accepts up to three owned badges, deduped in order", () => {
  assert.deepEqual(validateFeaturedBadgeIds([12, 10, 12], owned), { ok: true, ids: [12, 10] });
  assert.deepEqual(validateFeaturedBadgeIds([], owned), { ok: true, ids: [] });
});

test("rejects a fourth badge", () => {
  const r = validateFeaturedBadgeIds([10, 11, 12, 13], owned);
  assert.equal(r.ok, false);
  assert.equal(MAX_FEATURED_BADGES, 3);
});

test("rejects badges the member doesn't hold", () => {
  assert.equal(validateFeaturedBadgeIds([10, 99], owned).ok, false);
});

test("rejects non-arrays and non-integers", () => {
  assert.equal(validateFeaturedBadgeIds("10", owned).ok, false);
  assert.equal(validateFeaturedBadgeIds(["abc"], owned).ok, false);
});

test("pickFeaturedBadges keeps chosen order and drops revoked ones", () => {
  const badges = [
    { id: 10, earnedAt: "2026-01-01" },
    { id: 11, earnedAt: "2026-03-01" },
    { id: 12, earnedAt: "2026-02-01" },
  ];
  assert.deepEqual(pickFeaturedBadges(badges, [12, 99, 10]).map(b => b.id), [12, 10]);
});

test("pickFeaturedBadges falls back to the most recent three", () => {
  const badges = [
    { id: 1, earnedAt: "2026-01-01" },
    { id: 2, earnedAt: "2026-04-01" },
    { id: 3, earnedAt: "2026-02-01" },
    { id: 4, earnedAt: "2026-03-01" },
  ];
  assert.deepEqual(pickFeaturedBadges(badges, []).map(b => b.id), [2, 4, 3]);
  assert.deepEqual(pickFeaturedBadges(badges, null).map(b => b.id), [2, 4, 3]);
});

if (process.exitCode) {
  console.error(`\n${passed} passed, with failures.`);
} else {
  console.log(`\nAll ${passed} tests passed.`);
}
