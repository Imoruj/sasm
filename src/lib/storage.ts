import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const LOCAL_UPLOADS_ROOT = path.join(process.cwd(), ".local-storage", "uploads");
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LOCAL_UPLOAD_SECRET = process.env.AUTH_SECRET ?? "local-upload-secret";

// Use local filesystem when BLOB_READ_WRITE_TOKEN is not configured (local dev)
export const IS_LOCAL_STORAGE = !process.env.BLOB_READ_WRITE_TOKEN;

export function isLocalMockStorage(): boolean {
  return IS_LOCAL_STORAGE;
}

export function getLocalUploadsRoot(): string {
  return LOCAL_UPLOADS_ROOT;
}

export function resolveLocalUploadPath(key: string): string {
  const normalized = normalizeStorageKey(key);
  return path.join(LOCAL_UPLOADS_ROOT, ...normalized.split("/"));
}

export function normalizeStorageKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

function signLocalUpload(key: string, expiresAt: number): string {
  return createHmac("sha256", LOCAL_UPLOAD_SECRET)
    .update(`${key}:${expiresAt}`)
    .digest("hex");
}

export function isValidLocalUploadSignature(
  key: string,
  expiresAt: number,
  signature: string,
): boolean {
  if (!IS_LOCAL_STORAGE || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }
  const expected = signLocalUpload(normalizeStorageKey(key), expiresAt);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Upload a file server-side.
 * Production: Vercel Blob (requires BLOB_READ_WRITE_TOKEN).
 * Dev: local .local-storage/uploads/ directory.
 */
export async function uploadFile(
  folder: string,
  fileName: string,
  data: Buffer | Blob | File,
  contentType: string,
): Promise<{ key: string; publicUrl: string }> {
  const ext = fileName.split(".").pop() ?? "bin";
  const key = `${folder}/${uuidv4()}.${ext}`;

  if (IS_LOCAL_STORAGE) {
    const normalized = normalizeStorageKey(key);
    const filePath = resolveLocalUploadPath(normalized);
    await mkdir(path.dirname(filePath), { recursive: true });
    const buffer =
      data instanceof Buffer
        ? data
        : Buffer.from(await (data as Blob).arrayBuffer());
    await writeFile(filePath, buffer);
    const publicUrl = `${APP_URL}/uploads/${normalized}`;
    return { key: normalized, publicUrl };
  }

  const { put } = await import("@vercel/blob");
  const blob = await put(key, data, { access: "public", contentType });
  return { key: blob.url, publicUrl: blob.url };
}

/** Delete a file from storage by its public URL. */
export async function deleteFile(url: string): Promise<void> {
  if (IS_LOCAL_STORAGE) {
    try {
      const key = url.replace(/^.*\/uploads\//, "");
      await rm(resolveLocalUploadPath(key), { force: true });
    } catch {
      // Ignore local delete errors
    }
    return;
  }
  const { del } = await import("@vercel/blob");
  await del(url);
}

/**
 * Extract storage key from a URL.
 * With Vercel Blob, the full URL is the key used for deletion.
 */
export function extractKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url;
}
