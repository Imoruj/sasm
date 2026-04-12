import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { id } = await params;

    // Verify ownership before updating
    const notification = await db.notification.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, isRead: true },
    });

    if (!notification) {
      return NextResponse.json(err("NOT_FOUND", "Notification not found"), { status: 404 });
    }

    if (notification.isRead) {
      // Already read — return success without an extra write
      return NextResponse.json(ok({ updated: false, alreadyRead: true }));
    }

    const updated = await db.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("[PATCH_NOTIFICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
