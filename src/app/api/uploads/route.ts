import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ok, err } from "@/types/api";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, uploadFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null;

    if (!file || !folder) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "file and folder fields are required"),
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "File type not allowed. Accepted: PDF, JPG, PNG, DOCX"),
        { status: 415 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "File too large. Maximum size is 5 MB"),
        { status: 413 },
      );
    }

    const scoped = `${session.user.id}/${folder}`;
    const result = await uploadFile(scoped, file.name, file, file.type);

    return NextResponse.json(ok(result));
  } catch (error) {
    console.error("[UPLOAD]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Upload failed"), { status: 500 });
  }
}
