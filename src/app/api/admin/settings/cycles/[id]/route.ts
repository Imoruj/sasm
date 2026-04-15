import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name:         z.string().min(2).max(255).optional(),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/).optional(),
  startDate:    z.string().optional(),
  endDate:      z.string().optional(),
  status:       z.enum(["DRAFT", "OPEN", "CLOSED", "ARCHIVED"]).optional(),
  isDefault:    z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    if (session.user.role !== "SUPER_ADMIN") return NextResponse.json(err("FORBIDDEN", "Super admin only"), { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json(err("VALIDATION_ERROR", "Invalid input"), { status: 400 });

    const orgId = session.user.organizationId ?? "";
    const { isDefault, startDate, endDate, ...rest } = parsed.data;

    // If setting as default, clear others first
    if (isDefault) {
      await db.admissionCycle.updateMany({ where: { organizationId: orgId, isDefault: true, NOT: { id } }, data: { isDefault: false } });
    }

    const cycle = await db.admissionCycle.update({
      where: { id, organizationId: orgId },
      data: {
        ...rest,
        ...(isDefault !== undefined ? { isDefault } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate   ? { endDate:   new Date(endDate)   } : {}),
      },
      select: { id: true, name: true, academicYear: true, status: true, isDefault: true, startDate: true, endDate: true },
    });

    return NextResponse.json(ok(cycle));
  } catch (error) {
    console.error("[PATCH_CYCLE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    if (session.user.role !== "SUPER_ADMIN") return NextResponse.json(err("FORBIDDEN", "Super admin only"), { status: 403 });

    const { id } = await params;
    const orgId = session.user.organizationId ?? "";

    // Don't allow deleting if it has applications
    const appCount = await db.application.count({ where: { admissionCycleId: id } });
    if (appCount > 0) {
      return NextResponse.json(err("CONFLICT", `Cannot delete: ${appCount} application(s) exist for this cycle`), { status: 409 });
    }

    await db.admissionCycle.delete({ where: { id, organizationId: orgId } });
    return NextResponse.json(ok({ deleted: true }));
  } catch (error) {
    console.error("[DELETE_CYCLE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
