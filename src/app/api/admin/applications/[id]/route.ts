import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { adminLimiter } from "@/lib/ratelimit";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const application = await db.application.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId ?? "",
        ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
      },
      select: { id: true, applicationNumber: true, status: true },
    });

    if (!application) {
      return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    }

    if (["ENROLLED", "ADMITTED"].includes(application.status)) {
      return NextResponse.json(
        err("FORBIDDEN", "Cannot delete an admitted or enrolled application"),
        { status: 403 },
      );
    }

    await db.application.delete({ where: { id } });

    db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: session.user.organizationId ?? "",
        action: "APPLICATION_DELETED",
        entityType: "Application",
        entityId: id,
        changes: { applicationNumber: application.applicationNumber, status: application.status },
        ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
        userAgent: req.headers.get("user-agent") ?? "",
      },
    }).catch((e) => console.error("[AUDIT_LOG_ERROR]", e));

    return NextResponse.json(ok({ id }));
  } catch (error) {
    console.error("[DELETE_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
