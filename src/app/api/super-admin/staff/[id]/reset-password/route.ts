import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { sendStaffPasswordResetNotification } from "@/lib/email";
import { getDefaultStaffPassword } from "@/constants/staff";

const resetPasswordSchema = z
  .object({
    /** When true, reset to the role's default password. */
    useDefault: z.boolean().optional(),
    newPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
  })
  .refine((d) => d.useDefault === true || !!d.newPassword, {
    message: "Provide a new password or set useDefault to true",
    path: ["newPassword"],
  });

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

    const { id: staffId } = await params;
    const body = await req.json().catch(() => ({}));
    const validated = resetPasswordSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    // Verify ownership — staff must belong to the same organization
    const staffMember = await db.user.findFirst({
      where: {
        id: staffId,
        organizationId: session.user.organizationId ?? "",
        role: { in: ["SCHOOL_ADMIN", "SUPER_ADMIN"] },
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    if (!staffMember) {
      return NextResponse.json(err("NOT_FOUND", "Staff member not found"), { status: 404 });
    }

    if (staffId === session.user.id) {
      return NextResponse.json(
        err("FORBIDDEN", "You cannot reset your own password here"),
        { status: 403 }
      );
    }

    const newPassword =
      validated.data.useDefault === true
        ? getDefaultStaffPassword(
            staffMember.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "SCHOOL_ADMIN",
          )
        : (validated.data.newPassword as string);

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.$transaction([
      db.user.update({
        where: { id: staffId },
        data: {
          passwordHash,
          // Unlock account in case it was locked due to failed attempts
          failedLoginAttempts: 0,
          lockedUntil: null,
          mustChangePassword: true,
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "STAFF_PASSWORD_RESET",
          entityType: "User",
          entityId: staffId,
          changes: {
            note: validated.data.useDefault
              ? "Password was reset to default by super admin"
              : "Password was reset by super admin",
            useDefault: validated.data.useDefault === true,
          },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    // Notify staff member of the new password (fire-and-forget)
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId ?? "" },
      select: { name: true },
    });
    sendStaffPasswordResetNotification(
      staffMember.email,
      staffMember.firstName,
      newPassword,
      org?.name ?? "School",
    ).catch((e) => console.error("[PASSWORD_RESET_EMAIL]", e));

    return NextResponse.json(
      ok({
        message: "Password reset successfully",
        defaultPassword: validated.data.useDefault === true ? newPassword : undefined,
      }),
    );
  } catch (error) {
    console.error("[RESET_STAFF_PASSWORD]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
