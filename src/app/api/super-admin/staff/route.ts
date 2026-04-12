import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

const LIMIT = 20;

const createStaffSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().optional(),
  role: z.enum(["SCHOOL_ADMIN", "SUPER_ADMIN"]),
  branchId: z.string().uuid("Invalid branch ID").optional(),
  temporaryPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(err("FORBIDDEN", "Super admin access required"), { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get("role");
    const branchIdFilter = searchParams.get("branchId");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const skip = (page - 1) * LIMIT;

    const where = {
      organizationId: session.user.organizationId ?? "",
      role: roleFilter === "SCHOOL_ADMIN" || roleFilter === "SUPER_ADMIN"
        ? (roleFilter as "SCHOOL_ADMIN" | "SUPER_ADMIN")
        : { not: "APPLICANT" as const },
      ...(branchIdFilter ? { branchId: branchIdFilter } : {}),
    };

    const [staff, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          emailVerified: true,
          organizationId: true,
          branchId: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          branch: {
            select: {
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: LIMIT,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json(ok({ staff, total }));
  } catch (error) {
    console.error("[GET_STAFF]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(err("FORBIDDEN", "Super admin access required"), { status: 403 });
    }

    const body = await req.json();
    const validated = createStaffSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    const { email, firstName, lastName, phone, role, branchId, temporaryPassword } = validated.data;

    // School admins must have a branch assigned
    if (role === "SCHOOL_ADMIN" && !branchId) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Branch is required for School Admin role"),
        { status: 400 }
      );
    }

    // Check email uniqueness
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json(
        err("DUPLICATE", "A user with this email address already exists"),
        { status: 409 }
      );
    }

    // If branchId provided, verify it belongs to the organization
    if (branchId) {
      const branch = await db.branch.findFirst({
        where: { id: branchId, organizationId: session.user.organizationId ?? "" },
      });
      if (!branch) {
        return NextResponse.json(err("NOT_FOUND", "Branch not found"), { status: 404 });
      }
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const [newStaff] = await db.$transaction([
      db.user.create({
        data: {
          email: email.toLowerCase(),
          firstName,
          lastName,
          phone: phone ?? null,
          role,
          passwordHash,
          organizationId: session.user.organizationId,
          branchId: branchId ?? null,
          emailVerified: false,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          emailVerified: true,
          organizationId: true,
          branchId: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          branch: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      }),
      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "STAFF_CREATED",
          entityType: "User",
          entityId: "00000000-0000-0000-0000-000000000000", // placeholder, updated below
          changes: { after: { email: email.toLowerCase(), role, firstName, lastName } },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    // Update audit log with real entity ID
    await db.auditLog.updateMany({
      where: {
        userId: session.user.id,
        action: "STAFF_CREATED",
        entityId: "00000000-0000-0000-0000-000000000000",
      },
      data: { entityId: newStaff.id },
    });

    return NextResponse.json(ok(newStaff), { status: 201 });
  } catch (error) {
    console.error("[CREATE_STAFF]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
