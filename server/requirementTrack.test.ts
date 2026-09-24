/**
 * Standalone tests for requirementTrackFor in shared/roles.ts:
 *
 *   node_modules/.bin/tsx server/requirementTrack.test.ts
 */
import assert from "node:assert/strict";
import { requirementTrackFor } from "../shared/roles";

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

test("Coaches and Mentors follow the coach/mentor requirements", () => {
  assert.equal(requirementTrackFor(["Coach"]), "mentor");
  assert.equal(requirementTrackFor(["Mentor"]), "mentor");
  assert.equal(requirementTrackFor(["Mentor", "Trainer"]), "mentor");
});

test("club students follow the student requirements", () => {
  assert.equal(requirementTrackFor(["Team Member"]), "member");
  assert.equal(requirementTrackFor(["Team Captain", "SCRUM Master"]), "member");
  assert.equal(requirementTrackFor(["Department Head"]), "member");
  // In class AND on the club → still has club requirements.
  assert.equal(requirementTrackFor(["Class Member", "Team Member"]), "member");
});

test("class-only students and role-less users have none", () => {
  assert.equal(requirementTrackFor(["Class Member"]), "none");
  assert.equal(requirementTrackFor([]), "none");
});

if (process.exitCode) {
  console.error(`\n${passed} passed, with failures.`);
} else {
  console.log(`\nAll ${passed} tests passed.`);
}
