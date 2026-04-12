import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUploadPresignedUrl, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/storage";
import { ok, err } from "@/types/api";
import { z } from "zod";

const presignSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().refine((t) => ALLOWED_MIME_TYPES.includes(t), "File type not allowed"),
  folder: z.string().min(1).max(50),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const body = await req.json();
    const validated = presignSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid request", validated.error.flatten()), { status: 400 });
    }

    const { fileName, contentType, folder } = validated.data;
    const scoped = `${session.user.id}/${folder}`;
    const result = await getUploadPresignedUrl(scoped, fileName, contentType);

    return NextResponse.json(ok(result));
  } catch (error) {
    console.error("[PRESIGN_UPLOAD]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Failed to generate upload URL."), { status: 500 });
  }
}
