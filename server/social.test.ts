/**
 * Standalone tests for the social media manager's pure rules (shared/social.ts)
 * and its crypto helpers (server/social/tokens.ts, signing.ts). No framework
 * and no database:
 *
 *   node_modules/.bin/tsx server/social.test.ts
 *
 * Exits non-zero on failure. The load-bearing cases: an approved post must not
 * be publishable after an edit without re-approval, a tampered/expired media
 * link must not verify, and the validator must reject what Meta would reject.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  canTransition, countHashtags, pollDelayMs, retryDelayMs, rollupPostStatus, validatePost,
  type MediaInfo, type PostStatus,
} from "../shared/social";
import { decryptToken, encryptToken } from "./social/tokens";
import { signMediaKey, verifyMediaSignature } from "./social/signing";
import { isSafeKey } from "./social/mediaStore";

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`);
  }
}

const jpg = (w = 1080, h = 1350, bytes = 500_000): MediaInfo => ({ kind: "image", contentType: "image/jpeg", bytes, width: w, height: h });
const mp4 = (durationSec = 30, bytes = 20_000_000): MediaInfo => ({ kind: "video", contentType: "video/mp4", bytes, durationSec });

console.log("state machine");
test("draft → submitted → approved → publishing → published", () => {
  const path: PostStatus[] = ["draft", "submitted", "approved", "publishing", "published"];
  for (let i = 1; i < path.length; i++) assert.ok(canTransition(path[i - 1], path[i]), `${path[i - 1]} → ${path[i]}`);
});
test("a draft can't skip review", () => {
  assert.equal(canTransition("draft", "approved"), false);
  assert.equal(canTransition("changes_requested", "approved"), false);
  assert.equal(canTransition("draft", "publishing"), false);
});
test("editing an approved post drops it back to review", () => {
  assert.ok(canTransition("approved", "submitted"));
});
test("a publishing or published post can't be canceled", () => {
  assert.equal(canTransition("publishing", "canceled"), false);
  assert.equal(canTransition("published", "canceled"), false);
});
test("a failed post can be retried", () => {
  assert.ok(canTransition("failed", "publishing"));
  assert.ok(canTransition("partially_published", "publishing"));
});

console.log("rollup");
test("in flight → null", () => assert.equal(rollupPostStatus(["published", "creating_container"]), null));
test("all published", () => assert.equal(rollupPostStatus(["published", "published"]), "published"));
test("mixed", () => assert.equal(rollupPostStatus(["published", "failed"]), "partially_published"));
test("all failed", () => assert.equal(rollupPostStatus(["failed", "failed"]), "failed"));
test("canceled targets are ignored", () => assert.equal(rollupPostStatus(["published", "canceled"]), "published"));

console.log("validator");
test("IG single photo is fine", () => assert.deepEqual(validatePost({ caption: "hi", platforms: ["instagram"], media: [jpg()] }), []));
test("IG needs media", () => assert.ok(validatePost({ caption: "hi", platforms: ["instagram"], media: [] }).length));
test("FB text-only is fine", () => assert.deepEqual(validatePost({ caption: "hi", platforms: ["facebook"], media: [] }), []));
test("no platform is rejected", () => assert.ok(validatePost({ caption: "hi", platforms: [], media: [jpg()] }).length));
test("IG rejects 11 items", () => {
  const errs = validatePost({ caption: "", platforms: ["instagram"], media: Array.from({ length: 11 }, () => jpg()) });
  assert.ok(errs.some((e) => e.includes("At most 10")));
});
test("IG rejects a too-tall photo (9:16)", () => {
  assert.ok(validatePost({ caption: "", platforms: ["instagram"], media: [jpg(1080, 1920)] }).some((e) => e.includes("4:5")));
});
test("IG accepts 4:5 and 1.91:1", () => {
  assert.deepEqual(validatePost({ caption: "", platforms: ["instagram"], media: [jpg(1080, 1350)] }), []);
  assert.deepEqual(validatePost({ caption: "", platforms: ["instagram"], media: [jpg(1910, 1000)] }), []);
});
test("IG caption and hashtag limits", () => {
  assert.ok(validatePost({ caption: "x".repeat(2201), platforms: ["instagram"], media: [jpg()] }).length);
  const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
  assert.equal(countHashtags(tags), 31);
  assert.ok(validatePost({ caption: tags, platforms: ["instagram"], media: [jpg()] }).some((e) => e.includes("hashtags")));
});
test("Reel length limits", () => {
  assert.deepEqual(validatePost({ caption: "", platforms: ["instagram"], media: [mp4(30)] }), []);
  assert.ok(validatePost({ caption: "", platforms: ["instagram"], media: [mp4(2)] }).length);
});
test("carousel videos must be ≤ 60s", () => {
  assert.ok(validatePost({ caption: "", platforms: ["instagram"], media: [jpg(), mp4(90)] }).some((e) => e.includes("carousel")));
  assert.deepEqual(validatePost({ caption: "", platforms: ["instagram"], media: [jpg(), mp4(45)] }), []);
});
test("FB rejects photos + video together, IG allows it", () => {
  assert.ok(validatePost({ caption: "", platforms: ["facebook"], media: [jpg(), mp4()] }).some((e) => e.includes("mix")));
  assert.deepEqual(validatePost({ caption: "", platforms: ["instagram"], media: [jpg(), mp4()] }), []);
});
test("FB rejects two videos", () => {
  assert.ok(validatePost({ caption: "", platforms: ["facebook"], media: [mp4(), mp4()] }).length);
});
test("file type and size limits", () => {
  assert.ok(validatePost({ caption: "", platforms: ["facebook"], media: [{ kind: "image", contentType: "image/png", bytes: 1 }] }).length);
  assert.ok(validatePost({ caption: "", platforms: ["facebook"], media: [jpg(1080, 1080, 9 * 1024 * 1024)] }).length);
});

console.log("timing");
test("retry backoff doubles and caps", () => {
  assert.equal(retryDelayMs(1), 30_000);
  assert.equal(retryDelayMs(2), 60_000);
  assert.equal(retryDelayMs(20), 15 * 60 * 1000);
});
test("poll backoff doubles and caps", () => {
  assert.equal(pollDelayMs(1), 5_000);
  assert.equal(pollDelayMs(3), 20_000);
  assert.equal(pollDelayMs(50), 5 * 60 * 1000);
});

console.log("crypto");
const key = crypto.randomBytes(32).toString("base64");
test("token round-trips", () => assert.equal(decryptToken(encryptToken("EAAG-token", key), key), "EAAG-token"));
test("token ciphertext is randomized", () => assert.notEqual(encryptToken("same", key), encryptToken("same", key)));
test("a tampered token fails", () => {
  const enc = Buffer.from(encryptToken("secret", key), "base64");
  enc[enc.length - 1] ^= 1;
  assert.throws(() => decryptToken(enc.toString("base64"), key));
});
test("the wrong key fails", () => {
  assert.throws(() => decryptToken(encryptToken("secret", key), crypto.randomBytes(32).toString("base64")));
});

const secret = "test-secret";
const file = "0b0e5c3c-2f5e-4c43-9a55-5f1d2b8f9e11.jpg";
const now = 1_700_000_000_000;
test("a valid media link verifies", () => {
  const exp = now + 60_000;
  assert.ok(verifyMediaSignature(file, exp, signMediaKey(file, exp, secret), now, secret));
});
test("an expired link fails", () => {
  const exp = now - 1;
  assert.equal(verifyMediaSignature(file, exp, signMediaKey(file, exp, secret), now, secret), false);
});
test("a link for another file fails", () => {
  const exp = now + 60_000;
  const other = "1b0e5c3c-2f5e-4c43-9a55-5f1d2b8f9e11.jpg";
  assert.equal(verifyMediaSignature(other, exp, signMediaKey(file, exp, secret), now, secret), false);
});
test("an extended expiry fails", () => {
  const exp = now + 60_000;
  assert.equal(verifyMediaSignature(file, exp + 1, signMediaKey(file, exp, secret), now, secret), false);
});
test("storage keys can't escape the directory", () => {
  assert.ok(isSafeKey(file));
  assert.equal(isSafeKey("../../etc/passwd"), false);
  assert.equal(isSafeKey(`${file}/..`), false);
  assert.equal(isSafeKey("0b0e5c3c-2f5e-4c43-9a55-5f1d2b8f9e11.png"), false);
});

if (failures) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
