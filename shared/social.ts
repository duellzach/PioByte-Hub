// Social media manager — the pure rules shared by the browser and the server:
// who may submit, the post/target state machines, what each platform accepts,
// and the retry/poll timing. Same reasoning as shared/roles.ts: the composer's
// warnings and the routes' 400s must come from ONE validator, or a student can
// build a post the UI calls fine and the server (or Meta) then rejects.
//
// Keep this file dependency-free — it's imported by the browser bundle.

/** Students who may compose and submit posts. Coaches approve (and can also submit). */
export const MEDIA_MANAGER_ROLE = 'Media Manager';
export const SOCIAL_SUBMIT_ROLES = [MEDIA_MANAGER_ROLE, 'Coach'];
export const SOCIAL_APPROVE_ROLES = ['Coach'];

export type SocialPlatform = 'instagram' | 'facebook';
export const SOCIAL_PLATFORMS: SocialPlatform[] = ['instagram', 'facebook'];

// ---- Post state machine -----------------------------------------------------

export type PostStatus =
  | 'draft'
  | 'submitted'
  | 'changes_requested'
  | 'approved'            // queued: publishes itself at scheduled_at
  | 'publishing'
  | 'published'
  | 'partially_published'
  | 'failed'
  | 'canceled';

const POST_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ['submitted', 'canceled'],
  submitted: ['approved', 'changes_requested', 'draft', 'canceled'],
  changes_requested: ['submitted', 'draft', 'canceled'],
  // → submitted: the author edited it, or a coach unscheduled it. Either way it
  // needs a fresh approval before it can go out.
  approved: ['publishing', 'submitted', 'changes_requested', 'canceled'],
  publishing: ['published', 'partially_published', 'failed'],
  // A coach retrying a failed platform puts the post back in flight.
  partially_published: ['publishing'],
  failed: ['publishing', 'canceled'],
  published: [],
  canceled: [],
};

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  return POST_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses in which the author may still change the content. Editing an
 *  approved post is allowed but drops it back to `submitted`. */
export const AUTHOR_EDITABLE: PostStatus[] = ['draft', 'changes_requested', 'submitted', 'approved'];

// ---- Target (one platform of one post) --------------------------------------

export type TargetStatus =
  | 'queued'              // waiting for scheduled_at
  | 'creating_container'  // IG: containers created, polling until FINISHED
  | 'publishing'          // the publish call is in flight
  | 'published'
  | 'failed'
  | 'canceled';

export const TARGET_TERMINAL: TargetStatus[] = ['published', 'failed', 'canceled'];

/** Roll a post's platform targets up into the post's status once publishing
 *  has begun. Returns null while anything is still in flight. */
export function rollupPostStatus(targets: TargetStatus[]): 'published' | 'partially_published' | 'failed' | null {
  const live = targets.filter((t) => t !== 'canceled');
  if (live.length === 0) return null;
  if (live.some((t) => !TARGET_TERMINAL.includes(t))) return null;
  const ok = live.filter((t) => t === 'published').length;
  if (ok === live.length) return 'published';
  return ok > 0 ? 'partially_published' : 'failed';
}

// ---- Timing -----------------------------------------------------------------

/** Transient-error retries per target before it is marked failed. */
export const MAX_PUBLISH_ATTEMPTS = 5;
/** Give up on an Instagram container that hasn't reached FINISHED. */
export const CONTAINER_TIMEOUT_MS = 30 * 60 * 1000;
/** How long a claimed target is locked; a crash mid-step frees it after this. */
export const CLAIM_LEASE_MS = 5 * 60 * 1000;
/** Signed media URLs handed to Meta must outlive a slow Reel transcode. */
export const MEDIA_URL_TTL_SEC = 2 * 60 * 60;
/** Instagram's rolling publish cap per account. */
export const IG_PUBLISHES_PER_24H = 25;

/** Retry delay after the Nth failed attempt (1-based): 30s, 1m, 2m, 4m… capped at 15m. */
export function retryDelayMs(attempt: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 15 * 60 * 1000);
}

/** Delay before the Nth container status poll (1-based): 5s doubling, capped at 5m. */
export function pollDelayMs(poll: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, poll - 1), 5 * 60 * 1000);
}

// ---- Media + content limits ---------------------------------------------------
// Conservative against Meta's published specs; one place to adjust.

export const LIMITS = {
  imageMaxBytes: 8 * 1024 * 1024,
  videoMaxBytes: 300 * 1024 * 1024,
  imageTypes: ['image/jpeg'],                 // the composer converts everything to JPEG
  videoTypes: ['video/mp4', 'video/quicktime'],
  maxItems: 10,
  igCaption: 2200,
  igHashtags: 30,
  fbCaption: 63206,
  igAspectMin: 4 / 5,                         // tallest feed image IG accepts
  igAspectMax: 1.91,                          // widest
  reelMinSec: 3,
  reelMaxSec: 15 * 60,
  carouselVideoMaxSec: 60,
  altText: 1000,
};

export interface MediaInfo {
  kind: 'image' | 'video';
  contentType: string;
  bytes: number;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
}

export interface PostDraft {
  caption: string;
  platforms: SocialPlatform[];
  media: MediaInfo[];
}

export function countHashtags(caption: string): number {
  return (caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).length;
}

/** Everything wrong with a post for the platforms it targets. Empty = OK. */
export function validatePost(p: PostDraft): string[] {
  const errs: string[] = [];
  const images = p.media.filter((m) => m.kind === 'image');
  const videos = p.media.filter((m) => m.kind === 'video');

  if (p.platforms.length === 0) errs.push('Pick at least one account to post to.');
  if (p.media.length > LIMITS.maxItems) errs.push(`At most ${LIMITS.maxItems} photos/videos per post.`);
  if (!p.caption.trim() && p.media.length === 0) errs.push('Add a caption or some media.');

  for (const m of p.media) {
    const allowed = m.kind === 'image' ? LIMITS.imageTypes : LIMITS.videoTypes;
    if (!allowed.includes(m.contentType)) errs.push(`Unsupported file type ${m.contentType}.`);
    const max = m.kind === 'image' ? LIMITS.imageMaxBytes : LIMITS.videoMaxBytes;
    if (m.bytes > max) errs.push(`A ${m.kind} is larger than ${Math.round(max / 1024 / 1024)} MB.`);
  }

  if (p.platforms.includes('instagram')) {
    if (p.media.length === 0) errs.push('Instagram posts need at least one photo or video.');
    if (p.caption.length > LIMITS.igCaption) errs.push(`Instagram captions are limited to ${LIMITS.igCaption} characters.`);
    if (countHashtags(p.caption) > LIMITS.igHashtags) errs.push(`Instagram allows at most ${LIMITS.igHashtags} hashtags.`);
    for (const m of images) {
      if (m.width && m.height) {
        const r = m.width / m.height;
        if (r < LIMITS.igAspectMin - 0.01 || r > LIMITS.igAspectMax + 0.01) {
          errs.push('Instagram photos must be between 4:5 (portrait) and 1.91:1 (landscape). Crop the photo and re-upload it.');
          break;
        }
      }
    }
    const carousel = p.media.length > 1;
    for (const v of videos) {
      if (v.durationSec == null) continue;
      if (carousel && v.durationSec > LIMITS.carouselVideoMaxSec) {
        errs.push(`Videos inside an Instagram carousel must be ${LIMITS.carouselVideoMaxSec} seconds or shorter.`);
        break;
      }
      if (!carousel && (v.durationSec < LIMITS.reelMinSec || v.durationSec > LIMITS.reelMaxSec)) {
        errs.push('Instagram Reels must be between 3 seconds and 15 minutes long.');
      }
    }
  }

  if (p.platforms.includes('facebook')) {
    if (p.caption.length > LIMITS.fbCaption) errs.push('The caption is too long for Facebook.');
    if (videos.length > 0 && images.length > 0) {
      errs.push("Facebook can't mix photos and a video in one post. Post to Instagram only, or split it into two posts.");
    } else if (videos.length > 1) {
      errs.push('Facebook posts can include only one video.');
    }
  }

  return [...new Set(errs)];
}

/** What kind of publish a target will perform — shown in the UI and used by the worker. */
export function describeShape(platform: SocialPlatform, media: Pick<MediaInfo, 'kind'>[]): string {
  if (media.length === 0) return 'Text post';
  if (media.length > 1) return platform === 'instagram' ? `Carousel (${media.length})` : `${media.length} photos`;
  if (media[0].kind === 'video') return platform === 'instagram' ? 'Reel' : 'Video';
  return 'Photo';
}
