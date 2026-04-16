import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { ok, err } from "@/types/api";
import { deleteFile, extractKeyFromUrl } from "@/lib/storage";

const schema = z.object({
  avatarUrl: z.string().url("Invalid URL"),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()), { status: 422 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });

  const newAvatarUrl = parsed.data.avatarUrl;
  const oldKey = user?.avatarUrl && user.avatarUrl !== newAvatarUrl
    ? extractKeyFromUrl(user.avatarUrl)
    : null;

  await db.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: newAvatarUrl },
  });

  if (oldKey) {
    try {
      await deleteFile(oldKey);
    } catch (error) {
      console.error("[AVATAR_CLEANUP_ERROR]", error);
      // Don't fail the request if cleanup fails, but log it
    }
  }

  return NextResponse.json(ok({ avatarUrl: newAvatarUrl }));
}
