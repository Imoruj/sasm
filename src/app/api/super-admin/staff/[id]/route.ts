import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

const permissionsSchema = z.object({
  applications: z.boolean().optional(),
  forms:         z.boolean().optional(),
  exams:         z.boolean().optional(),
  communications:z.boolean().optional(),
  reports:       z.boolean().optional(),
  settings:      z.boolean().optional(),
}).optional();

const updateStaffSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().optional().nullable(),
  role: z.enum(["SCHOOL_ADMIN", "SUPER_ADMIN"]).optional(),
  branchId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  permissions: permissionsSchema,
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
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
    const validated = updateStaffSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    // Verify staff member belongs to the same organization
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

    // Prevent role change on self
    if (staffId === session.user.id && validated.data.role !== undefined) {
      return NextResponse.json(
        err("FORBIDDEN", "You cannot change your own role"),
        { status: 403 }
      );
    }

    // If changing to SCHOOL_ADMIN, branchId must be set
    const newRole = validated.data.role ?? staffMember.role;
    const newBranchId = "branchId" in validated.data
      ? validated.data.branchId
      : staffMember.branchId;

    if (newRole === "SCHOOL_ADMIN" && !newBranchId) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Branch is required for School Admin role"),
        { status: 400 }
      );
    }

    // If branchId provided and non-null, verify it belongs to the org
    if (newBranchId) {
      const branch = await db.branch.findFirst({
        where: { id: newBranchId, organizationId: session.user.organizationId ?? "" },
      });
      if (!branch) {
        return NextResponse.json(err("NOT_FOUND", "Branch not found"), { status: 404 });
      }
    }

    const before = {
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      phone: staffMember.phone,
      role: staffMember.role,
      branchId: staffMember.branchId,
      isActive: staffMember.isActive,
    };

    const updateData: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      role?: "SCHOOL_ADMIN" | "SUPER_ADMIN";
      branchId?: string | null;
      isActive?: boolean;
    } = {};

    if (validated.data.firstName !== undefined) updateData.firstName = validated.data.firstName;
    if (validated.data.lastName !== undefined) updateData.lastName = validated.data.lastName;
    if ("phone" in validated.data) updateData.phone = validated.data.phone ?? null;
    if (validated.data.role !== undefined) updateData.role = validated.data.role;
    if ("branchId" in validated.data) updateData.branchId = validated.data.branchId ?? null;
    if (validated.data.isActive !== undefined) updateData.isActive = validated.data.isActive;

    const [updated] = await db.$transaction([
      db.user.update({
        where: { id: staffId },
        data: {
          ...updateData,
          ...(validated.data.permissions !== undefined
            ? { permissions: (validated.data.permissions ?? null) as never }
            : {}),
        },
        select: {
          id: true, email: true, phone: true, role: true,
          firstName: true, lastName: true, avatarUrl: true,
          emailVerified: true, organizationId: true, branchId: true,
          isActive: true, lastLoginAt: true, createdAt: true,
          permissions: true,
          branch: { select: { name: true, code: true } },
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "STAFF_UPDATED",
          entityType: "User",
          entityId: staffId,
          changes: { before, after: updateData },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("[UPDATE_STAFF]", error);
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

    const { id: staffId } = await params;

    // Cannot delete self
    if (staffId === session.user.id) {
      return NextResponse.json(
        err("FORBIDDEN", "You cannot delete your own account"),
        { status: 403 }
      );
    }

    // Verify staff belongs to the same organization
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

    // Log audit before deletion (entity won't exist after)
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        action: "STAFF_DELETED",
        entityType: "User",
        entityId: staffId,
        changes: {
          before: { email: staffMember.email, role: staffMember.role },
          after: null,
        },
        ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
        userAgent: req.headers.get("user-agent") ?? "",
      },
    });

    // Hard delete the user record
    await db.user.delete({ where: { id: staffId } });

    return NextResponse.json(ok({ message: "Staff member deleted successfully" }));
  } catch (error) {
    console.error("[DELETE_STAFF]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
