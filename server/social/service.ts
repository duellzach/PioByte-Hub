/**
 * The post workflow: compose → submit → (coach) approve | send back → publish.
 *
 * Every status change is a conditional UPDATE inside a transaction that first
 * locks the post row (`FOR UPDATE`). The publisher (worker.ts) takes the same
 * lock when it starts a post, so a coach unscheduling a post and the worker
 * picking it up can't both win.
 */
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { sendPushToUsers } from "../push";
import { socialAccounts, socialMediaItems, socialPosts, socialTargets, type SocialPost } from "../../shared/schema";
import {
  AUTHOR_EDITABLE, SOCIAL_PLATFORMS, canTransition, validatePost,
  type PostStatus, type SocialPlatform,
} from "../../shared/social";
import { addEvent, coachIds } from "./store";

export class SocialError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface PostInput {
  caption?: string;
  platforms?: string[];
  scheduledAt?: string | null;
  mediaIds?: number[];
}

// ---- Notifications ----------------------------------------------------------

/** In-app notification + device push. Best-effort; never throws. */
export async function notify(
  toUserIds: number[],
  fromUserId: number,
  message: string,
  opts: { includeSender?: boolean } = {},
): Promise<void> {
  // A person isn't told about their own action (a coach approving their own
  // post) — except for publisher events, which `fromUserId` merely attributes.
  const ids = [...new Set(toUserIds)].filter((id) => opts.includeSender || id !== fromUserId);
  if (ids.length === 0) return;
  try {
    await Promise.all(ids.map((toUserId) => storage.createNotification({ toUserId, fromUserId, message } as any)));
    await sendPushToUsers(ids, { title: "Social media • PioByte Hub", body: message, url: "/#/social", tag: `social-${Date.now()}` });
  } catch (e) {
    console.warn("Social notification failed:", e);
  }
}

function snippet(p: Pick<SocialPost, "caption">): string {
  const c = (p.caption || "").replace(/\s+/g, " ").trim();
  return c ? `“${c.length > 40 ? c.slice(0, 40) + "…" : c}”` : "your post";
}

// ---- Helpers --------------------------------------------------------------------

function parsePlatforms(v: unknown): SocialPlatform[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((p): p is SocialPlatform => SOCIAL_PLATFORMS.includes(p as SocialPlatform)))];
}

function parseSchedule(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new SocialError(400, "That schedule time isn't a valid date.");
  return d;
}

async function lockPost(tx: any, id: number): Promise<SocialPost> {
  const rows = await tx.select().from(socialPosts).where(eq(socialPosts.id, id)).for("update");
  if (!rows[0]) throw new SocialError(404, "Post not found");
  return rows[0];
}

async function setStatus(tx: any, post: SocialPost, to: PostStatus, extra: Partial<SocialPost> = {}) {
  if (!canTransition(post.status as PostStatus, to)) {
    throw new SocialError(409, `A ${post.status.replace("_", " ")} post can't be moved to ${to.replace("_", " ")}.`);
  }
  await tx.update(socialPosts).set({ ...extra, status: to, updatedAt: new Date() }).where(eq(socialPosts.id, post.id));
}

/** Validate the post as it stands in the DB (with its attached media). */
async function validateStored(tx: any, post: SocialPost): Promise<void> {
  const media = await tx.select().from(socialMediaItems).where(eq(socialMediaItems.postId, post.id));
  const errs = validatePost({
    caption: post.caption,
    platforms: parsePlatforms(post.platforms),
    media: media.map((m: any) => ({
      kind: m.kind, contentType: m.contentType, bytes: m.bytes, width: m.width, height: m.height, durationSec: m.durationSec,
    })),
  });
  if (errs.length) throw new SocialError(400, errs.join(" "));
}

/** Attach the composer's media (in order). Only the author's own uploads that
 *  are unattached or already on this post may be used; anything previously on
 *  the post but no longer listed is detached (and later swept as an orphan). */
async function attachMedia(tx: any, postId: number, authorId: number, mediaIds: number[]) {
  const ids = [...new Set(mediaIds.map(Number).filter(Number.isFinite))];
  if (ids.length) {
    const rows = await tx.select().from(socialMediaItems).where(inArray(socialMediaItems.id, ids));
    const usable = rows.filter((m: any) => m.uploaderId === authorId && (m.postId === null || m.postId === postId));
    if (usable.length !== ids.length) throw new SocialError(400, "One of those uploads isn't available.");
  }
  await tx
    .update(socialMediaItems)
    .set({ postId: null })
    .where(ids.length ? and(eq(socialMediaItems.postId, postId), notInArray(socialMediaItems.id, ids)) : eq(socialMediaItems.postId, postId));
  for (let i = 0; i < ids.length; i++) {
    await tx.update(socialMediaItems).set({ postId, position: i }).where(eq(socialMediaItems.id, ids[i]));
  }
}

/** Drop not-yet-started platform targets (unschedule / send back / edit). */
async function clearQueuedTargets(tx: any, postId: number) {
  await tx.delete(socialTargets).where(and(eq(socialTargets.postId, postId), eq(socialTargets.status, "queued")));
}

// ---- Author actions ----------------------------------------------------------------

export async function createPost(authorId: number, input: PostInput, submit: boolean): Promise<number> {
  const id = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(socialPosts)
      .values({
        authorId,
        caption: String(input.caption ?? ""),
        platforms: parsePlatforms(input.platforms),
        scheduledAt: parseSchedule(input.scheduledAt),
        status: "draft",
      })
      .returning();
    await attachMedia(tx, post.id, authorId, input.mediaIds ?? []);
    await addEvent(post.id, authorId, "created", null, tx);
    if (submit) {
      await validateStored(tx, post);
      await setStatus(tx, post, "submitted");
      await addEvent(post.id, authorId, "submitted", null, tx);
    }
    return post.id;
  });
  if (submit) await notifyCoachesOfSubmission(id, authorId);
  return id;
}

export async function updatePost(actorId: number, id: number, input: PostInput, submit: boolean): Promise<void> {
  let submittedNow = false;
  await db.transaction(async (tx) => {
    const post = await lockPost(tx, id);
    if (post.authorId !== actorId) throw new SocialError(403, "Only the author can edit this post.");
    if (!AUTHOR_EDITABLE.includes(post.status as PostStatus)) {
      throw new SocialError(409, "This post can't be edited any more.");
    }
    const patch: Partial<SocialPost> = { updatedAt: new Date() };
    if (input.caption !== undefined) patch.caption = String(input.caption);
    if (input.platforms !== undefined) patch.platforms = parsePlatforms(input.platforms);
    if (input.scheduledAt !== undefined) patch.scheduledAt = parseSchedule(input.scheduledAt);
    await tx.update(socialPosts).set(patch).where(eq(socialPosts.id, id));
    if (input.mediaIds !== undefined) await attachMedia(tx, id, post.authorId, input.mediaIds);
    const updated = { ...post, ...patch };

    if (post.status === "approved") {
      // Any change to an approved post needs a coach to look again.
      await clearQueuedTargets(tx, id);
      await setStatus(tx, updated, "submitted", { approvedBy: null, approvedAt: null });
      await addEvent(id, actorId, "edited_after_approval", null, tx);
      submittedNow = true;
    } else {
      await addEvent(id, actorId, "edited", null, tx);
      if (submit && post.status !== "submitted") {
        await validateStored(tx, updated);
        await setStatus(tx, updated, "submitted");
        await addEvent(id, actorId, "submitted", null, tx);
        submittedNow = true;
      } else if (post.status === "submitted") {
        await validateStored(tx, updated);
      }
    }
  });
  if (submittedNow) await notifyCoachesOfSubmission(id, actorId);
}

/** Pull a submitted post back to a draft (author). */
export async function withdrawPost(actorId: number, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const post = await lockPost(tx, id);
    if (post.authorId !== actorId) throw new SocialError(403, "Only the author can withdraw this post.");
    if (post.status !== "submitted") throw new SocialError(409, "Only a post waiting for review can be withdrawn.");
    await setStatus(tx, post, "draft");
    await addEvent(id, actorId, "withdrawn", null, tx);
  });
}

async function notifyCoachesOfSubmission(postId: number, authorId: number) {
  const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, postId));
  const author = await storage.getUser(authorId);
  await notify(await coachIds(), authorId, `${author?.name || "A Media Manager"} submitted a social post for review: ${snippet(post)}`);
}

// ---- Coach actions --------------------------------------------------------------------

export async function approvePost(coachId: number, id: number, scheduledAtInput?: string | null): Promise<void> {
  let authorId = 0;
  let when: Date | null = null;
  let caption = "";
  await db.transaction(async (tx) => {
    const post = await lockPost(tx, id);
    if (post.status !== "submitted") throw new SocialError(409, "Only a post waiting for review can be approved.");
    when = scheduledAtInput !== undefined ? parseSchedule(scheduledAtInput) : post.scheduledAt;
    const current = { ...post, scheduledAt: when };
    await validateStored(tx, current);

    const platforms = parsePlatforms(post.platforms);
    const accounts = await tx.select().from(socialAccounts).where(inArray(socialAccounts.platform, platforms));
    const targets = [];
    for (const platform of platforms) {
      const forPlatform = accounts.filter((a: any) => a.platform === platform);
      const label = platform === "instagram" ? "Instagram" : "Facebook";
      if (forPlatform.length === 0) throw new SocialError(409, `No ${label} account is connected. Connect one on the Accounts tab first.`);
      if (forPlatform.length > 1) throw new SocialError(409, `More than one ${label} account is connected. Disconnect the ones the team doesn't use on the Accounts tab.`);
      if (forPlatform[0].needsReconnect) throw new SocialError(409, `The ${label} account needs to be reconnected before anything can be published to it.`);
      targets.push({ postId: id, accountId: forPlatform[0].id, platform, status: "queued", nextAttemptAt: when ?? new Date() });
    }
    await tx.delete(socialTargets).where(eq(socialTargets.postId, id));
    await tx.insert(socialTargets).values(targets);
    await setStatus(tx, post, "approved", { scheduledAt: when, approvedBy: coachId, approvedAt: new Date() });
    await addEvent(id, coachId, "approved", null, tx);
    authorId = post.authorId;
    caption = post.caption;
  });
  const whenText = when && (when as Date).getTime() > Date.now() + 60_000 ? "and scheduled" : "and is publishing now";
  await notify([authorId], coachId, `A coach approved ${snippet({ caption })} ${whenText}.`);
  // Kick the publisher rather than waiting for the next tick.
  import("./worker").then((w) => w.pokeWorker()).catch(() => {});
}

export async function sendBackPost(coachId: number, id: number, comment: string): Promise<void> {
  const text = String(comment || "").trim();
  if (!text) throw new SocialError(400, "Tell the student what to change.");
  let authorId = 0;
  let caption = "";
  await db.transaction(async (tx) => {
    const post = await lockPost(tx, id);
    if (!["submitted", "approved"].includes(post.status)) throw new SocialError(409, "This post can't be sent back now.");
    await clearQueuedTargets(tx, id);
    await setStatus(tx, post, "changes_requested", { approvedBy: null, approvedAt: null });
    await addEvent(id, coachId, "sent_back", text, tx);
    authorId = post.authorId;
    caption = post.caption;
  });
  await notify([authorId], coachId, `A coach asked for changes to ${snippet({ caption })}: ${text}`);
}

/** Take an approved post off the schedule; it goes back to the review queue. */
export async function unschedulePost(coachId: number, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const post = await lockPost(tx, id);
    if (post.status !== "approved") throw new SocialError(409, "Only a scheduled post that hasn't started publishing can be unscheduled.");
    await clearQueuedTargets(tx, id);
    await setStatus(tx, post, "submitted", { approvedBy: null, approvedAt: null });
    await addEvent(id, coachId, "unscheduled", null, tx);
  });
}

export async function cancelPost(actorId: number, isCoach: boolean, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const post = await lockPost(tx, id);
    if (post.authorId !== actorId && !isCoach) throw new SocialError(403, "You can't cancel someone else's post.");
    if (post.status === "failed" && !isCoach) throw new SocialError(403, "Ask a coach to retry or cancel a failed post.");
    await clearQueuedTargets(tx, id);
    await setStatus(tx, post, "canceled");
    await addEvent(id, actorId, "canceled", null, tx);
  });
}

/** Re-queue a failed platform (e.g. after reconnecting the account). */
export async function retryTarget(coachId: number, targetId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(socialTargets).where(eq(socialTargets.id, targetId));
    if (!target) throw new SocialError(404, "Not found");
    const post = await lockPost(tx, target.postId);
    if (target.status !== "failed") throw new SocialError(409, "Only a failed platform can be retried.");
    const [account] = await tx.select().from(socialAccounts).where(eq(socialAccounts.id, target.accountId));
    if (!account || account.needsReconnect) throw new SocialError(409, "Reconnect the account on the Accounts tab before retrying.");
    await tx
      .update(socialTargets)
      .set({ status: "queued", attempts: 0, containers: {}, lastError: null, nextAttemptAt: new Date(), lockedUntil: null })
      .where(eq(socialTargets.id, targetId));
    if (post.status !== "publishing") await setStatus(tx, post, "publishing");
    await addEvent(post.id, coachId, `retry_${target.platform}`, null, tx);
  });
  import("./worker").then((w) => w.pokeWorker()).catch(() => {});
}

/** Remove a connected account. Past targets keep their history (account_id → null). */
export async function disconnectAccount(accountId: number): Promise<void> {
  const inFlight = await db
    .select({ id: socialTargets.id })
    .from(socialTargets)
    .where(and(eq(socialTargets.accountId, accountId), inArray(socialTargets.status, ["queued", "creating_container", "publishing"])));
  if (inFlight.length) {
    throw new SocialError(409, "Posts are scheduled to this account. Unschedule them first, or reconnect instead of disconnecting.");
  }
  await db.delete(socialAccounts).where(eq(socialAccounts.id, accountId));
}
