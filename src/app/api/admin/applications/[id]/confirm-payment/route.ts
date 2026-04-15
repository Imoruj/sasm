import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { sendApplicationSubmittedEmail } from "@/lib/email";
import { adminLimiter } from "@/lib/ratelimit";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await adminLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Admin access required"), { status: 403 });
    }

    const { id } = await params;

    const application = await db.application.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId ?? "",
        ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
        status: "DRAFT",
      },
      include: {
        applicant: { select: { email: true, firstName: true } },
        branch: { select: { name: true } },
      },
    });

    if (!application) {
      return NextResponse.json(err("NOT_FOUND", "Application not found or not in DRAFT status"), { status: 404 });
    }
    if (!application.paymentEvidenceUrl) {
      return NextResponse.json(err("VALIDATION_ERROR", "No payment evidence uploaded yet"), { status: 400 });
    }

    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId ?? "" },
      select: { name: true },
    });

    const now = new Date();

    await db.$transaction([
      db.application.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          paymentStatus: "PAID",
          paymentConfirmedAt: now,
          paymentConfirmedBy: session.user.id,
          submittedAt: now,
          reviewedBy: session.user.id,
          reviewedAt: now,
        },
      }),
      db.applicationStatusHistory.create({
        data: {
          applicationId: id,
          toStatus: "SUBMITTED",
          changedBy: session.user.id,
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "PAYMENT_CONFIRMED",
          entityType: "Application",
          entityId: id,
          changes: { confirmedBy: session.user.id, at: now.toISOString() },
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    // Send submission confirmation email (fire-and-forget)
    sendApplicationSubmittedEmail(
      application.applicant.email,
      application.applicant.firstName,
      application.applicationNumber,
      org?.name ?? "School",
    ).catch((e) => console.error("[SUBMITTED_EMAIL]", e));

    return NextResponse.json(ok({ message: "Payment confirmed and application submitted" }));
  } catch (error) {
    console.error("[CONFIRM_PAYMENT]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
