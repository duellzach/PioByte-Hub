/**
 * Signed, expiring media URLs.
 *
 * Meta fetches our photos/videos from a *public* URL while it builds a post,
 * so `/api/social/media/:file` has to work without a session. Each URL carries
 * an HMAC over `file + expiry` instead: fetchable by anyone holding the link,
 * but only inside a short window, and the link can't be forged for other files.
 */
import crypto from "node:crypto";
import { SESSION_SECRET } from "../security";

function secret(): string {
  const s = process.env.MEDIA_SIGNING_SECRET || SESSION_SECRET;
  if (!s) throw new Error("MEDIA_SIGNING_SECRET (or SESSION_SECRET) must be set to sign media URLs");
  return s;
}

export function signMediaKey(file: string, expiresAtMs: number, secretValue = secret()): string {
  return crypto.createHmac("sha256", secretValue).update(`social-media:${file}:${expiresAtMs}`).digest("base64url");
}

/** Constant-time signature check plus expiry. */
export function verifyMediaSignature(
  file: string,
  expiresAtMs: number,
  signature: string,
  now: number = Date.now(),
  secretValue = secret(),
): boolean {
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return false;
  const a = Buffer.from(signature || "");
  const b = Buffer.from(signMediaKey(file, expiresAtMs, secretValue));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

/** Public base URL of this deployment — what Meta will fetch media from. */
export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
}

/** Path (or, with `absolute`, full URL) to a stored file, valid for `ttlSec`. */
export function signedMediaUrl(file: string, ttlSec: number, absolute = false): string {
  const exp = Date.now() + ttlSec * 1000;
  const path = `/api/social/media/${encodeURIComponent(file)}?exp=${exp}&sig=${signMediaKey(file, exp)}`;
  return absolute ? `${appBaseUrl()}${path}` : path;
}
