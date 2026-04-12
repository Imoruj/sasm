import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { approveApplicationSchema } from "@/validators/adminSchema";
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
    const validated = approveApplicationSchema.safeParse({ ...body, applicationId: id });
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input"), { status: 400 });
    }

    const application = await db.application.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId ?? "",
        ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
      },
      include: {
        applicant: { select: { email: true, firstName: true } },
      },
    });

    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    if (!["SUBMITTED", "UNDER_REVIEW"].includes(application.status)) {
      return NextResponse.json(err("INVALID_STATE", "Application cannot be approved in its current state"), { status: 400 });
    }

    const [updated] = await db.$transaction([
      db.application.update({
        where: { id },
        data: {
          status: "APPROVED",
          adminNotes: validated.data.adminNotes,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
      }),
      db.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: "APPROVED",
          changedBy: session.user.id,
          reason: validated.data.adminNotes,
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "APPLICATION_APPROVED",
          entityType: "Application",
          entityId: id,
          changes: { before: { status: application.status }, after: { status: "APPROVED" } },
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
      "APPROVED",
      validated.data.adminNotes
        ? `Admin notes: ${validated.data.adminNotes}`
        : "Congratulations! Your application has been approved and you are now eligible for exam scheduling.",
    ).catch((e) => console.error("[EMAIL_APPROVE]", e));

    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("[APPROVE_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
