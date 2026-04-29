import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let session = null;
    let authError = null;
    try {
      session = await auth();
    } catch (e) {
      authError = e instanceof Error ? e.message : String(e);
    }
    if (authError) {
      return NextResponse.json({ authError, step: "auth()" }, { status: 500 });
    }
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Not authenticated"), { status: 401 });
    }
    const branch = await db.branch.findUnique({
      where: { id },
      select: { id: true, name: true, organizationId: true },
    }).catch((e: unknown) => ({ dbError: String(e) }));
    return NextResponse.json(ok({
      sessionUserId: session.user.id,
      sessionRole: session.user.role,
      sessionOrgId: session.user.organizationId,
      branchId: id,
      branch,
    }));
  } catch (e) {
    return NextResponse.json({ topLevelError: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const updateBranchSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/i, "Code must be alphanumeric")
    .optional(),
  address: z.string().min(5).optional(),
  state: z.string().min(1).optional(),
  lga: z.string().min(1).optional(),
  city: z.string().max(100).optional(),
  phone: z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number")
    .optional(),
  email: z.string().email("Enter a valid email address").optional(),
  capacity: z.number().int().min(1).optional(),
  contactPerson: z.string().min(2).max(255).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        err("UNAUTHORIZED", "Authentication required"),
        { status: 401 }
      );
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        err("FORBIDDEN", "Insufficient permissions"),
        { status: 403 }
      );
    }

    const { id } = await params;
    const organizationId = session.user.organizationId ?? "";

    const branch = await db.branch.findFirst({
      where: { id, organizationId },
    });

    if (!branch) {
      return NextResponse.json(
        err("NOT_FOUND", "Branch not found"),
        { status: 404 }
      );
    }

    const body = await req.json();
    const validated = updateBranchSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    // If updating code, check uniqueness
    if (validated.data.code && validated.data.code.toUpperCase() !== branch.code) {
      const codeConflict = await db.branch.findUnique({
        where: {
          organizationId_code: {
            organizationId,
            code: validated.data.code.toUpperCase(),
          },
        },
      });
      if (codeConflict) {
        return NextResponse.json(
          err(
            "DUPLICATE",
            `A branch with code "${validated.data.code.toUpperCase()}" already exists.`
          ),
          { status: 409 }
        );
      }
    }

    const updateData = {
      ...validated.data,
      ...(validated.data.code
        ? { code: validated.data.code.toUpperCase() }
        : {}),
    };

    const updatedBranch = await db.branch.update({
      where: { id },
      data: updateData,
    });

    // Fire-and-forget audit log (don't block the response on it)
    db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "BRANCH_UPDATED",
        entityType: "Branch",
        entityId: id,
        changes: {
          before: { name: branch.name, code: branch.code, isActive: branch.isActive },
          after: { name: updatedBranch.name, code: updatedBranch.code, isActive: updatedBranch.isActive },
        },
        ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
        userAgent: req.headers.get("user-agent") ?? "",
      },
    }).catch((e: unknown) => console.error("[AUDIT_LOG_ERROR]", e));

    return NextResponse.json(ok(updatedBranch));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[UPDATE_BRANCH]", error);
    return NextResponse.json(
      err("INTERNAL_ERROR", `Branch update failed: ${msg}`),
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        err("UNAUTHORIZED", "Authentication required"),
        { status: 401 }
      );
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        err("FORBIDDEN", "Insufficient permissions"),
        { status: 403 }
      );
    }

    const { id } = await params;
    const organizationId = session.user.organizationId ?? "";
    const url = new URL(req.url);
    const permanent = url.searchParams.get("permanent") === "true";

    const branch = await db.branch.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { applications: true } } },
    });

    if (!branch) {
      return NextResponse.json(
        err("NOT_FOUND", "Branch not found"),
        { status: 404 }
      );
    }

    // Hard delete
    if (permanent) {
      if (branch._count.applications > 0) {
        return NextResponse.json(
          err(
            "CONFLICT",
            `Cannot delete this branch — it has ${branch._count.applications} application(s) linked to it. Deactivate it instead.`
          ),
          { status: 409 }
        );
      }

      await db.branch.delete({ where: { id } });

      db.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId,
          action: "BRANCH_DELETED",
          entityType: "Branch",
          entityId: id,
          changes: { deleted: { name: branch.name, code: branch.code } },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      }).catch((e: unknown) => console.error("[AUDIT_LOG_ERROR]", e));

      return NextResponse.json(ok({ id, deleted: true }));
    }

    // Soft deactivate
    if (!branch.isActive) {
      return NextResponse.json(
        err("ALREADY_INACTIVE", "Branch is already inactive"),
        { status: 400 }
      );
    }

    const deactivated = await db.branch.update({
      where: { id },
      data: { isActive: false },
    });

    db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "BRANCH_DEACTIVATED",
        entityType: "Branch",
        entityId: id,
        changes: { before: { isActive: true }, after: { isActive: false } },
        ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
        userAgent: req.headers.get("user-agent") ?? "",
      },
    }).catch((e: unknown) => console.error("[AUDIT_LOG_ERROR]", e));

    return NextResponse.json(ok(deactivated));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[BRANCH_DELETE]", error);
    return NextResponse.json(
      err("INTERNAL_ERROR", `Branch delete failed: ${msg}`),
      { status: 500 }
    );
  }
}
