import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({
  region: process.env.STORAGE_REGION ?? "us-east-1",
  ...(process.env.STORAGE_ENDPOINT
    ? { endpoint: process.env.STORAGE_ENDPOINT, forcePathStyle: true }
    : {}),
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.STORAGE_BUCKET!;
const PUBLIC_URL = (process.env.STORAGE_PUBLIC_URL ?? "").replace(/\/$/, "");
const LOCAL_UPLOADS_ROOT = path.join(process.cwd(), ".local-storage", "uploads");
const IS_LOCAL_MOCK_STORAGE = /^https?:\/\/localhost(?::\d+)?\/uploads$/i.test(PUBLIC_URL);
const LOCAL_UPLOAD_SECRET = process.env.AUTH_SECRET ?? process.env.STORAGE_SECRET_ACCESS_KEY ?? "local-upload-secret";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function buildPublicUrl(key: string): string {
  return PUBLIC_URL ? `${PUBLIC_URL}/${key}` : key;
}

function signLocalUpload(key: string, expiresAt: number): string {
  return createHmac("sha256", LOCAL_UPLOAD_SECRET)
    .update(`${key}:${expiresAt}`)
    .digest("hex");
}

function normalizeStorageKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

export function isLocalMockStorage(): boolean {
  return IS_LOCAL_MOCK_STORAGE;
}

export function getLocalUploadsRoot(): string {
  return LOCAL_UPLOADS_ROOT;
}

export function resolveLocalUploadPath(key: string): string {
  const normalized = normalizeStorageKey(key);
  return path.join(LOCAL_UPLOADS_ROOT, ...normalized.split("/"));
}

export function isValidLocalUploadSignature(key: string, expiresAt: number, signature: string): boolean {
  if (!IS_LOCAL_MOCK_STORAGE || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  const expected = signLocalUpload(normalizeStorageKey(key), expiresAt);
  if (signature.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/** Generate a presigned URL for client-side upload */
export async function getUploadPresignedUrl(
  folder: string,
  fileName: string,
  contentType: string,
  expiresIn = 300,
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const ext = fileName.split(".").pop();
  const key = `${folder}/${uuidv4()}.${ext}`;

  if (IS_LOCAL_MOCK_STORAGE) {
    const normalizedKey = normalizeStorageKey(key);
    const expiresAt = Date.now() + expiresIn * 1000;
    const signature = signLocalUpload(normalizedKey, expiresAt);
    const uploadUrl = `/uploads/${normalizedKey}?expires=${expiresAt}&signature=${signature}`;
    const publicUrl = buildPublicUrl(normalizedKey);

    await mkdir(path.dirname(resolveLocalUploadPath(normalizedKey)), { recursive: true });
    return { uploadUrl, key: normalizedKey, publicUrl };
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: undefined,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn });
  const publicUrl = buildPublicUrl(key);

  return { uploadUrl, key, publicUrl };
}

/** Generate a presigned URL for downloading/viewing a file */
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn = 900,
): Promise<string> {
  if (IS_LOCAL_MOCK_STORAGE) {
    return buildPublicUrl(normalizeStorageKey(key));
  }

  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

/** Delete a file from storage */
export async function deleteFile(key: string): Promise<void> {
  if (IS_LOCAL_MOCK_STORAGE) {
    await rm(resolveLocalUploadPath(key), { force: true });
    return;
  }

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Extract storage key from a full URL */
export function extractKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!PUBLIC_URL) return url;
  return url.startsWith(PUBLIC_URL) ? url.replace(`${PUBLIC_URL}/`, "") : url;
}
