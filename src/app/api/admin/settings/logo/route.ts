import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { ok, err } from "@/types/api";
import { deleteFile, extractKeyFromUrl } from "@/lib/storage";

const schema = z.object({
  logoUrl: z.string().url("Invalid URL"),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json(err("UNAUTHORIZED", "Unauthorized"), { status: 401 });
  }
  if (!session.user.organizationId) {
    return NextResponse.json(err("NOT_FOUND", "No organisation linked"), { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()), { status: 422 });
  }

  const organization = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { logoUrl: true },
  });

  const newLogoUrl = parsed.data.logoUrl;
  const oldKey = organization?.logoUrl && organization.logoUrl !== newLogoUrl
    ? extractKeyFromUrl(organization.logoUrl)
    : null;

  await db.organization.update({
    where: { id: session.user.organizationId! },
    data: { logoUrl: newLogoUrl },
  });

  if (oldKey) {
    try {
      await deleteFile(oldKey);
    } catch (error) {
      console.error("[LOGO_CLEANUP_ERROR]", error);
      // Don't fail the request if cleanup fails, but log it
    }
  }

  return NextResponse.json(ok({ logoUrl: newLogoUrl }));
}
