/**
 * Meta publishing calls — side-effecting wrappers over the Graph client. The
 * sequencing (when to create, poll, publish, retry) lives in worker.ts.
 *
 * Instagram has no native scheduling: create a container per item → poll until
 * FINISHED → (carousel: create the parent container → poll) → media_publish.
 * Facebook publishes in one call per post (multi-photo: stage unpublished
 * photos, then attach them to one feed post).
 */
import { graphGet, graphPost } from "./graph";

// ---- Instagram ----------------------------------------------------------------

export interface IgItem {
  kind: "image" | "video";
  url: string;
}

/** A single-item post (photo, or a video published as a Reel) or one carousel child. */
export async function createIgItemContainer(
  igUserId: string,
  token: string,
  item: IgItem,
  opts: { caption?: string; carouselItem?: boolean },
): Promise<string> {
  const params: Record<string, string> = {};
  if (item.kind === "image") {
    params.image_url = item.url;
  } else {
    params.media_type = opts.carouselItem ? "VIDEO" : "REELS";
    params.video_url = item.url;
  }
  if (opts.carouselItem) params.is_carousel_item = "true";
  else if (opts.caption) params.caption = opts.caption;
  const res = await graphPost(`${igUserId}/media`, params, token);
  return String(res.id);
}

export async function createIgCarouselContainer(
  igUserId: string,
  token: string,
  childIds: string[],
  caption: string,
): Promise<string> {
  const params: Record<string, string> = { media_type: "CAROUSEL", children: childIds.join(",") };
  if (caption) params.caption = caption;
  const res = await graphPost(`${igUserId}/media`, params, token);
  return String(res.id);
}

/** IN_PROGRESS | FINISHED | PUBLISHED | ERROR | EXPIRED */
export async function igContainerStatus(containerId: string, token: string): Promise<{ status: string; detail?: string }> {
  const res = await graphGet(containerId, { fields: "status_code,status" }, token);
  return { status: String(res.status_code), detail: res.status ? String(res.status) : undefined };
}

export async function publishIgContainer(igUserId: string, token: string, creationId: string): Promise<string> {
  const res = await graphPost(`${igUserId}/media_publish`, { creation_id: creationId }, token);
  return String(res.id);
}

export async function igPermalink(mediaId: string, token: string): Promise<string | null> {
  try {
    const res = await graphGet(mediaId, { fields: "permalink" }, token);
    return res.permalink ? String(res.permalink) : null;
  } catch {
    return null; // cosmetic — never fail a publish over the link
  }
}

// ---- Facebook -----------------------------------------------------------------

export interface FbPost {
  pageId: string;
  token: string;
  message: string;
  images: string[];   // public URLs
  video?: string;     // public URL (never combined with images — see shared/social.ts)
}

/** Publish a Page post now. Returns the post (or video) id. */
export async function publishFacebook(p: FbPost): Promise<string> {
  if (p.video) {
    const res = await graphPost(`${p.pageId}/videos`, { file_url: p.video, description: p.message }, p.token, { video: true });
    return String(res.id);
  }
  if (p.images.length === 1) {
    const res = await graphPost(`${p.pageId}/photos`, { url: p.images[0], caption: p.message }, p.token);
    return String(res.post_id ?? res.id);
  }
  const params: Record<string, string> = { message: p.message };
  if (p.images.length > 1) {
    // Stage each photo unpublished, then attach them all to one feed post.
    const ids: string[] = [];
    for (const url of p.images) {
      const res = await graphPost(`${p.pageId}/photos`, { url, published: "false" }, p.token);
      ids.push(String(res.id));
    }
    ids.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
  }
  const res = await graphPost(`${p.pageId}/feed`, params, p.token);
  return String(res.id);
}

export async function fbPermalink(objectId: string, token: string): Promise<string | null> {
  try {
    const res = await graphGet(objectId, { fields: "permalink_url" }, token);
    const link = res.permalink_url ? String(res.permalink_url) : null;
    return link && link.startsWith("/") ? `https://www.facebook.com${link}` : link;
  } catch {
    return null;
  }
}
