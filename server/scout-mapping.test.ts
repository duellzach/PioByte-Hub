/**
 * Standalone test for the legacy-column <-> `data`-blob mapping that the
 * seasons/templates migration, dual-write, and QR v3 import all depend on.
 * No test framework required — run with:
 *
 *   node_modules/.bin/tsx server/scout-mapping.test.ts
 *
 * Exits non-zero on failure. This is the go/no-go guard for D1: the mapping
 * must be a lossless round-trip so backfilling `data` never loses a column.
 */
import assert from "node:assert/strict";
import {
  dataFromLegacyRow,
  legacyColumnsFromData,
  validateTemplateFields,
  keyFromLabel,
  BUILTIN_TEMPLATES,
  type ScoutKind,
  type TemplateField,
} from "../shared/scoutingTemplates";

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

// A fixture legacy row with every column populated with a distinct value so a
// dropped or mis-mapped column is detectable.
const PIT_ROW: Record<string, any> = {
  id: 1, eventId: 7, scoutedBy: 3, createdAt: new Date(), updatedAt: new Date(),
  teamNumber: 10991, teamName: "PioByte", robotName: "Byte", drivetrain: "Swerve",
  weight: 120, speed: 14, height: 30, fuelCapacity: 40, traversalAbility: "high",
  shooterType: "flywheel", capabilities: ["auto", "climb"], deficiencies: ["intake"],
  autonomousRoutine: "3-piece", autoOptions: ["A", "B"], notes: "solid",
  photoUrl: "data:img", offenseRating: 8, defenseRating: 6, overallRating: 9,
  coreValuesRating: 3,
};

const MATCH_ROW: Record<string, any> = {
  id: 2, eventId: 7, scoutedBy: 3, createdAt: new Date(),
  matchNumber: 12, matchType: "qualification", teamNumber: 10991, alliance: "Blue",
  autoScore: 15, teleopScore: 30, endgameScore: 10, penalties: 2, autoClimb: true,
  endClimbLevel: 3, coralScored: 4, algaeScored: 5, autoFuelTotal: 8,
  teleopFuelTotal: 22, humanPlayerScore: 6, defenseRating: 3, drivingSkillRating: 5,
  coreValuesRating: 2, autoUsed: "3-piece", notes: "clean",
};

function roundTrips(kind: ScoutKind, row: Record<string, any>) {
  const data = dataFromLegacyRow(kind, row);
  const cols = legacyColumnsFromData(kind, data);
  // Close the loop: cols -> data' must equal data (stable round trip).
  const data2 = dataFromLegacyRow(kind, cols);
  assert.deepEqual(data2, data, `${kind}: data blob not stable across round trip`);
  return { data, cols };
}

console.log("scout-mapping round-trip tests:");

test("pit: data blob captures every non-meta column", () => {
  const { data } = roundTrips("pit", PIT_ROW);
  assert.equal(data.teamNumber, 10991);
  assert.equal(data.drivetrain, "Swerve");
  assert.equal(data.overallRating, 9);
  assert.deepEqual(data.capabilities, ["auto", "climb"]);
  // meta columns must NOT leak into the blob
  assert.equal("id" in data, false);
  assert.equal("scoutedBy" in data, false);
});

test("pit: legacy columns reproduced from data", () => {
  const { cols } = roundTrips("pit", PIT_ROW);
  for (const key of Object.keys(cols)) {
    assert.deepEqual(cols[key], PIT_ROW[key], `pit column ${key} mismatch`);
  }
});

test("match: data blob captures every non-meta column (incl. remapped keys)", () => {
  const { data } = roundTrips("match", MATCH_ROW);
  assert.equal(data.autoFuelTotal, 8);
  assert.equal(data.teleopFuelTotal, 22);
  assert.equal(data.coralScored, 4);
  // the two remapped legacy columns land under distinct data keys
  assert.equal(data.matchDefenseRating, 3);
  assert.equal(data.matchCoreValuesRating, 2);
});

test("match: remapped keys write back to the correct columns", () => {
  const { cols } = roundTrips("match", MATCH_ROW);
  assert.equal(cols.defenseRating, 3);
  assert.equal(cols.coreValuesRating, 2);
  assert.equal(cols.autoFuelTotal, 8);
  for (const key of Object.keys(cols)) {
    assert.deepEqual(cols[key], MATCH_ROW[key], `match column ${key} mismatch`);
  }
});

test("sparse rows: missing columns stay absent (not null-filled)", () => {
  const sparse = { teamNumber: 42 };
  const data = dataFromLegacyRow("pit", sparse);
  assert.deepEqual(data, { teamNumber: 42 });
});

console.log("\ntemplate validation tests:");

test("built-in templates are self-valid", () => {
  assert.equal(validateTemplateFields("pit", BUILTIN_TEMPLATES.pit.fields).ok, true);
  assert.equal(validateTemplateFields("match", BUILTIN_TEMPLATES.match.fields).ok, true);
});

test("dropping a previously-saved key is rejected", () => {
  const prev = BUILTIN_TEMPLATES.match.fields;
  const next = prev.filter(f => f.key !== "penalties");
  const r = validateTemplateFields("match", next, prev);
  assert.equal(r.ok, false);
  assert.match(r.error!, /penalties/);
});

test("archiving a key (keeping it) is allowed", () => {
  const prev = BUILTIN_TEMPLATES.match.fields;
  const next = prev.map(f => f.key === "penalties" ? { ...f, archived: true } : f);
  assert.equal(validateTemplateFields("match", next, prev).ok, true);
});

test("changing a saved field's type is rejected", () => {
  const prev = BUILTIN_TEMPLATES.pit.fields;
  const next = prev.map(f => f.key === "notes" ? { ...f, type: "number" as const } : f);
  const r = validateTemplateFields("pit", next, prev);
  assert.equal(r.ok, false);
  assert.match(r.error!, /type cannot change/);
});

test("missing identity field is rejected", () => {
  const fields: TemplateField[] = [{ key: "foo", label: "Foo", type: "text" }];
  assert.equal(validateTemplateFields("pit", fields).ok, false);
});

test("duplicate keys are rejected", () => {
  const fields: TemplateField[] = [
    { key: "teamNumber", label: "Team", type: "number" },
    { key: "teamNumber", label: "Dup", type: "number" },
  ];
  assert.equal(validateTemplateFields("pit", fields).ok, false);
});

test("keyFromLabel makes safe, unique snake_case keys", () => {
  assert.equal(keyFromLabel("Auto Score!"), "auto_score");
  assert.equal(keyFromLabel("123 widgets"), "field_123_widgets");
  const taken = new Set(["auto_score"]);
  assert.equal(keyFromLabel("Auto Score", taken), "auto_score_2");
});

if (process.exitCode) {
  console.error(`\n${passed} passed, with failures.`);
} else {
  console.log(`\nAll ${passed} tests passed.`);
}
