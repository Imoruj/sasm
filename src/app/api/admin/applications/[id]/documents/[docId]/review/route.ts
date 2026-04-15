import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { adminLimiter } from "@/lib/ratelimit";
import { z } from "zod";
import { sendEnrollmentConfirmationEmail } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string; docId: string }> };

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
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

    const { id, docId } = await params;

    const rawBody = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Provide action: 'approve' or 'reject'"),
        { status: 400 },
      );
    }
    const { action, note } = parsed.data;

    if (action === "reject" && !note?.trim()) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "A rejection reason is required"),
        { status: 400 },
      );
    }

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    // Verify the application exists + belongs to this org, and is in a post-exam status
    // (ADMITTED or EXAM_COMPLETED — documents can be reviewed in both states)
    const application = await db.application.findFirst({
      where: {
        id,
        status: { in: ["ADMITTED", "EXAM_COMPLETED"] },
        ...(isSuperAdmin ? {} : { organizationId: session.user.organizationId ?? "" }),
      },
      include: {
        documents: { select: { id: true, isVerified: true, verificationNote: true } },
        applicant: { select: { id: true, email: true, firstName: true } },
        payments: {
          where: { paymentType: "ADMISSION_FEE", status: "PAID" },
          select: { id: true },
        },
        branch: { select: { name: true } },
        admissionCycle: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });

    if (!application) {
      return NextResponse.json(
        err("NOT_FOUND", "Application not found or not in ADMITTED status"),
        { status: 404 },
      );
    }

    // Verify the document belongs to this application
    const doc = application.documents.find((d) => d.id === docId);
    if (!doc) {
      return NextResponse.json(err("NOT_FOUND", "Document not found for this application"), { status: 404 });
    }

    const now = new Date();

    // Update the document verification status
    await db.applicationDocument.update({
      where: { id: docId },
      data: {
        isVerified: action === "approve",
        verificationNote: action === "reject" ? note!.trim() : null,
        updatedAt: now,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: application.organizationId,
        action: action === "approve" ? "DOCUMENT_APPROVED" : "DOCUMENT_REJECTED",
        entityType: "ApplicationDocument",
        entityId: docId,
        changes: {
          documentId: docId,
          applicationId: id,
          action,
          note: note ?? null,
          performedAt: now.toISOString(),
        },
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? "",
      },
    });

    // After approval, check if ALL documents are now verified and admission fee is paid
    if (action === "approve") {
      const allDocIds = application.documents.map((d) => d.id);
      const verifiedCount = await db.applicationDocument.count({
        where: { applicationId: id, isVerified: true },
      });

      const allVerified = verifiedCount === allDocIds.length && allDocIds.length > 0;
      const admissionFeePaid = application.payments.length > 0;

      if (allVerified && admissionFeePaid && application.status === "ADMITTED") {
        // Enroll the student
        await db.application.update({
          where: { id },
          data: { status: "ENROLLED" },
        });

        await db.applicationStatusHistory.create({
          data: {
            applicationId: id,
            toStatus: "ENROLLED",
            changedBy: session.user.id,
            reason: "All admission documents verified and acceptance fee confirmed. Student enrolled.",
          },
        });

        await db.auditLog.create({
          data: {
            userId: session.user.id,
            organizationId: application.organizationId,
            action: "STUDENT_ENROLLED",
            entityType: "Application",
            entityId: id,
            changes: { applicationId: id, enrolledAt: now.toISOString() },
            ipAddress: ip,
            userAgent: req.headers.get("user-agent") ?? "",
          },
        });

        // In-app notification
        await db.notification.create({
          data: {
            userId: application.applicant.id,
            type: "IN_APP",
            category: "APPLICATION_UPDATE",
            title: "Admission Confirmed — You are Enrolled!",
            message: `Congratulations! All your admission documents have been verified. Your child has been officially enrolled at ${application.organization.name}.`,
            data: { applicationId: id, link: "/dashboard/applications" },
            deliveryStatus: "PENDING",
          },
        });

        // Fire-and-forget email
        sendEnrollmentConfirmationEmail(
          application.applicant.email,
          application.applicant.firstName ?? "Parent",
          `${application.studentFirstName ?? ""} ${application.studentLastName ?? ""}`.trim(),
          application.applicationNumber,
          application.organization.name,
          application.branch.name,
          application.classApplied ?? undefined,
        ).catch((e) => console.error("[ENROLLMENT_EMAIL]", e));

        return NextResponse.json(
          ok({ message: "Document approved. All documents verified — student enrolled!", enrolled: true }),
        );
      }
    }

    return NextResponse.json(
      ok({
        message: action === "approve" ? "Document approved." : "Document rejected.",
        enrolled: false,
      }),
    );
  } catch (error) {
    console.error("[DOCUMENT_REVIEW]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
