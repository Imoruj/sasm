import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { sendStaffPasswordResetNotification } from "@/lib/email";
import { DEFAULT_APPLICANT_PASSWORD } from "@/constants/staff";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(err("FORBIDDEN", "Super admin access required"), { status: 403 });
    }

    const { id: userId } = await params;
    const orgId = session.user.organizationId ?? "";

    const user = await db.user.findFirst({
      where: {
        id: userId,
        role: "APPLICANT",
        deletedAt: null,
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      return NextResponse.json(err("NOT_FOUND", "User account not found"), { status: 404 });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_APPLICANT_PASSWORD, 12);

    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          mustChangePassword: true,
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "USER_PASSWORD_RESET",
          entityType: "User",
          entityId: userId,
          changes: { note: "Password was reset to default by super admin", useDefault: true },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    sendStaffPasswordResetNotification(
      user.email,
      user.firstName,
      DEFAULT_APPLICANT_PASSWORD,
      org?.name ?? "School",
    ).catch((e) => console.error("[USER_PASSWORD_RESET_EMAIL]", e));

    return NextResponse.json(
      ok({
        message: "Password reset successfully",
        defaultPassword: DEFAULT_APPLICANT_PASSWORD,
      }),
    );
  } catch (error) {
    console.error("[RESET_USER_PASSWORD]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
