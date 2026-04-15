import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { adminLimiter } from "@/lib/ratelimit";
import { sendEnrollmentConfirmationEmail } from "@/lib/email";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
});

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

    const rawBody = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Provide action: 'approve' or 'reject'"),
        { status: 400 },
      );
    }
    const { action } = parsed.data;

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    // Verify application belongs to this org/branch and is ADMITTED
    const application = await db.application.findFirst({
      where: {
        id,
        status: "ADMITTED",
    // SUPER_ADMIN can act on any application; SCHOOL_ADMIN is scoped to their org
        ...(isSuperAdmin
          ? {}
          : {
              organizationId: session.user.organizationId ?? "",
            }),
      },
      select: {
        id: true,
        organizationId: true,
        applicationNumber: true,
        studentFirstName: true,
        studentLastName: true,
        classApplied: true,
        documents: { select: { id: true } },
        applicant: { select: { id: true, email: true, firstName: true } },
        branch: { select: { name: true } },
        admissionCycle: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });

    if (!application) {
      console.error("[CONFIRM_ADMISSION_PAYMENT] Application not found or not ADMITTED", {
        applicationId: id,
        requestedBy: session.user.id,
        role: session.user.role,
        orgId: session.user.organizationId,
        branchId: session.user.branchId,
      });
      return NextResponse.json(
        err("NOT_FOUND", "Application not found or not in ADMITTED status"),
        { status: 404 },
      );
    }

    // Find the pending BANK_TRANSFER payment with a receipt
    const pendingPayment = await db.payment.findFirst({
      where: {
        applicationId: id,
        paymentType: "ADMISSION_FEE",
        gateway: "BANK_TRANSFER",
        status: "PENDING",
      },
    });
    if (!pendingPayment) {
      return NextResponse.json(
        err("NOT_FOUND", "No pending bank transfer payment found for this application"),
        { status: 404 },
      );
    }
    if (!pendingPayment.receiptUrl) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "No payment receipt has been uploaded yet"),
        { status: 400 },
      );
    }

    const now = new Date();

    if (action === "approve") {
      const updatedPayment = await db.payment.update({
        where: { id: pendingPayment.id },
        data: { status: "PAID", paidAt: now },
      });

      await db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: application.organizationId,
          action: "ADMISSION_PAYMENT_CONFIRMED",
          entityType: "Payment",
          entityId: updatedPayment.id,
          changes: { paymentId: updatedPayment.id, applicationId: id, confirmedAt: now.toISOString() },
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") ?? "",
        },
      });

      // Check if all documents are already verified → auto-enroll
      if (application.documents.length > 0) {
        const verifiedCount = await db.applicationDocument.count({
          where: { applicationId: id, isVerified: true },
        });

        if (verifiedCount === application.documents.length) {
          await db.application.update({
            where: { id },
            data: { status: "ENROLLED" },
          });

          await db.applicationStatusHistory.create({
            data: {
              applicationId: id,
              toStatus: "ENROLLED",
              changedBy: session.user.id,
              reason: "Bank transfer admission fee confirmed. All documents already verified. Student auto-enrolled.",
            },
          });

          await db.notification.create({
            data: {
              userId: application.applicant.id,
              type: "IN_APP",
              category: "APPLICATION_UPDATE",
              title: "Admission Confirmed — You are Enrolled!",
              message: `Congratulations! Your admission fee has been confirmed and all documents verified. Your child has been officially enrolled at ${application.organization.name}.`,
              data: { applicationId: id, link: "/dashboard/applications" },
              deliveryStatus: "PENDING",
            },
          });

          sendEnrollmentConfirmationEmail(
            application.applicant.email,
            application.applicant.firstName ?? "Parent",
            `${application.studentFirstName ?? ""} ${application.studentLastName ?? ""}`.trim(),
            application.applicationNumber,
            application.organization.name,
            application.branch.name,
            application.classApplied ?? undefined,
          ).catch((e) => console.error("[ENROLLMENT_EMAIL_ON_BANK_CONFIRM]", e));

          return NextResponse.json(ok({ message: "Payment confirmed. All documents verified — student enrolled!", enrolled: true }));
        }
      }

      return NextResponse.json(ok({ message: "Payment confirmed successfully", enrolled: false }));
    }

    // reject — mark FAILED so the parent can re-upload a valid receipt
    const updatedPayment = await db.payment.update({
      where: { id: pendingPayment.id },
      data: { status: "FAILED" },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: application.organizationId,
        action: "ADMISSION_PAYMENT_REJECTED",
        entityType: "Payment",
        entityId: updatedPayment.id,
        changes: { paymentId: updatedPayment.id, applicationId: id, rejectedAt: now.toISOString() },
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json(ok({ message: "Payment evidence rejected. The applicant may re-upload." }));
  } catch (error) {
    console.error("[CONFIRM_ADMISSION_PAYMENT]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
