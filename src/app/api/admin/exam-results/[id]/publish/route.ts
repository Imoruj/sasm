import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { adminLimiter } from "@/lib/ratelimit";
import { sendAdmissionOfferEmail, sendExamResultPublishedEmail } from "@/lib/email";

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

    const result = await db.examResult.findFirst({
      where: {
        id,
        examBooking: {
          examSession: {
            organizationId: session.user.organizationId ?? "",
            ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
          },
        },
      },
      include: {
        application: {
          include: {
            applicant: { select: { email: true, firstName: true } },
            organization: { select: { name: true } },
            branch: { select: { name: true } },
          },
        },
      },
    });

    if (!result) {
      return NextResponse.json(err("NOT_FOUND", "Exam result not found"), { status: 404 });
    }

    if (result.isPublished) {
      return NextResponse.json(err("ALREADY_PUBLISHED", "Result is already published"), { status: 400 });
    }

    const now = new Date();
    const newAppStatus = result.isPassed ? "ADMITTED" : "NOT_ADMITTED";

    // Publish result + transition application status in a transaction
    const [updatedResult] = await db.$transaction([
      db.examResult.update({
        where: { id },
        data: { isPublished: true, publishedAt: now },
      }),
      db.application.update({
        where: { id: result.applicationId },
        data: { status: newAppStatus },
      }),
      db.applicationStatusHistory.create({
        data: {
          applicationId: result.applicationId,
          fromStatus: result.application.status,
          toStatus: newAppStatus,
          changedBy: session.user.id,
          reason: `Exam result published. ${result.isPassed ? "Applicant passed." : "Applicant did not pass."}`,
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "EXAM_RESULT_PUBLISHED",
          entityType: "ExamResult",
          entityId: id,
          changes: {
            applicationId: result.applicationId,
            isPassed: result.isPassed,
            newStatus: newAppStatus,
          },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    const applicantEmail = result.application.applicant.email;
    const applicantFirstName = result.application.applicant.firstName ?? "Applicant";
    const studentName = [
      result.application.studentFirstName,
      result.application.studentLastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || "your child";
    const applicationNumber = result.application.applicationNumber;
    const orgName = result.application.organization?.name ?? "School";

    // Fire-and-forget email notifications
    if (result.isPassed) {
      sendAdmissionOfferEmail(
        applicantEmail,
        applicantFirstName,
        studentName,
        applicationNumber,
        orgName,
        result.application.branch?.name ?? "",
      ).catch((e) => console.error("[EMAIL_ADMISSION_OFFER]", e));
    } else {
      sendExamResultPublishedEmail(
        applicantEmail,
        applicantFirstName,
        studentName,
        applicationNumber,
        false,
        orgName,
      ).catch((e) => console.error("[EMAIL_RESULT_PUBLISHED]", e));
    }

    return NextResponse.json(ok(updatedResult));
  } catch (error) {
    console.error("[PUBLISH_EXAM_RESULT]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
