/**
 * Connecting the team's Facebook Page + linked Instagram account (Coach only).
 *
 *   Facebook Login → short-lived user token → long-lived user token →
 *   Page access token (does not expire when derived from a long-lived user
 *   token) → the Page's linked Instagram professional account.
 *
 * Instagram publishing uses the Page token of the Page it's linked to.
 */
import { graphGet, GRAPH_VERSION } from "./graph";
import { appBaseUrl } from "./signing";
import { upsertAccount } from "./store";

export const SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  // Lets a future "remove from Instagram" action DELETE published media.
  "instagram_manage_contents",
  "business_management",
];

export function metaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function redirectUri(): string {
  return `${appBaseUrl()}/api/social/meta/callback`;
}

export function buildLoginUrl(state: string): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", process.env.META_APP_ID || "");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

interface PageInfo {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
}

/** Exchange the OAuth code and store every Page (and linked IG account) the
 *  coach granted. Returns what was connected. */
export async function completeConnection(code: string, connectedBy: number): Promise<{ pages: number; instagram: number }> {
  const appParams = { client_id: process.env.META_APP_ID || "", client_secret: process.env.META_APP_SECRET || "" };
  const short = await graphGet("oauth/access_token", { ...appParams, redirect_uri: redirectUri(), code });
  const long = await graphGet("oauth/access_token", {
    ...appParams,
    grant_type: "fb_exchange_token",
    fb_exchange_token: String(short.access_token),
  });
  const pagesRes = await graphGet(
    "me/accounts",
    { fields: "id,name,access_token,instagram_business_account{id,username}" },
    String(long.access_token),
  );
  const pages = (pagesRes.data || []) as PageInfo[];

  let instagram = 0;
  for (const page of pages) {
    await upsertAccount({ platform: "facebook", externalId: page.id, name: page.name, token: page.access_token, connectedBy });
    const ig = page.instagram_business_account;
    if (ig?.id) {
      await upsertAccount({
        platform: "instagram",
        externalId: ig.id,
        name: ig.username ? `@${ig.username}` : `${page.name} (Instagram)`,
        token: page.access_token,
        connectedBy,
      });
      instagram++;
    }
  }
  return { pages: pages.length, instagram };
}
