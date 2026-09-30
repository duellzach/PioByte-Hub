import { Router, type Request, type Response } from "express";
import busboy from "busboy";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { getUserRoles, hasAnyRole } from "../helpers";
import { socialMediaItems, socialPosts, type SocialPost } from "../../shared/schema";
import { LIMITS, SOCIAL_APPROVE_ROLES, SOCIAL_SUBMIT_ROLES } from "../../shared/social";
import { isSafeKey, mediaStore } from "../social/mediaStore";
import { signedMediaUrl, verifyMediaSignature } from "../social/signing";
import { buildLoginUrl, completeConnection, metaConfigured, redirectUri } from "../social/oauth";
import { tokenKeyConfigured } from "../social/tokens";
import {
  eventsFor, latestFeedback, listAccounts, listPostRows, mediaFor, publicAccount, targetsFor, userNames, type PostView,
} from "../social/store";
import * as svc from "../social/service";

const router = Router();

/** In-app media links; long enough to outlive a page left open. */
const UI_MEDIA_TTL_SEC = 6 * 60 * 60;
const OAUTH_COOKIE = "social_oauth_state";

// Roles are re-read from the DB rather than trusted from the 30-day JWT, so
// taking the Media Manager role away takes effect immediately.
async function access(req: Request) {
  const roles = await getUserRoles(req.userId!);
  return {
    canSubmit: hasAnyRole(roles, SOCIAL_SUBMIT_ROLES),
    isCoach: hasAnyRole(roles, SOCIAL_APPROVE_ROLES),
  };
}

function fail(res: Response, e: unknown) {
  if (e instanceof svc.SocialError) return res.status(e.status).json({ error: e.message });
  console.error("Social route error:", e);
  return res.status(500).json({ error: "Something went wrong" });
}

// ---- Serialization -------------------------------------------------------------

async function serialize(posts: SocialPost[]) {
  const ids = posts.map((p) => p.id);
  const [targets, media, feedback] = await Promise.all([targetsFor(ids), mediaFor(ids), latestFeedback(ids)]);
  const names = await userNames(posts.flatMap((p) => [p.authorId, p.approvedBy ?? -1]).concat([...feedback.values()].map((f) => f.actorId ?? -1)));
  return posts.map((p) => {
    const fb = feedback.get(p.id);
    return {
      id: p.id,
      authorId: p.authorId,
      authorName: names.get(p.authorId) ?? "Unknown",
      caption: p.caption,
      platforms: p.platforms,
      status: p.status,
      scheduledAt: p.scheduledAt,
      approvedBy: p.approvedBy,
      approvedByName: p.approvedBy ? names.get(p.approvedBy) ?? null : null,
      approvedAt: p.approvedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      feedback: fb && ["changes_requested"].includes(p.status)
        ? { comment: fb.comment, by: fb.actorId ? names.get(fb.actorId) ?? null : null, at: fb.at }
        : null,
      media: media.filter((m) => m.postId === p.id).map((m) => ({
        id: m.id,
        kind: m.kind,
        contentType: m.contentType,
        bytes: m.bytes,
        width: m.width,
        height: m.height,
        durationSec: m.durationSec,
        url: signedMediaUrl(m.storageKey, UI_MEDIA_TTL_SEC),
      })),
      targets: targets.filter((t) => t.postId === p.id).map((t) => ({
        id: t.id,
        platform: t.platform,
        status: t.status,
        permalink: t.permalink,
        lastError: t.lastError,
        attempts: t.attempts,
        nextAttemptAt: t.nextAttemptAt,
        publishedAt: t.publishedAt,
      })),
    };
  });
}

// ---- Status / accounts -----------------------------------------------------------

router.get("/social/status", async (req, res) => {
  try {
    const a = await access(req);
    if (!a.canSubmit) return res.status(403).json({ error: "Social media is for Media Managers and Coaches." });
    const accounts = await listAccounts();
    res.json({
      ...a,
      metaConfigured: metaConfigured() && tokenKeyConfigured(),
      // Shown to the coach so they can paste it into the Meta app settings.
      redirectUri: a.isCoach ? redirectUri() : undefined,
      accounts: accounts.map(publicAccount),
    });
  } catch (e) { fail(res, e); }
});

router.delete("/social/accounts/:id", async (req, res) => {
  try {
    if (!(await access(req)).isCoach) return res.status(403).json({ error: "Coaches only" });
    await svc.disconnectAccount(parseInt(req.params.id));
    res.status(204).send();
  } catch (e) { fail(res, e); }
});

// ---- Meta connection (Coach) -------------------------------------------------------

router.get("/social/meta/connect", async (req, res) => {
  try {
    if (!(await access(req)).isCoach) return res.status(403).send("Coaches only");
    if (!metaConfigured() || !tokenKeyConfigured()) {
      return res.status(400).send("Meta isn't configured yet: set META_APP_ID, META_APP_SECRET and META_TOKEN_KEY.");
    }
    const state = crypto.randomBytes(24).toString("base64url");
    res.cookie(OAUTH_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60 * 1000,
      path: "/api/social/meta",
    });
    res.redirect(buildLoginUrl(state));
  } catch (e) { fail(res, e); }
});

router.get("/social/meta/callback", async (req, res) => {
  const back = (qs: string) => res.redirect(`/#/social?tab=accounts&${qs}`);
  try {
    if (!(await access(req)).isCoach) return back("error=" + encodeURIComponent("Only a coach can connect accounts."));
    const expected = req.cookies?.[OAUTH_COOKIE];
    res.clearCookie(OAUTH_COOKIE, { path: "/api/social/meta" });
    const state = String(req.query.state || "");
    if (!expected || !state || expected.length !== state.length ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(state))) {
      return back("error=" + encodeURIComponent("The connection attempt expired. Try again."));
    }
    if (req.query.error) return back("error=" + encodeURIComponent(String(req.query.error_description || req.query.error)));
    const result = await completeConnection(String(req.query.code || ""), req.userId!);
    back(`connected=${result.pages}&instagram=${result.instagram}`);
  } catch (e: any) {
    console.error("Meta connect failed:", e);
    back("error=" + encodeURIComponent(e?.message || "Connecting to Meta failed."));
  }
});

// ---- Uploads ----------------------------------------------------------------------------

function sniff(head: Buffer): "image/jpeg" | "video" | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  const box = head.subarray(4, 8).toString("latin1");
  if (["ftyp", "moov", "mdat", "wide", "free"].includes(box)) return "video";
  return null;
}

router.post("/social/uploads", async (req, res) => {
  const a = await access(req).catch(() => null);
  if (!a?.canSubmit) return res.status(403).json({ error: "Only Media Managers and Coaches can upload." });

  let bb: busboy.Busboy;
  try {
    bb = busboy({ headers: req.headers, limits: { files: 1, fileSize: LIMITS.videoMaxBytes + 1, fields: 10 } });
  } catch {
    return res.status(400).json({ error: "Expected a multipart upload." });
  }
  const fields: Record<string, string> = {};
  let upload: Promise<{ tmp: string; bytes: number; head: Buffer; mime: string; truncated: boolean }> | null = null;

  bb.on("field", (name, val) => { fields[name] = val; });
  bb.on("file", (_name, stream, info) => {
    const tmp = path.join(os.tmpdir(), `social-upload-${crypto.randomUUID()}`);
    upload = new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tmp);
      let bytes = 0;
      let head = Buffer.alloc(0);
      let truncated = false;
      stream.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16);
      });
      stream.on("limit", () => { truncated = true; });
      stream.pipe(out);
      out.on("finish", () => resolve({ tmp, bytes, head, mime: info.mimeType, truncated }));
      out.on("error", reject);
      stream.on("error", reject);
    });
  });
  bb.on("close", async () => {
    if (!upload) return res.status(400).json({ error: "No file received." });
    let tmp = "";
    try {
      const f = await upload;
      tmp = f.tmp;
      const sniffed = sniff(f.head);
      const kind = sniffed === "image/jpeg" ? "image" : sniffed === "video" ? "video" : null;
      if (!kind) return res.status(400).json({ error: "Only JPEG photos and MP4/MOV videos can be uploaded." });
      const contentType = kind === "image" ? "image/jpeg" : f.mime === "video/quicktime" ? "video/quicktime" : "video/mp4";
      const max = kind === "image" ? LIMITS.imageMaxBytes : LIMITS.videoMaxBytes;
      if (f.truncated || f.bytes > max) {
        return res.status(413).json({ error: `That ${kind} is larger than ${Math.round(max / 1024 / 1024)} MB.` });
      }
      const int = (v?: string) => {
        const n = v ? Math.round(Number(v)) : NaN;
        return Number.isFinite(n) && n > 0 ? n : null;
      };
      const ext = kind === "image" ? "jpg" : contentType === "video/quicktime" ? "mov" : "mp4";
      const storageKey = `${crypto.randomUUID()}.${ext}`;
      await mediaStore().put(storageKey, tmp);
      tmp = "";
      const [item] = await db.insert(socialMediaItems).values({
        uploaderId: req.userId!,
        kind,
        storageKey,
        contentType,
        bytes: f.bytes,
        width: int(fields.width),
        height: int(fields.height),
        durationSec: int(fields.durationSec),
      }).returning();
      res.status(201).json({
        id: item.id, kind, contentType, bytes: item.bytes, width: item.width, height: item.height,
        durationSec: item.durationSec, url: signedMediaUrl(storageKey, UI_MEDIA_TTL_SEC),
      });
    } catch (e) {
      fail(res, e);
    } finally {
      if (tmp) fsp.rm(tmp, { force: true }).catch(() => {});
    }
  });
  bb.on("error", () => { if (!res.headersSent) res.status(400).json({ error: "Upload failed." }); });
  req.pipe(bb);
});

/** Public (signed) media — Meta fetches from here; see server/social/signing.ts. */
router.get("/social/media/:file", async (req, res) => {
  const file = req.params.file;
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig || "");
  if (!isSafeKey(file) || !verifyMediaSignature(file, exp, sig)) return res.status(403).send("Link expired or invalid");
  try {
    const local = await mediaStore().localPath(file);
    res.sendFile(local, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    res.status(404).send("Not found");
  }
});

// ---- Posts ---------------------------------------------------------------------------------

router.get("/social/posts", async (req, res) => {
  try {
    const a = await access(req);
    if (!a.canSubmit) return res.status(403).json({ error: "Forbidden" });
    const view = (["mine", "queue", "calendar"].includes(String(req.query.view)) ? req.query.view : "mine") as PostView;
    if (view === "queue" && !a.isCoach) return res.status(403).json({ error: "Coaches only" });
    res.json(await serialize(await listPostRows(view, req.userId!)));
  } catch (e) { fail(res, e); }
});

router.get("/social/posts/:id", async (req, res) => {
  try {
    const a = await access(req);
    if (!a.canSubmit) return res.status(403).json({ error: "Forbidden" });
    const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, parseInt(req.params.id)));
    if (!post) return res.status(404).json({ error: "Not found" });
    // Drafts are private to their author until submitted.
    if (post.authorId !== req.userId && !a.isCoach && ["draft", "changes_requested", "submitted", "canceled"].includes(post.status)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const [serialized] = await serialize([post]);
    const events = await eventsFor(post.id);
    const names = await userNames(events.map((e) => e.actorId ?? -1));
    res.json({
      ...serialized,
      events: events.map((e) => ({ id: e.id, action: e.action, comment: e.comment, at: e.createdAt, actorName: e.actorId ? names.get(e.actorId) ?? null : null })),
    });
  } catch (e) { fail(res, e); }
});

router.post("/social/posts", async (req, res) => {
  try {
    if (!(await access(req)).canSubmit) return res.status(403).json({ error: "Only Media Managers and Coaches can create posts." });
    const id = await svc.createPost(req.userId!, req.body || {}, Boolean(req.body?.submit));
    res.status(201).json({ id });
  } catch (e) { fail(res, e); }
});

router.patch("/social/posts/:id", async (req, res) => {
  try {
    if (!(await access(req)).canSubmit) return res.status(403).json({ error: "Forbidden" });
    await svc.updatePost(req.userId!, parseInt(req.params.id), req.body || {}, Boolean(req.body?.submit));
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.post("/social/posts/:id/withdraw", async (req, res) => {
  try {
    if (!(await access(req)).canSubmit) return res.status(403).json({ error: "Forbidden" });
    await svc.withdrawPost(req.userId!, parseInt(req.params.id));
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.post("/social/posts/:id/cancel", async (req, res) => {
  try {
    const a = await access(req);
    if (!a.canSubmit) return res.status(403).json({ error: "Forbidden" });
    await svc.cancelPost(req.userId!, a.isCoach, parseInt(req.params.id));
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.post("/social/posts/:id/approve", async (req, res) => {
  try {
    if (!(await access(req)).isCoach) return res.status(403).json({ error: "Only coaches can approve posts." });
    await svc.approvePost(req.userId!, parseInt(req.params.id), req.body?.scheduledAt);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.post("/social/posts/:id/send-back", async (req, res) => {
  try {
    if (!(await access(req)).isCoach) return res.status(403).json({ error: "Only coaches can send posts back." });
    await svc.sendBackPost(req.userId!, parseInt(req.params.id), req.body?.comment);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.post("/social/posts/:id/unschedule", async (req, res) => {
  try {
    if (!(await access(req)).isCoach) return res.status(403).json({ error: "Only coaches can unschedule posts." });
    await svc.unschedulePost(req.userId!, parseInt(req.params.id));
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.post("/social/targets/:id/retry", async (req, res) => {
  try {
    if (!(await access(req)).isCoach) return res.status(403).json({ error: "Only coaches can retry publishing." });
    await svc.retryTarget(req.userId!, parseInt(req.params.id));
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

export default router;
