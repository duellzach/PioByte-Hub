import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const BCRYPT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Session tokens (JWT in an httpOnly cookie)
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = "piobyte_session";
const SESSION_TTL = "30d";

// In production a real secret MUST be provided via env. In dev we fall back to
// a fixed value so the app runs out of the box; index.ts warns loudly if unset.
const isProduction = process.env.NODE_ENV === "production";
export const SESSION_SECRET =
  process.env.SESSION_SECRET || (isProduction ? "" : "dev-only-insecure-session-secret");

export type MemberToken = { kind: "member"; userId: number; roles: string[] };
export type GuestToken = { kind: "guest"; eventId: number };
export type SessionToken = MemberToken | GuestToken;

export function signSession(payload: SessionToken): string {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: SESSION_TTL });
}

export function verifySession(token: string | undefined | null): SessionToken | null {
  if (!token || !SESSION_SECRET) return null;
  try {
    return jwt.verify(token, SESSION_SECRET) as SessionToken;
  } catch {
    return null;
  }
}

/** Cookie options for setting/clearing the session cookie. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction, // Replit terminates TLS at its proxy; requires trust proxy
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

/** True if a stored value is already a bcrypt hash (vs. a legacy plaintext password). */
export function isHashed(value: string | null | undefined): boolean {
  return typeof value === "string" && /^\$2[aby]\$/.test(value);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a stored value.
 * Supports lazy migration: if the stored value is still legacy plaintext, we
 * compare directly and signal (via `needsRehash`) that the caller should
 * re-store it as a hash on successful login.
 */
export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!stored) return { ok: false, needsRehash: false };
  if (isHashed(stored)) {
    return { ok: await bcrypt.compare(plain, stored), needsRehash: false };
  }
  // Legacy plaintext row — accept on exact match, then upgrade to a hash.
  return { ok: plain === stored, needsRehash: plain === stored };
}

/** Strip the password field from a user object before sending it to a client. */
export function sanitizeUser<T extends { password?: unknown }>(user: T): Omit<T, "password"> {
  if (!user) return user;
  const { password, ...rest } = user as any;
  return rest;
}
