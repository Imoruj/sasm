import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestRevisionSchema } from "@/validators/adminSchema";
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
    const validated = requestRevisionSchema.safeParse({ ...body, applicationId: id });
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
      },
    });

    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    if (!["SUBMITTED", "UNDER_REVIEW"].includes(application.status)) {
      return NextResponse.json(
        err("INVALID_STATE", "Revision can only be requested for submitted or under-review applications"),
        { status: 400 }
      );
    }

    const [updated] = await db.$transaction([
      db.application.update({
        where: { id },
        data: {
          status: "REVISION_REQUIRED",
          revisionFeedback: validated.data.revisionFeedback,
          adminNotes: validated.data.adminNotes ?? application.adminNotes,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
      }),
      db.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: "REVISION_REQUIRED",
          changedBy: session.user.id,
          reason: validated.data.adminNotes ?? "Revision requested",
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "APPLICATION_REVISION_REQUESTED",
          entityType: "Application",
          entityId: id,
          changes: { before: { status: application.status }, after: { status: "REVISION_REQUIRED" } },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    // Fire-and-forget email notification
    const feedbackMsg = validated.data.adminNotes
      ? `Feedback from admin: ${validated.data.adminNotes}`
      : "Please log in to your dashboard to review the requested changes and resubmit your application.";

    sendApplicationStatusEmail(
      application.applicant.email,
      application.applicant.firstName ?? "Applicant",
      application.applicationNumber,
      "REVISION REQUIRED",
      feedbackMsg,
    ).catch((e) => console.error("[EMAIL_REVISION]", e));

    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("[REVISION_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
