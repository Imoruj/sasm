import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import type { ApiResponse } from "@/types/api";

const createSchema = z.object({
  name:          z.string().min(2).max(255),
  description:   z.string().optional(),
  classLevel:    z.string().nullable().optional(),
  enabledFields: z.array(z.string()).optional(),
  schema:        z.record(z.unknown()).optional().default({}),
  status:        z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  isDefault:     z.boolean().default(false),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const templates = await db.formTemplate.findMany({
    where: {
      organizationId: session.user.organizationId ?? "",
      ...(session.user.branchId
        ? { OR: [{ branchId: session.user.branchId }, { branchId: null }] }
        : {}),
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json<ApiResponse<typeof templates>>({ success: true, data: templates });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  const { classLevel, enabledFields, schema, ...rest } = parsed.data;

  // Merge enabledFields into schema if provided
  const mergedSchema = enabledFields !== undefined
    ? { ...schema, enabledFields }
    : schema;

  const template = await db.formTemplate.create({
    data: {
      ...rest,
      schema:         mergedSchema as never,
      classLevel:     (classLevel ?? null) as never,
      organizationId: session.user.organizationId ?? "",
      branchId:       session.user.branchId ?? null,
    },
  });

  return NextResponse.json<ApiResponse<typeof template>>({ success: true, data: template }, { status: 201 });
}
