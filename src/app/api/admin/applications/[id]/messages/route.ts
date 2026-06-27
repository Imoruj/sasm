import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendApplicantMessageEmail } from "@/lib/email";
import { adminLimiter } from "@/lib/ratelimit";
import { err, ok } from "@/types/api";

const applicantMessageSchema = z.object({
  type: z.enum(["TEST_INVITE", "SUCCESS"]),
  message: z.string().trim().min(10).max(3000),
  scheduledDate: z.string().optional(),
});

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
    const validated = applicantMessageSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input"), { status: 400 });
    }

    if (validated.data.type === "TEST_INVITE" && !validated.data.scheduledDate) {
      return NextResponse.json(err("VALIDATION_ERROR", "Test date is required"), { status: 400 });
    }

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    const application = await db.application.findFirst({
      where: {
        id,
        ...(isSuperAdmin
          ? {}
          : {
              organizationId: session.user.organizationId ?? "",
              ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
            }),
      },
      include: {
        applicant: { select: { email: true, firstName: true } },
        organization: { select: { name: true } },
      },
    });

    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });

    const subject =
      validated.data.type === "TEST_INVITE"
        ? `Entrance Test Invitation - ${application.applicationNumber}`
        : `Application Successful - ${application.applicationNumber}`;

    await sendApplicantMessageEmail(
      application.applicant.email,
      application.applicant.firstName ?? "Applicant",
      subject,
      validated.data.message,
      application.organization?.name ?? "School",
    );

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: application.organizationId,
        action: validated.data.type === "TEST_INVITE" ? "TEST_INVITE_SENT" : "APPLICATION_SUCCESS_MESSAGE_SENT",
        entityType: "Application",
        entityId: id,
        changes: {
          messageType: validated.data.type,
          scheduledDate: validated.data.scheduledDate ?? null,
        },
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json(ok({ sent: true }));
  } catch (error) {
    console.error("[APPLICATION_MESSAGE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
