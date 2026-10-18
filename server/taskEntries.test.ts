/**
 * Standalone tests for server/services/taskEntries.ts. No framework, no database:
 *
 *   node_modules/.bin/tsx server/taskEntries.test.ts
 */
import assert from "node:assert/strict";
import { mergeAuthoredEntries, deletedIds } from "./services/taskEntries";

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

const c = (id: string, userId: number | string, text = id) => ({ id, userId, text, timestamp: 1 });

test("new entries are stamped with the acting user, whatever the client sent", () => {
  const out = mergeAuthoredEntries([c("a", 1)], [c("b", "unknown"), c("a", 1)], 7);
  assert.deepEqual(out.map(e => [e.id, e.userId]), [["b", 7], ["a", 1]]);
});

test("stored entries can't be rewritten by the client", () => {
  const out = mergeAuthoredEntries([c("a", 1, "original")], [c("a", 9, "forged")], 9);
  assert.deepEqual(out, [c("a", 1, "original")]);
});

test("a stale client doesn't drop comments it hasn't seen", () => {
  // User 2 posted "b" after user 3 opened the modal; user 3 then posts "c".
  const stored = [c("b", 2), c("a", 1)];
  const out = mergeAuthoredEntries(stored, [c("c", 3), c("a", 1)], 3);
  assert.deepEqual(out.map(e => e.id), ["c", "b", "a"]);
});

test("deletion is refused unless canDelete allows it", () => {
  const stored = [c("a", 1), c("b", 2)];
  const memberCanDelete = (e: any) => e.userId === 2;
  const out = mergeAuthoredEntries(stored, [c("b", 2)], 2, ["a"], memberCanDelete);
  assert.deepEqual(out.map(e => e.id), ["a", "b"]);
});

test("an allowed delete removes the entry", () => {
  const out = mergeAuthoredEntries([c("a", 1), c("b", 2)], [c("b", 2)], 5, ["a"], () => true);
  assert.deepEqual(out.map(e => e.id), ["b"]);
});

test("a deleted id isn't re-added from a stale payload", () => {
  const out = mergeAuthoredEntries([c("b", 2)], [c("a", 1), c("b", 2)], 5, ["a"], () => true);
  assert.deepEqual(out.map(e => e.id), ["b"]);
});

test("junk input is ignored", () => {
  assert.deepEqual(mergeAuthoredEntries(null, "x", 1), []);
  assert.deepEqual(mergeAuthoredEntries([], [null, { id: 3 }, c("ok", 0)], 1).map(e => e.id), ["ok"]);
  assert.deepEqual(deletedIds(["a", 3, null]), ["a"]);
});

console.log(`\n${passed} passed`);
