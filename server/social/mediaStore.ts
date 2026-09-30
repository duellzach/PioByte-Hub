/**
 * Where uploaded photos/videos live.
 *
 * Production (Replit, REPLIT_DEPLOYMENT or SOCIAL_STORAGE=replit): Replit
 * Object Storage — the deployment's disk is wiped on every publish, so it
 * can't be the source of truth. Files are also cached on local disk, because
 * serving from a local path gets Range support (Meta fetches video in byte
 * ranges) and Content-Length for free via res.sendFile.
 *
 * Dev: a plain directory (SOCIAL_MEDIA_DIR, default .storage/social-media).
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface MediaStore {
  /** Take ownership of a finished upload at `srcPath` under `key`. */
  put(key: string, srcPath: string): Promise<void>;
  /** A local file path for `key`, fetching it from remote storage if needed. */
  localPath(key: string): Promise<string>;
  remove(key: string): Promise<void>;
}

/** Keys are `<uuid>.<ext>` — nothing that could escape the storage dir. */
export function isSafeKey(key: string): boolean {
  return /^[a-f0-9-]{36}\.(jpg|mp4|mov)$/.test(key);
}

function assertKey(key: string) {
  if (!isSafeKey(key)) throw new Error("Invalid media key");
}

class LocalStore implements MediaStore {
  constructor(private dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }
  async put(key: string, srcPath: string) {
    assertKey(key);
    const dest = path.join(this.dir, key);
    try {
      await fsp.rename(srcPath, dest);
    } catch {
      // Cross-device (tmp on another volume) — copy then remove.
      await fsp.copyFile(srcPath, dest);
      await fsp.rm(srcPath, { force: true });
    }
  }
  async localPath(key: string) {
    assertKey(key);
    const p = path.join(this.dir, key);
    await fsp.access(p);
    return p;
  }
  async remove(key: string) {
    assertKey(key);
    await fsp.rm(path.join(this.dir, key), { force: true });
  }
}

type ReplitClient = {
  uploadFromFilename(name: string, src: string): Promise<{ ok: boolean; error?: unknown }>;
  downloadToFilename(name: string, dest: string): Promise<{ ok: boolean; error?: unknown }>;
  delete(name: string, opts?: { ignoreNotFound?: boolean }): Promise<{ ok: boolean; error?: unknown }>;
};

class ReplitStore implements MediaStore {
  private client: Promise<ReplitClient>;
  private cache: string;
  private inflight = new Map<string, Promise<string>>();

  constructor() {
    this.cache = path.join(os.tmpdir(), "piobyte-social-cache");
    fs.mkdirSync(this.cache, { recursive: true });
    const bucketId = process.env.SOCIAL_MEDIA_BUCKET || undefined;
    this.client = import("@replit/object-storage").then(
      (m: any) => new m.Client(bucketId ? { bucketId } : undefined) as ReplitClient,
    );
  }
  private objectName(key: string) {
    return `social-media/${key}`;
  }
  async put(key: string, srcPath: string) {
    assertKey(key);
    const c = await this.client;
    const res = await c.uploadFromFilename(this.objectName(key), srcPath);
    if (!res.ok) throw new Error(`Object storage upload failed: ${String((res.error as any)?.message ?? res.error)}`);
    // Keep the upload as the local cache copy.
    const dest = path.join(this.cache, key);
    await fsp.copyFile(srcPath, dest).catch(() => {});
    await fsp.rm(srcPath, { force: true });
  }
  async localPath(key: string) {
    assertKey(key);
    const dest = path.join(this.cache, key);
    try {
      await fsp.access(dest);
      return dest;
    } catch { /* not cached */ }
    // Coalesce concurrent range requests for the same uncached file.
    let p = this.inflight.get(key);
    if (!p) {
      p = (async () => {
        const c = await this.client;
        const tmp = `${dest}.${process.pid}.part`;
        const res = await c.downloadToFilename(this.objectName(key), tmp);
        if (!res.ok) throw new Error(`Object storage download failed: ${String((res.error as any)?.message ?? res.error)}`);
        await fsp.rename(tmp, dest);
        return dest;
      })().finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }
  async remove(key: string) {
    assertKey(key);
    const c = await this.client;
    await c.delete(this.objectName(key), { ignoreNotFound: true });
    await fsp.rm(path.join(this.cache, key), { force: true });
  }
}

let store: MediaStore | null = null;

export function mediaStore(): MediaStore {
  if (!store) {
    const useReplit = process.env.SOCIAL_STORAGE
      ? process.env.SOCIAL_STORAGE === "replit"
      : Boolean(process.env.REPLIT_DEPLOYMENT);
    store = useReplit
      ? new ReplitStore()
      : new LocalStore(process.env.SOCIAL_MEDIA_DIR || path.resolve(".storage/social-media"));
  }
  return store;
}
