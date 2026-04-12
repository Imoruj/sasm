import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

const createCycleSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(255),
  academicYear: z
    .string()
    .regex(/^\d{4}\/\d{4}$/, "Academic year must be in YYYY/YYYY format"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  isDefault: z.boolean().optional().default(false),
});

export async function GET() {
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

    const cycles = await db.admissionCycle.findMany({
      where: { organizationId: session.user.organizationId ?? "" },
      include: {
        _count: {
          select: {
            applications: true,
            examSessions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(ok({ cycles, total: cycles.length }));
  } catch (error) {
    console.error("[GET_CYCLES]", error);
    return NextResponse.json(
      err("INTERNAL_ERROR", "Something went wrong."),
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

    const body = await req.json();
    const validated = createCycleSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    const { name, academicYear, startDate, endDate, isDefault } = validated.data;
    const organizationId = session.user.organizationId ?? "";

    // Validate that endDate is after startDate
    if (new Date(endDate) <= new Date(startDate)) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "End date must be after start date"),
        { status: 400 }
      );
    }

    const cycle = await db.$transaction(async (tx) => {
      // If setting as default, unset all other defaults first
      if (isDefault) {
        await tx.admissionCycle.updateMany({
          where: { organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const newCycle = await tx.admissionCycle.create({
        data: {
          organizationId,
          name,
          academicYear,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: "DRAFT",
          isDefault: isDefault ?? false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId,
          action: "ADMISSION_CYCLE_CREATED",
          entityType: "AdmissionCycle",
          entityId: newCycle.id,
          changes: { after: newCycle },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      });

      return newCycle;
    });

    return NextResponse.json(ok(cycle), { status: 201 });
  } catch (error) {
    console.error("[CREATE_CYCLE]", error);
    return NextResponse.json(
      err("INTERNAL_ERROR", "Something went wrong."),
      { status: 500 }
    );
  }
}
