import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { ok, err } from "@/types/api";

const updateFeeSchema = z.object({
  amountKobo: z.number().int().min(0),
});

async function getAuthorizedOrgId() {
  const session = await auth();
  if (!session?.user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return null;
  }

  return session.user.organizationId ?? "";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgId = await getAuthorizedOrgId();
  if (!orgId) {
    return NextResponse.json(err("UNAUTHORIZED", "Unauthorized"), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = updateFeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()),
      { status: 422 },
    );
  }

  const { id } = await params;

  const fee = await db.feeStructure.findFirst({
    where: {
      id,
      organizationId: orgId,
      branchId: null,
      classLevel: null,
      isActive: true,
    },
    select: { id: true },
  });

  if (!fee) {
    return NextResponse.json(err("NOT_FOUND", "Fee record not found"), { status: 404 });
  }

  const updatedFee = await db.feeStructure.update({
    where: { id },
    data: { amountKobo: parsed.data.amountKobo },
    select: { id: true, paymentType: true, amountKobo: true, admissionCycleId: true },
  });

  return NextResponse.json(ok(updatedFee));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgId = await getAuthorizedOrgId();
  if (!orgId) {
    return NextResponse.json(err("UNAUTHORIZED", "Unauthorized"), { status: 401 });
  }

  const { id } = await params;

  const fee = await db.feeStructure.findFirst({
    where: {
      id,
      organizationId: orgId,
      branchId: null,
      classLevel: null,
      isActive: true,
    },
    select: { id: true },
  });

  if (!fee) {
    return NextResponse.json(err("NOT_FOUND", "Fee record not found"), { status: 404 });
  }

  await db.feeStructure.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json(ok({ id }));
}
