import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { adminLimiter } from "@/lib/ratelimit";
import { startApplicationReviewSchema } from "@/validators/adminSchema";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await adminLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Insufficient permissions"), { status: 403 });
    }

    const { id } = await params;
    const validated = startApplicationReviewSchema.safeParse({ applicationId: id });
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
    }

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    const application = await db.application.findFirst({
      where: {
        id,
        ...(isSuperAdmin ? {} : { organizationId: session.user.organizationId ?? "" }),
      },
      select: { id: true, status: true },
    });

    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    if (application.status !== "SUBMITTED") {
      return NextResponse.json(err("INVALID_STATE", "Only submitted applications can be moved to under review"), { status: 400 });
    }

    const [updated] = await db.$transaction([
      db.application.update({
        where: { id },
        data: { status: "UNDER_REVIEW" },
      }),
      db.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: "UNDER_REVIEW",
          changedBy: session.user.id,
          reason: "Review started",
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "APPLICATION_REVIEW_STARTED",
          entityType: "Application",
          entityId: id,
          changes: { before: { status: application.status }, after: { status: "UNDER_REVIEW" } },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("[START_APPLICATION_REVIEW]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

