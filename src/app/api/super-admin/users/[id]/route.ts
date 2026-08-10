import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { normalizeNigerianPhone } from "@/lib/utils";

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function findApplicant(userId: string) {
  return db.user.findFirst({
    where: {
      id: userId,
      role: "APPLICANT",
      deletedAt: null,
    },
  });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(err("FORBIDDEN", "Super admin access required"), { status: 403 });
    }

    const { id: userId } = await params;
    const body = await req.json();
    const validated = updateUserSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 },
      );
    }

    const existing = await findApplicant(userId);
    if (!existing) {
      return NextResponse.json(err("NOT_FOUND", "User account not found"), { status: 404 });
    }

    let phone: string | null | undefined = validated.data.phone;
    if (phone !== undefined && phone !== null && phone.trim() !== "") {
      phone = normalizeNigerianPhone(phone);
      const phoneTaken = await db.user.findFirst({
        where: { phone, NOT: { id: userId } },
        select: { id: true },
      });
      if (phoneTaken) {
        return NextResponse.json(
          err("PHONE_EXISTS", "An account with this phone number already exists."),
          { status: 409 },
        );
      }
    } else if (phone !== undefined) {
      phone = null;
    }

    const before = {
      firstName: existing.firstName,
      lastName: existing.lastName,
      phone: existing.phone,
      isActive: existing.isActive,
    };

    const updateData: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      isActive?: boolean;
    } = {};

    if (validated.data.firstName !== undefined) updateData.firstName = validated.data.firstName;
    if (validated.data.lastName !== undefined) updateData.lastName = validated.data.lastName;
    if ("phone" in validated.data) updateData.phone = phone ?? null;
    if (validated.data.isActive !== undefined) updateData.isActive = validated.data.isActive;

    const [updated] = await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          emailVerified: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "USER_UPDATED",
          entityType: "User",
          entityId: userId,
          changes: { before, after: updateData },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("[UPDATE_USER]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(err("FORBIDDEN", "Super admin access required"), { status: 403 });
    }

    const { id: userId } = await params;

    const existing = await findApplicant(userId);
    if (!existing) {
      return NextResponse.json(err("NOT_FOUND", "User account not found"), { status: 404 });
    }

    const appCount = await db.application.count({
      where: { applicantId: userId },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        action: "USER_DELETED",
        entityType: "User",
        entityId: userId,
        changes: {
          before: { email: existing.email, role: existing.role },
          after: null,
          softDelete: appCount > 0,
        },
        ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
        userAgent: req.headers.get("user-agent") ?? "",
      },
    });

    if (appCount > 0) {
      // Soft-delete — applications reference this user
      await db.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), isActive: false },
      });
    } else {
      await db.user.delete({ where: { id: userId } });
    }

    return NextResponse.json(ok({ message: "User account deleted successfully" }));
  } catch (error) {
    console.error("[DELETE_USER]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
