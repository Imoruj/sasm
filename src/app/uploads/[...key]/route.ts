import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  ALLOWED_MIME_TYPES,
  getLocalUploadsRoot,
  isLocalMockStorage,
  isValidLocalUploadSignature,
  MAX_FILE_SIZE,
  resolveLocalUploadPath,
} from "@/lib/storage";

type RouteContext = { params: Promise<{ key: string[] }> };

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
};

function getContentType(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  if (!isLocalMockStorage()) {
    return NextResponse.json({ error: { message: "Local upload mock is not enabled" } }, { status: 404 });
  }

  const { key } = await params;
  const storageKey = key.join("/");
  const filePath = resolveLocalUploadPath(storageKey);
  const uploadsRoot = getLocalUploadsRoot();
  const expiresAt = Number(req.nextUrl.searchParams.get("expires"));
  const signature = req.nextUrl.searchParams.get("signature") ?? "";
  const contentType = req.headers.get("content-type")?.split(";")[0]?.trim() ?? "";

  if (!filePath.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: { message: "Invalid upload path" } }, { status: 400 });
  }
  if (!isValidLocalUploadSignature(storageKey, expiresAt, signature)) {
    return NextResponse.json({ error: { message: "Invalid or expired upload signature" } }, { status: 403 });
  }
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    return NextResponse.json({ error: { message: "File type not allowed" } }, { status: 415 });
  }

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length > MAX_FILE_SIZE) {
    return NextResponse.json({ error: { message: "File too large" } }, { status: 413 });
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);

  return new NextResponse(null, { status: 200 });
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  if (!isLocalMockStorage()) {
    return NextResponse.json({ error: { message: "Local upload mock is not enabled" } }, { status: 404 });
  }

  const { key } = await params;
  const storageKey = key.join("/");
  const filePath = resolveLocalUploadPath(storageKey);
  const uploadsRoot = getLocalUploadsRoot();

  if (!filePath.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: { message: "Invalid file path" } }, { status: 400 });
  }

  try {
    const file = await readFile(filePath);
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60",
        "Content-Type": getContentType(filePath),
      },
    });
  } catch {
    return NextResponse.json({ error: { message: "File not found" } }, { status: 404 });
  }
}
