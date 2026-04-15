import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { z } from "zod";

const createSchema = z.object({
  name:         z.string().min(2).max(255),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/, "Format must be YYYY/YYYY"),
  startDate:    z.string().min(1),
  endDate:      z.string().min(1),
  isDefault:    z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    if (session.user.role !== "SUPER_ADMIN") return NextResponse.json(err("FORBIDDEN", "Super admin only"), { status: 403 });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()), { status: 400 });

    const orgId = session.user.organizationId ?? "";
    const { name, academicYear, startDate, endDate, isDefault } = parsed.data;

    // If setting as default, clear existing default first
    if (isDefault) {
      await db.admissionCycle.updateMany({ where: { organizationId: orgId, isDefault: true }, data: { isDefault: false } });
    }

    const cycle = await db.admissionCycle.create({
      data: {
        organizationId: orgId,
        name,
        academicYear,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: "DRAFT",
        isDefault: isDefault ?? false,
      },
      select: { id: true, name: true, academicYear: true, status: true, isDefault: true, startDate: true, endDate: true },
    });

    return NextResponse.json(ok(cycle), { status: 201 });
  } catch (error) {
    console.error("[CREATE_CYCLE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
