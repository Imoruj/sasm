import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rejectApplicationSchema } from "@/validators/adminSchema";
import { ok, err } from "@/types/api";
import { sendApplicationStatusEmail } from "@/lib/email";
import { adminLimiter } from "@/lib/ratelimit";

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
    const body = await req.json();
    const validated = rejectApplicationSchema.safeParse({ ...body, applicationId: id });
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
    }

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    const application = await db.application.findFirst({
      where: {
        id,
        // SUPER_ADMIN can act on any application; SCHOOL_ADMIN is scoped to their org
        ...(isSuperAdmin ? {} : { organizationId: session.user.organizationId ?? "" }),
      },
      include: {
        applicant: { select: { email: true, firstName: true } },
        organization: { select: { name: true } },
      },
    });

    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    if (application.status === "REJECTED") {
      return NextResponse.json(err("INVALID_STATE", "Application is already rejected"), { status: 400 });
    }

    const [updated] = await db.$transaction([
      db.application.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: validated.data.rejectionReason,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
      }),
      db.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: "REJECTED",
          changedBy: session.user.id,
          reason: validated.data.rejectionReason,
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "APPLICATION_REJECTED",
          entityType: "Application",
          entityId: id,
          changes: { before: { status: application.status }, after: { status: "REJECTED" } },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    // Fire-and-forget email notification
    sendApplicationStatusEmail(
      application.applicant.email,
      application.applicant.firstName ?? "Applicant",
      application.applicationNumber,
      "REJECTED",
      `Your application has been rejected. Reason: ${validated.data.rejectionReason}`,
      application.organization?.name ?? "School",
    ).catch((e) => console.error("[EMAIL_REJECT]", e));

    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("[REJECT_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
