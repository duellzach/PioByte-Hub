/**
 * The publisher. A ticker (every 30s, plus a poke after approve/retry) claims
 * due platform targets and advances each by ONE step, persisting state between
 * steps so a restart resumes where it left off:
 *
 *   Instagram  queued → creating_container (poll children → carousel parent →
 *              poll) → publishing → published
 *   Facebook   queued → publishing → published
 *
 * Claiming: `FOR UPDATE SKIP LOCKED` plus a lease (`locked_until`). A crash
 * mid-step leaves the lease to expire and the target is picked up again. The
 * dangerous case is a crash *during the publish call itself* — we can't know
 * whether it went out — so a target found in `publishing` with an expired
 * lease is resolved carefully (IG: ask the container; FB: fail with a "check
 * the Page first" message rather than risk a duplicate post).
 *
 * The deployment is a single Reserved VM, so the in-process ticker is enough;
 * the SQL claim would still be correct with more than one instance.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { socialAccounts, socialPosts, socialTargets, type SocialMediaItem, type SocialPost, type SocialTarget } from "../../shared/schema";
import {
  CLAIM_LEASE_MS, CONTAINER_TIMEOUT_MS, IG_PUBLISHES_PER_24H, MAX_PUBLISH_ATTEMPTS, MEDIA_URL_TTL_SEC,
  pollDelayMs, retryDelayMs, rollupPostStatus, type TargetStatus,
} from "../../shared/social";
import { GraphError } from "./graph";
import { decryptToken } from "./tokens";
import { signedMediaUrl } from "./signing";
import { mediaStore } from "./mediaStore";
import { addEvent, coachIds, markNeedsReconnect, mediaForPost, orphanedMedia } from "./store";
import { notify } from "./service";
import * as meta from "./publish";

const TICK_MS = 30_000;
const MAX_STEPS_PER_TICK = 20;

interface Containers {
  children?: string[];
  container?: string;
  polls?: number;
  startedAt?: string;
}

let running = false;
let again = false;
let timer: ReturnType<typeof setInterval> | null = null;
let lastDaily = 0;

export function startSocialWorker(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), TICK_MS);
  void tick();
}

/** Run a tick soon (after an approve or retry) instead of waiting up to 30s. */
export function pokeWorker(): void {
  setTimeout(() => void tick(), 250);
}

export async function tick(): Promise<void> {
  if (running) { again = true; return; }
  running = true;
  try {
    for (let i = 0; i < MAX_STEPS_PER_TICK; i++) {
      const claimed = await claimNext();
      if (!claimed) break;
      await runStep(claimed).catch((e) => console.error("Social publish step crashed:", e));
    }
    if (Date.now() - lastDaily > 24 * 60 * 60 * 1000) {
      lastDaily = Date.now();
      await dailyMaintenance().catch((e) => console.warn("Social daily maintenance failed:", e));
    }
  } catch (e) {
    console.error("Social worker tick failed:", e);
  } finally {
    running = false;
    if (again) { again = false; pokeWorker(); }
    else await scheduleNextWake().catch(() => {});
  }
}

let wake: ReturnType<typeof setTimeout> | null = null;

/** The 30s ticker is only a floor: when a step is due sooner (an Instagram
 *  poll 5s out), wake up for it so the backoff in shared/social.ts is real. */
async function scheduleNextWake(): Promise<void> {
  const res: any = await db.execute(sql`
    SELECT extract(epoch FROM (min(greatest(coalesce(next_attempt_at, now()), coalesce(locked_until, now()))) - now())) * 1000 AS ms
    FROM social_targets WHERE status IN ('queued', 'creating_container', 'publishing')`);
  const ms = res.rows?.[0]?.ms;
  if (ms === null || ms === undefined || Number(ms) >= TICK_MS) return;
  if (wake) clearTimeout(wake);
  wake = setTimeout(() => { wake = null; void tick(); }, Math.max(500, Number(ms) + 50));
}

// ---- Claiming ---------------------------------------------------------------------

interface Claimed { target: SocialTarget; post: SocialPost }

async function claimNext(): Promise<Claimed | null> {
  return db.transaction(async (tx) => {
    // Lock the target AND its post, skipping any that are busy. The post lock
    // serializes with service.ts (unschedule/send back lock the post first);
    // SKIP LOCKED means the worker never waits, so the two can't deadlock.
    const res: any = await tx.execute(sql`
      SELECT t.id FROM social_targets t
      JOIN social_posts p ON p.id = t.post_id
      WHERE t.status IN ('queued', 'creating_container', 'publishing')
        AND (t.next_attempt_at IS NULL OR t.next_attempt_at <= now())
        AND (t.locked_until IS NULL OR t.locked_until < now())
      ORDER BY t.next_attempt_at NULLS FIRST, t.id
      LIMIT 1
      FOR UPDATE OF t, p SKIP LOCKED`);
    const id = res.rows?.[0]?.id;
    if (!id) return null;
    const [target] = await tx
      .update(socialTargets)
      .set({ lockedUntil: new Date(Date.now() + CLAIM_LEASE_MS) })
      .where(eq(socialTargets.id, id))
      .returning();
    const [post] = await tx.select().from(socialPosts).where(eq(socialPosts.id, target.postId));

    // The post may have been unscheduled or canceled after this was queued.
    if (!["approved", "publishing"].includes(post.status) && target.status === "queued") {
      await tx.update(socialTargets).set({ status: "canceled", lockedUntil: null }).where(eq(socialTargets.id, id));
      return { target: { ...target, status: "canceled" }, post };
    }
    if (post.status === "approved") {
      await tx.update(socialPosts).set({ status: "publishing", updatedAt: new Date() }).where(eq(socialPosts.id, post.id));
      await addEvent(post.id, null, "publishing_started", null, tx);
      post.status = "publishing";
    }
    return { target, post };
  });
}

// ---- Persisting a step's outcome ----------------------------------------------------

async function save(targetId: number, patch: Partial<SocialTarget>): Promise<void> {
  await db.update(socialTargets).set({ lockedUntil: null, ...patch }).where(eq(socialTargets.id, targetId));
}

async function finish(c: Claimed, status: "published" | "failed", patch: Partial<SocialTarget>): Promise<void> {
  await save(c.target.id, { ...patch, status, nextAttemptAt: null, publishedAt: status === "published" ? new Date() : null });
  const label = c.target.platform === "instagram" ? "Instagram" : "Facebook";
  await addEvent(c.post.id, null, status === "published" ? `published_${c.target.platform}` : `failed_${c.target.platform}`,
    status === "failed" ? patch.lastError ?? null : null);
  if (status === "failed") {
    await notify(
      [...(await coachIds()), c.post.authorId],
      c.post.approvedBy ?? c.post.authorId,
      `A scheduled post failed to publish to ${label}: ${patch.lastError ?? "unknown error"}`,
      { includeSender: true },
    );
  }
  await rollup(c.post);
}

async function rollup(post: SocialPost): Promise<void> {
  const targets = await db.select({ status: socialTargets.status }).from(socialTargets).where(eq(socialTargets.postId, post.id));
  const next = rollupPostStatus(targets.map((t) => t.status as TargetStatus));
  if (!next) return;
  const rows = await db
    .update(socialPosts)
    .set({ status: next, updatedAt: new Date() })
    .where(and(eq(socialPosts.id, post.id), eq(socialPosts.status, "publishing")))
    .returning({ id: socialPosts.id });
  if (rows.length && next !== "failed") {
    const msg = next === "published" ? "Your social post is live! 🎉" : "Your social post went out, but not to every account. A coach can retry the rest.";
    await notify([post.authorId], post.approvedBy ?? post.authorId, msg, { includeSender: true });
  }
}

/** Route a thrown error: dead token → reconnect; transient → retry with backoff; else fail. */
async function handleError(c: Claimed, err: unknown, retryStatus: TargetStatus): Promise<void> {
  const label = c.target.platform === "instagram" ? "Instagram" : "Facebook";
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof GraphError && err.isAuthError) {
    if (c.target.accountId && (await markNeedsReconnect(c.target.accountId, message))) {
      await notify(await coachIds(), c.post.approvedBy ?? c.post.authorId,
        `The ${label} connection stopped working. Reconnect it on the Social page's Accounts tab.`, { includeSender: true });
    }
    return finish(c, "failed", { lastError: `The ${label} account needs to be reconnected. (${message})` });
  }
  // Network failures (fetch TypeError) are retryable too.
  const transient = err instanceof GraphError ? err.isTransient : err instanceof TypeError;
  const attempts = c.target.attempts + 1;
  if (transient && attempts < MAX_PUBLISH_ATTEMPTS) {
    return save(c.target.id, {
      status: retryStatus,
      attempts,
      lastError: message,
      nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
    });
  }
  return finish(c, "failed", { lastError: message, attempts });
}

// ---- One step -----------------------------------------------------------------------------

async function runStep(c: Claimed): Promise<void> {
  if (c.target.status === "canceled") return;
  const [account] = c.target.accountId
    ? await db.select().from(socialAccounts).where(eq(socialAccounts.id, c.target.accountId))
    : [];
  if (!account) return finish(c, "failed", { lastError: "The account was disconnected." });
  if (account.needsReconnect) return finish(c, "failed", { lastError: "The account needs to be reconnected." });

  let token: string;
  try {
    token = decryptToken(account.tokenEnc);
  } catch (e: any) {
    return finish(c, "failed", { lastError: `Can't read the stored token (${e?.message}). Check META_TOKEN_KEY, then reconnect.` });
  }
  const media = await mediaForPost(c.post.id);
  const state = (c.target.containers || {}) as Containers;

  if (c.target.platform === "instagram") return stepInstagram(c, account.externalId, token, media, state);
  return stepFacebook(c, account.externalId, token, media);
}

function publicUrl(m: SocialMediaItem): string {
  return signedMediaUrl(m.storageKey, MEDIA_URL_TTL_SEC, true);
}

async function stepInstagram(c: Claimed, igUserId: string, token: string, media: SocialMediaItem[], state: Containers) {
  const t = c.target;
  try {
    if (t.status === "queued") {
      // Instagram caps publishes per account per rolling 24h.
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(socialTargets)
        .where(and(eq(socialTargets.accountId, t.accountId!), eq(socialTargets.status, "published"),
          gte(socialTargets.publishedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))));
      if (n >= IG_PUBLISHES_PER_24H) {
        return save(t.id, { nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000), lastError: "Waiting for Instagram's 24-hour posting limit to reset." });
      }
      if (media.length === 0) return finish(c, "failed", { lastError: "Instagram posts need a photo or video." });

      const next: Containers = { polls: 0, startedAt: new Date().toISOString() };
      if (media.length === 1) {
        next.container = await meta.createIgItemContainer(igUserId, token, { kind: media[0].kind as "image" | "video", url: publicUrl(media[0]) }, { caption: c.post.caption });
      } else {
        next.children = [];
        for (const m of media) {
          next.children.push(await meta.createIgItemContainer(igUserId, token, { kind: m.kind as "image" | "video", url: publicUrl(m) }, { carouselItem: true }));
        }
      }
      return save(t.id, { status: "creating_container", containers: next as any, nextAttemptAt: new Date(Date.now() + pollDelayMs(1)), lastError: null });
    }

    if (t.status === "creating_container") {
      const started = state.startedAt ? Date.parse(state.startedAt) : Date.now();
      if (Date.now() - started > CONTAINER_TIMEOUT_MS) {
        return finish(c, "failed", { lastError: "Instagram took too long to process the media (30 min). Try a smaller or shorter video." });
      }
      const polls = (state.polls ?? 0) + 1;
      const later = (patch: Containers = {}) =>
        save(t.id, { containers: { ...state, ...patch, polls } as any, nextAttemptAt: new Date(Date.now() + pollDelayMs(polls)) });

      if (!state.container) {
        // Carousel: every child must finish before the parent can be created.
        const statuses = await Promise.all((state.children ?? []).map((id) => meta.igContainerStatus(id, token)));
        const bad = statuses.find((s) => s.status === "ERROR" || s.status === "EXPIRED");
        if (bad) return finish(c, "failed", { lastError: `Instagram couldn't process one of the carousel items (${bad.status}${bad.detail ? `: ${bad.detail}` : ""}).` });
        if (statuses.some((s) => s.status !== "FINISHED")) return later();
        const parent = await meta.createIgCarouselContainer(igUserId, token, state.children!, c.post.caption);
        return save(t.id, { containers: { ...state, container: parent, polls: 0 } as any, nextAttemptAt: new Date(Date.now() + pollDelayMs(1)) });
      }

      const s = await meta.igContainerStatus(state.container, token);
      if (s.status === "IN_PROGRESS") return later();
      if (s.status === "ERROR" || s.status === "EXPIRED") {
        return finish(c, "failed", { lastError: `Instagram couldn't process the media (${s.status}${s.detail ? `: ${s.detail}` : ""}).` });
      }
      if (s.status === "PUBLISHED") return finish(c, "published", {});
      // FINISHED → publish. Record that the publish call is in flight FIRST, so
      // a crash during it is recognised on recovery.
      await db.update(socialTargets).set({ status: "publishing" }).where(eq(socialTargets.id, t.id));
      return publishIg(c, igUserId, token, state.container);
    }

    if (t.status === "publishing") {
      // Recovery: the lease expired during media_publish. Ask the container.
      if (!state.container) return finish(c, "failed", { lastError: "Publishing was interrupted before Instagram accepted the post." });
      const s = await meta.igContainerStatus(state.container, token);
      if (s.status === "PUBLISHED") return finish(c, "published", {});
      if (s.status === "FINISHED") return publishIg(c, igUserId, token, state.container);
      return finish(c, "failed", { lastError: `Publishing was interrupted (Instagram reports ${s.status}).` });
    }
  } catch (e) {
    // A failed create/poll can safely redo that stage; a failed publish call
    // goes back to polling, which re-checks PUBLISHED before publishing again.
    return handleError(c, e, t.status === "queued" ? "queued" : "creating_container");
  }
}

async function publishIg(c: Claimed, igUserId: string, token: string, container: string) {
  try {
    const mediaId = await meta.publishIgContainer(igUserId, token, container);
    const permalink = await meta.igPermalink(mediaId, token);
    return finish(c, "published", { externalId: mediaId, permalink });
  } catch (e) {
    return handleError(c, e, "creating_container");
  }
}

async function stepFacebook(c: Claimed, pageId: string, token: string, media: SocialMediaItem[]) {
  const t = c.target;
  if (t.status === "publishing") {
    // The lease expired while the publish call was in flight. Facebook gives
    // us no way to ask "did that go through?", and a duplicate public post is
    // worse than a failed one — so stop and let a coach look.
    return finish(c, "failed", {
      lastError: "Publishing was interrupted. Check the Facebook Page — the post may already be live — before retrying.",
    });
  }
  try {
    await db.update(socialTargets).set({ status: "publishing" }).where(eq(socialTargets.id, t.id));
    const video = media.find((m) => m.kind === "video");
    const id = await meta.publishFacebook({
      pageId,
      token,
      message: c.post.caption,
      images: video ? [] : media.map(publicUrl),
      video: video ? publicUrl(video) : undefined,
    });
    const permalink = await meta.fbPermalink(id, token);
    return finish(c, "published", { externalId: id, permalink });
  } catch (e) {
    return handleError(c, e, "queued");
  }
}

// ---- Daily -------------------------------------------------------------------------------

/** Check every connected account still works, and sweep abandoned uploads. */
async function dailyMaintenance(): Promise<void> {
  const accounts = await db.select().from(socialAccounts).where(eq(socialAccounts.needsReconnect, false));
  for (const a of accounts) {
    try {
      const token = decryptToken(a.tokenEnc);
      await import("./graph").then((g) => g.graphGet(a.externalId, { fields: "id" }, token));
      await db.update(socialAccounts).set({ lastCheckedAt: new Date() }).where(eq(socialAccounts.id, a.id));
    } catch (e: any) {
      if (e instanceof GraphError && !e.isAuthError) continue; // a blip, not a dead token
      if (await markNeedsReconnect(a.id, e?.message || String(e))) {
        const coaches = await coachIds();
        if (coaches.length) {
          await notify(coaches, a.connectedBy ?? coaches[0],
            `The ${a.platform === "instagram" ? "Instagram" : "Facebook"} connection (${a.name}) stopped working. Reconnect it on the Social page.`,
            { includeSender: true });
        }
      }
    }
  }

  const orphans = await orphanedMedia(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
  for (const m of orphans) {
    await mediaStore().remove(m.storageKey).catch(() => {});
    await db.execute(sql`DELETE FROM social_media_items WHERE id = ${m.id} AND post_id IS NULL`);
  }
}
