import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase and number"
    ),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const body = await req.json();
    const validated = changePasswordSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validated.data;

    // Fetch user with password hash
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        passwordHash: true,
        organizationId: true,
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        err("NOT_FOUND", "User not found or no password set"),
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        err("INVALID_PASSWORD", "Current password is incorrect"),
        { status: 400 }
      );
    }

    // Prevent reusing the same password
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return NextResponse.json(
        err("SAME_PASSWORD", "New password must be different from current password"),
        { status: 400 }
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newPasswordHash },
    });

    // Write audit log
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: user.organizationId ?? undefined,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: session.user.id,
        changes: undefined,
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    });

    return NextResponse.json(ok({ message: "Password changed successfully" }));
  } catch (error) {
    console.error("[CHANGE_PASSWORD]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
