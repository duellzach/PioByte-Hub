/**
 * Thin Meta Graph API client. Pins the API version, normalizes failures into
 * `GraphError` (with Meta's code so callers can tell "reconnect the account"
 * from "retry later" from "permanent"), and keeps all Meta HTTP in one place.
 *
 * META_GRAPH_BASE_URL overrides the host for local end-to-end runs against a
 * fake Graph server; it is never set in production.
 */

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v24.0";

function base(video = false): string {
  const override = process.env.META_GRAPH_BASE_URL;
  if (override) return override.replace(/\/+$/, "");
  // Video uploads are documented against the graph-video host.
  return `https://${video ? "graph-video" : "graph"}.facebook.com/${GRAPH_VERSION}`;
}

export class GraphError extends Error {
  code?: number;
  subcode?: number;
  httpStatus: number;
  constructor(httpStatus: number, body: { message?: string; code?: number; error_subcode?: number }) {
    super(body.message || `Graph API error (HTTP ${httpStatus})`);
    this.name = "GraphError";
    this.httpStatus = httpStatus;
    this.code = body.code;
    this.subcode = body.error_subcode;
  }

  /** OAuthException (190) or 401 — the token is dead; the account must be reconnected. */
  get isAuthError(): boolean {
    return this.code === 190 || this.httpStatus === 401;
  }

  /** Rate limiting — back off and retry. */
  get isRateLimit(): boolean {
    return this.httpStatus === 429 || [4, 17, 32, 613].includes(this.code ?? -1);
  }

  /** Server-side or throttling failure — safe to retry. */
  get isTransient(): boolean {
    return this.httpStatus >= 500 || this.code === 1 || this.code === 2 || this.isRateLimit;
  }
}

async function parse(res: Response): Promise<any> {
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { error: { message: text.slice(0, 300) } }; }
  if (!res.ok) throw new GraphError(res.status, json.error || {});
  return json;
}

// The token is optional: the OAuth exchange endpoints authenticate with the
// app id/secret, and Meta rejects a request carrying an empty access_token.
export async function graphGet(path: string, params: Record<string, string>, token?: string): Promise<any> {
  const url = new URL(`${base()}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (token) url.searchParams.set("access_token", token);
  return parse(await fetch(url, { method: "GET" }));
}

export async function graphPost(
  path: string,
  params: Record<string, string>,
  token?: string,
  opts: { video?: boolean } = {},
): Promise<any> {
  const body = new URLSearchParams(params);
  if (token) body.set("access_token", token);
  return parse(await fetch(`${base(opts.video)}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  }));
}

export async function graphDelete(path: string, token: string): Promise<any> {
  const url = new URL(`${base()}/${path}`);
  url.searchParams.set("access_token", token);
  return parse(await fetch(url, { method: "DELETE" }));
}
