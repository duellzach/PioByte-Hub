/**
 * Encryption for Meta access tokens at rest: AES-256-GCM with a 32-byte key
 * from META_TOKEN_KEY (base64 — generate with `openssl rand -base64 32`).
 * Tokens are decrypted only when making a Graph call and never leave the server.
 *
 * Stored format (base64): [12-byte IV][16-byte GCM tag][ciphertext].
 */
import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function key(raw = process.env.META_TOKEN_KEY): Buffer {
  if (!raw) throw new Error("META_TOKEN_KEY is not set — add it in Replit Secrets (openssl rand -base64 32)");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("META_TOKEN_KEY must decode to exactly 32 bytes");
  return k;
}

export function tokenKeyConfigured(): boolean {
  try { key(); return true; } catch { return false; }
}

export function encryptToken(plaintext: string, rawKey?: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(rawKey), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptToken(payload: string, rawKey?: string): string {
  const buf = Buffer.from(payload, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key(rawKey), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
