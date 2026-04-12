import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { z } from "zod";

const patchBodySchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  markAll: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const unreadOnly = searchParams.get("unread") === "true";
    const skip = (page - 1) * limit;

    const where = {
      userId: session.user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: { userId: session.user.id, isRead: false },
      }),
    ]);

    return NextResponse.json(
      ok({ notifications, total, unreadCount }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET_NOTIFICATIONS]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const body = await req.json();
    const validated = patchBodySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    const { ids, markAll } = validated.data;

    if (!markAll && (!ids || ids.length === 0)) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Provide either 'ids' or 'markAll: true'"),
        { status: 400 }
      );
    }

    const now = new Date();

    if (markAll) {
      await db.notification.updateMany({
        where: { userId: session.user.id, isRead: false },
        data: { isRead: true, readAt: now },
      });

      return NextResponse.json(ok({ updated: true }));
    }

    // Verify all given IDs belong to the current user before updating
    const owned = await db.notification.findMany({
      where: { id: { in: ids }, userId: session.user.id },
      select: { id: true },
    });

    const ownedIds = owned.map((n) => n.id);

    if (ownedIds.length === 0) {
      return NextResponse.json(
        err("NOT_FOUND", "No matching notifications found"),
        { status: 404 }
      );
    }

    await db.notification.updateMany({
      where: { id: { in: ownedIds } },
      data: { isRead: true, readAt: now },
    });

    return NextResponse.json(ok({ updated: true, count: ownedIds.length }));
  } catch (error) {
    console.error("[PATCH_NOTIFICATIONS]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
