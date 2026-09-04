/**
 * Standalone tests for the certification level-gating and badge-award logic in
 * shared/certifications.ts. No test framework and no database required:
 *
 *   node_modules/.bin/tsx server/certifications.test.ts
 *
 * Exits non-zero on failure. The load-bearing case is "adding a cert to a
 * level someone already finished must not re-lock them" — that single rule is
 * why the gate reads recorded badges instead of recomputing completion.
 */
import assert from "node:assert/strict";
import {
  MAX_LEVEL,
  LEVELS,
  GENERAL,
  sameDepartment,
  levelBadgeLabel,
  certsInSet,
  isSetComplete,
  hasLevelBadge,
  isLevelUnlocked,
  highestUnlockedLevel,
  newlyEarnedLevelBadges,
  certificationTracks,
  normalizeLevel,
  normalizeDepartment,
  type LeveledCert,
  type EarnedLevelBadge,
} from "../shared/certifications";

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

const cert = (id: number, department: string | null, level: number): LeveledCert =>
  ({ id, department, level });

// Two department tracks plus a General track, so cross-track leakage shows up.
const CERTS: LeveledCert[] = [
  cert(1, "Manufacturing", 1),
  cert(2, "Manufacturing", 1),
  cert(3, "Manufacturing", 2),
  cert(4, "Manufacturing", 3),
  cert(5, "Software", 1),
  cert(6, "Software", 2),
  cert(7, GENERAL, 1),
];

const held = (...ids: number[]) => new Set<number>(ids);
const badge = (department: string | null, level: number): EarnedLevelBadge =>
  ({ department, level });

// --- shape ------------------------------------------------------------------

test("MAX_LEVEL is 3 and LEVELS enumerates it", () => {
  assert.equal(MAX_LEVEL, 3);
  assert.deepEqual(LEVELS, [1, 2, 3]);
});

test("General is null and is its own track, distinct from a named department", () => {
  assert.equal(GENERAL, null);
  assert.ok(sameDepartment(null, null));
  assert.ok(!sameDepartment(null, "Manufacturing"));
  assert.ok(!sameDepartment("", null), "empty string must not collide with General");
  assert.ok(sameDepartment("Manufacturing", "Manufacturing"));
});

test("levelBadgeLabel names General explicitly", () => {
  assert.equal(levelBadgeLabel("Manufacturing", 2), "Manufacturing Lvl 2");
  assert.equal(levelBadgeLabel(null, 1), "General Lvl 1");
});

test("certsInSet selects exactly one (department, level) set", () => {
  assert.deepEqual(certsInSet(CERTS, "Manufacturing", 1).map(c => c.id), [1, 2]);
  assert.deepEqual(certsInSet(CERTS, "Manufacturing", 2).map(c => c.id), [3]);
  assert.deepEqual(certsInSet(CERTS, GENERAL, 1).map(c => c.id), [7]);
  assert.deepEqual(certsInSet(CERTS, "Manufacturing", 3).map(c => c.id), [4]);
});

// --- completion -------------------------------------------------------------

test("a set is complete only when every cert in it is held", () => {
  assert.ok(!isSetComplete(CERTS, held(1), "Manufacturing", 1), "partial is not complete");
  assert.ok(isSetComplete(CERTS, held(1, 2), "Manufacturing", 1));
});

test("an EMPTY set is never complete, so it can't award a badge", () => {
  // Software has no Lvl 3 cert defined.
  assert.equal(certsInSet(CERTS, "Software", 3).length, 0);
  assert.ok(!isSetComplete(CERTS, held(5, 6), "Software", 3));
  assert.deepEqual(
    newlyEarnedLevelBadges(CERTS, held(5, 6), []).filter(b => b.level === 3),
    [],
    "no badge for a level with nothing in it",
  );
});

// --- gating -----------------------------------------------------------------

test("level 1 is always unlocked, even for a brand-new user", () => {
  assert.ok(isLevelUnlocked(CERTS, "Manufacturing", 1, []));
  assert.ok(isLevelUnlocked(CERTS, "Software", 1, []));
  assert.ok(isLevelUnlocked(CERTS, GENERAL, 1, []));
});

test("level 2 is locked until the level 1 badge is RECORDED", () => {
  // Holding every Lvl 1 cert is not enough on its own — the badge row is what
  // the gate reads, and it's written by the same grant that completes the set.
  assert.ok(!isLevelUnlocked(CERTS, "Manufacturing", 2, []));
  assert.ok(!isLevelUnlocked(CERTS, "Manufacturing", 2, [badge("Software", 1)]));
  assert.ok(isLevelUnlocked(CERTS, "Manufacturing", 2, [badge("Manufacturing", 1)]));
});

test("level 3 requires the level 2 badge, not just the level 1 badge", () => {
  assert.ok(!isLevelUnlocked(CERTS, "Manufacturing", 3, [badge("Manufacturing", 1)]));
  assert.ok(isLevelUnlocked(CERTS, "Manufacturing", 3, [
    badge("Manufacturing", 1),
    badge("Manufacturing", 2),
  ]));
});

test("REGRESSION: adding a cert to a finished level does not re-lock the next one", () => {
  // The student finished Manufacturing Lvl 1 (certs 1, 2) and earned the badge,
  // then started Lvl 2. A coach now adds cert 99 to Manufacturing Lvl 1.
  const earned = [badge("Manufacturing", 1)];
  const withNewCert = [...CERTS, cert(99, "Manufacturing", 1)];

  // They no longer hold every Lvl 1 cert...
  assert.ok(!isSetComplete(withNewCert, held(1, 2), "Manufacturing", 1));
  // ...but the recorded badge keeps Lvl 2 open. This is the whole design.
  assert.ok(isLevelUnlocked(withNewCert, "Manufacturing", 2, earned));
  // And the badge is never handed back or re-issued.
  assert.deepEqual(newlyEarnedLevelBadges(withNewCert, held(1, 2), earned), []);
});

test("an empty intermediate level does not block progression", () => {
  // Logistics has only a Lvl 3 cert: Lvl 1 and Lvl 2 are empty, so nothing can
  // be earned there and nothing may gate on them.
  const sparse = [cert(50, "Logistics", 3)];
  assert.ok(isLevelUnlocked(sparse, "Logistics", 2, []));
  assert.ok(isLevelUnlocked(sparse, "Logistics", 3, []), "a run of empty levels stays open");
});

test("a non-empty but incomplete previous level still blocks", () => {
  const earned: EarnedLevelBadge[] = [];
  assert.ok(!isLevelUnlocked(CERTS, "Manufacturing", 2, earned));
});

test("departments are independent tracks", () => {
  const earned = [badge("Manufacturing", 1)];
  assert.ok(isLevelUnlocked(CERTS, "Manufacturing", 2, earned));
  assert.ok(!isLevelUnlocked(CERTS, "Software", 2, earned), "Manufacturing must not unlock Software");
});

test("General is gated independently of every department", () => {
  const generalTrack = [cert(70, GENERAL, 1), cert(71, GENERAL, 2)];
  assert.ok(!isLevelUnlocked(generalTrack, GENERAL, 2, [badge("Manufacturing", 1)]));
  assert.ok(isLevelUnlocked(generalTrack, GENERAL, 2, [badge(GENERAL, 1)]));
});

test("highestUnlockedLevel walks the track", () => {
  assert.equal(highestUnlockedLevel(CERTS, "Manufacturing", []), 1);
  assert.equal(highestUnlockedLevel(CERTS, "Manufacturing", [badge("Manufacturing", 1)]), 2);
  assert.equal(
    highestUnlockedLevel(CERTS, "Manufacturing", [badge("Manufacturing", 1), badge("Manufacturing", 2)]),
    3,
  );
});

// --- award ------------------------------------------------------------------

test("newlyEarnedLevelBadges returns a badge the moment the last cert lands", () => {
  assert.deepEqual(newlyEarnedLevelBadges(CERTS, held(1), []), [], "partial earns nothing");
  assert.deepEqual(newlyEarnedLevelBadges(CERTS, held(1, 2), []), [
    { department: "Manufacturing", level: 1 },
  ]);
});

test("newlyEarnedLevelBadges is empty when everything is already recorded", () => {
  const earned = [badge("Manufacturing", 1)];
  assert.deepEqual(newlyEarnedLevelBadges(CERTS, held(1, 2), earned), []);
});

test("newlyEarnedLevelBadges can award several sets at once, without duplicates", () => {
  const result = newlyEarnedLevelBadges(CERTS, held(1, 2, 3, 5, 7), []);
  assert.deepEqual(result, [
    { department: "Manufacturing", level: 1 },
    { department: "Manufacturing", level: 2 },
    { department: "Software", level: 1 },
    { department: null, level: 1 },
  ]);
  // One entry per set even though Manufacturing Lvl 1 holds two certs.
  assert.equal(new Set(result.map(r => `${r.department} ${r.level}`)).size, result.length);
});

test("newlyEarnedLevelBadges only ever ADDS — there is no removal direction", () => {
  // Holding nothing, with a badge already recorded, must not propose undoing it.
  const earned = [badge("Manufacturing", 1)];
  const result = newlyEarnedLevelBadges(CERTS, held(), earned);
  assert.deepEqual(result, []);
});

// --- helpers ----------------------------------------------------------------

test("certificationTracks lists departments alphabetically with General last", () => {
  assert.deepEqual(certificationTracks(CERTS), ["Manufacturing", "Software", null]);
  assert.deepEqual(certificationTracks([cert(1, "Software", 1)]), ["Software"]);
  assert.deepEqual(certificationTracks([cert(1, GENERAL, 1)]), [null]);
  assert.deepEqual(certificationTracks([]), []);
});

test("normalizeLevel clamps into 1..MAX_LEVEL", () => {
  assert.equal(normalizeLevel(2), 2);
  assert.equal(normalizeLevel("3"), 3);
  assert.equal(normalizeLevel(0), 1);
  assert.equal(normalizeLevel(-5), 1);
  assert.equal(normalizeLevel(99), MAX_LEVEL);
  assert.equal(normalizeLevel("nonsense"), 1);
  assert.equal(normalizeLevel(undefined), 1);
  assert.equal(normalizeLevel(2.7), 2);
});

test("normalizeDepartment trims, and maps blank to General", () => {
  assert.equal(normalizeDepartment("Manufacturing"), "Manufacturing");
  assert.equal(normalizeDepartment("  Software  "), "Software");
  assert.equal(normalizeDepartment(""), null);
  assert.equal(normalizeDepartment("   "), null);
  assert.equal(normalizeDepartment(null), null);
  assert.equal(normalizeDepartment(undefined), null);
});

if (process.exitCode) {
  console.error(`\n${passed} passed, with failures.`);
} else {
  console.log(`\nAll ${passed} tests passed.`);
}
