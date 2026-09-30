/**
 * Database access for the social media manager. Table definitions live in
 * shared/schema.ts; `ensureSocialTables` creates them on existing databases
 * (fresh databases get them from the boot-time drizzle push). Everything here
 * is idempotent — it runs on every boot.
 */
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  socialAccounts, socialPosts, socialMediaItems, socialTargets, socialPostEvents, users,
  type SocialAccount, type SocialMediaItem,
} from "../../shared/schema";
import { MEDIA_MANAGER_ROLE } from "../../shared/social";
import { encryptToken } from "./tokens";

export async function ensureSocialTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS social_accounts (
      id SERIAL PRIMARY KEY,
      platform TEXT NOT NULL,
      external_id TEXT NOT NULL,
      name TEXT NOT NULL,
      token_enc TEXT NOT NULL,
      connected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      needs_reconnect BOOLEAN NOT NULL DEFAULT false,
      last_error TEXT,
      last_checked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS social_accounts_platform_external_idx ON social_accounts (platform, external_id)`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS social_posts (
      id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      caption TEXT NOT NULL DEFAULT '',
      platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS social_media_items (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES social_posts(id) ON DELETE CASCADE,
      uploader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL,
      storage_key TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      duration_sec INTEGER,
      alt_text TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS social_targets (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      account_id INTEGER REFERENCES social_accounts(id) ON DELETE SET NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      containers JSONB NOT NULL DEFAULT '{}'::jsonb,
      external_id TEXT,
      permalink TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ,
      locked_until TIMESTAMPTZ,
      last_error TEXT,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS social_post_events (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
}

/** Existing teams' role lists predate "Media Manager" — append it once so it
 *  shows up in the Team page's role picker. Fresh databases get it from the
 *  column default in shared/schema.ts. */
export async function migrateMediaManagerRole(): Promise<void> {
  if (!(await storage.claimMigration("social-media-manager-role"))) return;
  await db.execute(sql`
    UPDATE team_settings
    SET roles = roles || ${JSON.stringify([{ name: MEDIA_MANAGER_ROLE, tier: "member" }])}::jsonb
    WHERE NOT roles @> ${JSON.stringify([{ name: MEDIA_MANAGER_ROLE }])}::jsonb
  `);
}

// ---- Accounts ---------------------------------------------------------------

export async function upsertAccount(a: {
  platform: "facebook" | "instagram";
  externalId: string;
  name: string;
  token: string;
  connectedBy: number;
}): Promise<void> {
  const tokenEnc = encryptToken(a.token);
  await db
    .insert(socialAccounts)
    .values({ platform: a.platform, externalId: a.externalId, name: a.name, tokenEnc, connectedBy: a.connectedBy })
    .onConflictDoUpdate({
      target: [socialAccounts.platform, socialAccounts.externalId],
      set: { name: a.name, tokenEnc, connectedBy: a.connectedBy, needsReconnect: false, lastError: null },
    });
}

export async function listAccounts(): Promise<SocialAccount[]> {
  return db.select().from(socialAccounts).orderBy(asc(socialAccounts.platform), asc(socialAccounts.id));
}

/** Accounts safe to show the browser — never the token. */
export function publicAccount(a: SocialAccount) {
  const { tokenEnc: _omit, ...rest } = a;
  return rest;
}

export async function markNeedsReconnect(accountId: number, reason: string): Promise<boolean> {
  const rows = await db
    .update(socialAccounts)
    .set({ needsReconnect: true, lastError: reason.slice(0, 500) })
    .where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.needsReconnect, false)))
    .returning({ id: socialAccounts.id });
  return rows.length > 0; // true only on the transition, so callers notify once
}

// ---- Media --------------------------------------------------------------------

export async function mediaForPost(postId: number): Promise<SocialMediaItem[]> {
  return db.select().from(socialMediaItems).where(eq(socialMediaItems.postId, postId)).orderBy(asc(socialMediaItems.position));
}

/** Uploads that never got attached to a post (abandoned composer). */
export async function orphanedMedia(olderThan: Date): Promise<SocialMediaItem[]> {
  return db.select().from(socialMediaItems).where(and(isNull(socialMediaItems.postId), lt(socialMediaItems.createdAt, olderThan)));
}

// ---- Events + people ----------------------------------------------------------

export async function addEvent(postId: number, actorId: number | null, action: string, comment?: string | null, tx: any = db) {
  await tx.insert(socialPostEvents).values({ postId, actorId, action, comment: comment || null });
}

export async function coachIds(): Promise<number[]> {
  const rows = await db.select({ id: users.id, roles: users.roles }).from(users);
  return rows.filter((u) => (u.roles as string[]).includes("Coach")).map((u) => u.id);
}

export async function userNames(ids: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((x): x is number => typeof x === "number"))];
  if (unique.length === 0) return new Map();
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map((r) => [r.id, r.name]));
}

// ---- Listing --------------------------------------------------------------------

export type PostView = "mine" | "queue" | "calendar";

export async function listPostRows(view: PostView, userId: number) {
  if (view === "mine") {
    return db.select().from(socialPosts).where(eq(socialPosts.authorId, userId)).orderBy(desc(socialPosts.updatedAt)).limit(200);
  }
  if (view === "queue") {
    return db.select().from(socialPosts).where(eq(socialPosts.status, "submitted")).orderBy(asc(socialPosts.scheduledAt));
  }
  return db
    .select()
    .from(socialPosts)
    .where(inArray(socialPosts.status, ["approved", "publishing", "published", "partially_published", "failed"]))
    .orderBy(desc(sql`coalesce(${socialPosts.scheduledAt}, ${socialPosts.approvedAt})`))
    .limit(300);
}

export async function targetsFor(postIds: number[]) {
  if (postIds.length === 0) return [];
  return db.select().from(socialTargets).where(inArray(socialTargets.postId, postIds)).orderBy(asc(socialTargets.id));
}

export async function mediaFor(postIds: number[]) {
  if (postIds.length === 0) return [];
  return db.select().from(socialMediaItems).where(inArray(socialMediaItems.postId, postIds)).orderBy(asc(socialMediaItems.position));
}

export async function eventsFor(postId: number) {
  return db.select().from(socialPostEvents).where(eq(socialPostEvents.postId, postId)).orderBy(asc(socialPostEvents.createdAt), asc(socialPostEvents.id));
}

/** The most recent coach comment per post — shown inline on the student's card. */
export async function latestFeedback(postIds: number[]): Promise<Map<number, { comment: string; actorId: number | null; at: Date }>> {
  const out = new Map<number, { comment: string; actorId: number | null; at: Date }>();
  if (postIds.length === 0) return out;
  const rows = await db
    .select()
    .from(socialPostEvents)
    .where(and(inArray(socialPostEvents.postId, postIds), eq(socialPostEvents.action, "sent_back")))
    .orderBy(desc(socialPostEvents.createdAt));
  for (const r of rows) if (!out.has(r.postId) && r.comment) out.set(r.postId, { comment: r.comment, actorId: r.actorId, at: r.createdAt });
  return out;
}
