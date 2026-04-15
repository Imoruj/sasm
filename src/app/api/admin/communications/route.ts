import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { adminLimiter } from "@/lib/ratelimit";
import { resend } from "@/lib/email";

const sendSchema = z.object({
  subject: z.string().min(3, "Subject is required").max(255),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
  filter: z.object({
    status: z.string().optional(),
    classApplied: z.string().optional(),
    branchId: z.string().uuid().optional(),
  }),
});

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await adminLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Insufficient permissions"), { status: 403 });
    }

    const orgId = session.user.organizationId ?? "";
    const branchFilter = session.user.branchId ? { branchId: session.user.branchId } : {};

    const logs = await db.auditLog.findMany({
      where: {
        organizationId: orgId,
        action: "COMMUNICATION_SENT",
        ...(session.user.branchId ? { user: { branchId: session.user.branchId } } : {}),
      },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Also count unique applicants for pending communications
    const totalApplicants = await db.application.groupBy({
      by: ["applicantId"],
      where: { organizationId: orgId, ...branchFilter },
    });

    return NextResponse.json(ok({ logs, totalApplicants: totalApplicants.length }));
  } catch (error) {
    console.error("[GET_COMMUNICATIONS]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await adminLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Insufficient permissions"), { status: 403 });
    }

    const body = await req.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()), { status: 400 });
    }

    const { subject, message, filter } = parsed.data;

    // Escape HTML entities to prevent XSS when message is embedded in email HTML
    const safeMessage = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\n/g, "<br/>");
    const orgId = session.user.organizationId ?? "";
    const branchFilter = session.user.branchId ? { branchId: session.user.branchId } : {};

    // Build the where clause to find matching applications
    const appWhere = {
      organizationId: orgId,
      ...branchFilter,
      ...(filter.branchId ? { branchId: filter.branchId } : {}),
      ...(filter.status ? { status: filter.status as never } : {}),
      ...(filter.classApplied ? { classApplied: filter.classApplied as never } : {}),
    };

    // Get distinct applicant users from matching applications
    const apps = await db.application.findMany({
      where: appWhere,
      select: {
        applicant: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      distinct: ["applicantId"],
    });

    if (apps.length === 0) {
      return NextResponse.json(err("NOT_FOUND", "No applicants match the selected filters"), { status: 404 });
    }

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    const orgName = org?.name ?? "School";
    const fromAddress = process.env.EMAIL_FROM ?? `noreply@${process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, "") ?? "localhost"}`;
    const testTo = process.env.RESEND_TEST_EMAIL;

    // Send emails fire-and-forget — don't await all, batch instead
    const emailPromises = apps.map(({ applicant }) =>
      resend.emails.send({
        from: `${orgName} <${fromAddress}>`,
        to: testTo ?? applicant.email,
        subject,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
            <div style="background:#1B4332;padding:24px 32px;border-radius:12px 12px 0 0;">
              <h1 style="color:#fff;margin:0;font-size:20px;">${orgName}</h1>
            </div>
            <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              <p style="margin-top:0;">Dear <strong>${applicant.firstName}</strong>,</p>
              <div style="white-space:pre-wrap;color:#374151;line-height:1.6;">${safeMessage}</div>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;" />
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                This message was sent by ${orgName} Admissions. Please do not reply to this email.
              </p>
            </div>
          </div>
        `,
      }).catch((e) => console.error("[COMM_EMAIL]", applicant.email, e))
    );

    // Create in-app Notification records
    const notifData = apps.map(({ applicant }) => ({
      userId: applicant.id,
      type: "IN_APP" as const,
      category: "SYSTEM" as const,
      title: subject,
      message,
      deliveryStatus: "SENT" as const,
      sentAt: new Date(),
    }));

    await Promise.all([
      db.notification.createMany({ data: notifData }),
      ...emailPromises,
    ]);

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: orgId,
        action: "COMMUNICATION_SENT",
        entityType: "Notification",
        entityId: session.user.id, // no single entity; use sender id
        changes: { subject, filter, recipientCount: apps.length },
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json(ok({ sent: apps.length }));
  } catch (error) {
    console.error("[POST_COMMUNICATIONS]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
