import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { adminLimiter } from "@/lib/ratelimit";
import { sendApplicationStatusEmail } from "@/lib/email";

export async function POST(
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
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    const application = await db.application.findFirst({
      where: {
        id,
        // SUPER_ADMIN can act on any application; SCHOOL_ADMIN is scoped to their org
        ...(isSuperAdmin
          ? {}
          : {
              organizationId: session.user.organizationId ?? "",
            }),
      },
      include: {
        applicant: { select: { email: true, firstName: true } },
        organization: { select: { name: true } },
        payments: {
          where: { paymentType: "ADMISSION_FEE", status: "PAID" },
          take: 1,
        },
      },
    });

    if (!application) {
      console.error("[ENROLL_APPLICATION] Application not found", {
        applicationId: id,
        requestedBy: session.user.id,
        role: session.user.role,
      });
      return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    }

    if (application.status !== "ADMITTED") {
      return NextResponse.json(
        err("INVALID_STATE", "Only ADMITTED applications can be enrolled"),
        { status: 400 },
      );
    }

    // Verify acceptance fee has been paid
    if (application.payments.length === 0) {
      return NextResponse.json(
        err("PAYMENT_REQUIRED", "Acceptance fee must be paid before enrollment"),
        { status: 400 },
      );
    }

    const now = new Date();

    await db.$transaction([
      db.application.update({
        where: { id },
        data: { status: "ENROLLED" },
      }),
      db.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: "ADMITTED",
          toStatus: "ENROLLED",
          changedBy: session.user.id,
          reason: "Student enrolled by admin",
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: application.organizationId,
          action: "APPLICATION_ENROLLED",
          entityType: "Application",
          entityId: id,
          changes: { before: { status: "ADMITTED" }, after: { status: "ENROLLED" } },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    // Fire-and-forget enrollment notification
    sendApplicationStatusEmail(
      application.applicant.email,
      application.applicant.firstName ?? "Applicant",
      application.applicationNumber,
      "ENROLLED",
      `Congratulations! ${application.studentFirstName ?? "Your child"} has been officially enrolled at ${application.organization?.name ?? "the school"}. Welcome to the school family!`,
      application.organization?.name ?? "School",
    ).catch((e) => console.error("[EMAIL_ENROLLED]", e));

    return NextResponse.json(ok({ status: "ENROLLED", enrolledAt: now }));
  } catch (error) {
    console.error("[ENROLL_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
