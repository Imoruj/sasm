import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
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
    const body = await req.json();
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
    });

    if (!staffMember) {
      return NextResponse.json(err("NOT_FOUND", "Staff member not found"), { status: 404 });
    }

    const passwordHash = await bcrypt.hash(validated.data.newPassword, 12);

    await db.$transaction([
      db.user.update({
        where: { id: staffId },
        data: { passwordHash },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "STAFF_PASSWORD_RESET",
          entityType: "User",
          entityId: staffId,
          changes: { note: "Password was reset by super admin" },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    return NextResponse.json(ok({ message: "Password reset successfully" }));
  } catch (error) {
    console.error("[RESET_STAFF_PASSWORD]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
