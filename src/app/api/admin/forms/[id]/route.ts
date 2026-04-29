import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { ApiResponse } from "@/types/api";

const patchSchema = z.object({
  name:           z.string().min(2).max(255).optional(),
  description:    z.string().optional(),
  classLevels:    z.array(z.string()).optional(),
  enabledFields:  z.array(z.string()).optional(),
  status:         z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  isDefault:      z.boolean().optional(),
  branchId:       z.string().uuid().nullable().optional(),
});

// Branch-scoped where clause: branch admins can only touch their own branch's templates
function templateWhere(id: string, orgId: string, branchId: string | null | undefined) {
  return {
    id,
    organizationId: orgId,
    ...(branchId ? { branchId } : {}),
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const { id } = await params;

  const existing = await db.formTemplate.findFirst({
    where: templateWhere(id, session.user.organizationId ?? "", session.user.branchId),
  });
  if (!existing) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: "NOT_FOUND", message: "Template not found" } },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const { enabledFields, classLevels, branchId: bodyBranchId, ...rest } = parsed.data;

  // Merge enabledFields into the schema JSON
  const currentSchema = (existing.schema as Record<string, unknown>) ?? {};
  const newSchema = enabledFields !== undefined
    ? { ...currentSchema, enabledFields }
    : currentSchema;

  // Branch admins are locked to their own branch
  const resolvedBranchId = session.user.branchId !== undefined && session.user.branchId !== null
    ? session.user.branchId
    : bodyBranchId;

  const updated = await db.formTemplate.update({
    where: { id },
    data: {
      ...rest,
      ...(classLevels !== undefined ? { classLevels: classLevels as never } : {}),
      ...(resolvedBranchId !== undefined ? { branchId: resolvedBranchId } : {}),
      schema: newSchema as never,
      version: { increment: 1 },
    },
  });

  return NextResponse.json<ApiResponse<typeof updated>>({ success: true, data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const { id } = await params;

  const existing = await db.formTemplate.findFirst({
    where: templateWhere(id, session.user.organizationId ?? "", session.user.branchId),
  });
  if (!existing) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: "NOT_FOUND", message: "Template not found" } },
      { status: 404 },
    );
  }
  if (existing.isDefault) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: "FORBIDDEN", message: "Cannot delete the default template" } },
      { status: 403 },
    );
  }

  await db.formTemplate.delete({ where: { id } });
  return NextResponse.json<ApiResponse<{ id: string }>>({ success: true, data: { id } });
}
