import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { ok, err } from "@/types/api";

const feesSchema = z.object({
  admissionCycleId: z.string().uuid(),
  fees: z.array(z.object({
    paymentType: z.enum(["APPLICATION_FEE", "EXAM_FEE", "ADMISSION_FEE"]),
    amountKobo:  z.number().int().min(0),
  })),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json(err("UNAUTHORIZED", "Unauthorized"), { status: 401 });
  }
  const orgId = session.user.organizationId ?? "";

  const [cycles, fees] = await Promise.all([
    db.admissionCycle.findMany({
      where: { organizationId: orgId, status: { in: ["OPEN", "DRAFT"] } },
      select: { id: true, name: true, academicYear: true, status: true, isDefault: true },
      orderBy: { createdAt: "desc" },
    }),
    db.feeStructure.findMany({
      where: {
        organizationId: orgId,
        branchId: null,
        classLevel: null,
        isActive: true,
      },
      select: { id: true, paymentType: true, amountKobo: true, admissionCycleId: true },
    }),
  ]);

  return NextResponse.json(ok({ cycles, fees }));
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json(err("UNAUTHORIZED", "Unauthorized"), { status: 401 });
  }
  const orgId = session.user.organizationId ?? "";

  const body = await req.json().catch(() => ({}));
  const parsed = feesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()),
      { status: 422 },
    );
  }

  const { admissionCycleId, fees } = parsed.data;

  // Upsert each fee type
  await Promise.all(
    fees.map(async ({ paymentType, amountKobo }) => {
      const existing = await db.feeStructure.findFirst({
        where: { organizationId: orgId, admissionCycleId, paymentType, branchId: null, classLevel: null },
      });
      if (existing) {
        await db.feeStructure.update({
          where: { id: existing.id },
          data: { amountKobo, isActive: true },
        });
      } else {
        await db.feeStructure.create({
          data: { organizationId: orgId, admissionCycleId, paymentType, amountKobo, isActive: true },
        });
      }
    }),
  );

  return NextResponse.json(ok({ updated: true }));
}
