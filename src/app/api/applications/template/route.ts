import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { ALL_FIELD_IDS } from "@/constants/formFieldRegistry";
import { resolveAdmissionCycle, resolveSessionOrganizationId, resolveTemplateBranchId } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }
    if (!["APPLICANT", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Insufficient permissions"), { status: 403 });
    }

    const organizationId = session.user.role === "APPLICANT"
      ? await resolveSessionOrganizationId(session.user.id, session.user.organizationId)
      : session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json(err("NOT_FOUND", "No school context found for this user"), { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const branchIdParam = searchParams.get("branchId");
    const allowedBranchId =
      session.user.role === "SCHOOL_ADMIN" ? session.user.branchId ?? null : null;

    if (allowedBranchId && branchIdParam && branchIdParam !== allowedBranchId) {
      return NextResponse.json(err("FORBIDDEN", "Insufficient permissions for this branch"), { status: 403 });
    }

    const templateSelect = {
      id: true,
      name: true,
      description: true,
      classLevels: true,
      branchId: true,
      schema: true,
    } as const;

    const orderBy = [{ isDefault: "desc" as const }, { updatedAt: "desc" as const }];

    // If a branchId is provided, prefer a branch-specific template, then fall back to org-wide
    let template = null;
    if (branchIdParam) {
      template = await db.formTemplate.findFirst({
        where: { organizationId, status: "PUBLISHED", branchId: branchIdParam },
        select: templateSelect,
        orderBy,
      });
      if (!template) {
        template = await db.formTemplate.findFirst({
          where: { organizationId, status: "PUBLISHED", branchId: null },
          select: templateSelect,
          orderBy,
        });
      }
    } else {
      template = await db.formTemplate.findFirst({
        where: allowedBranchId
          ? { organizationId, status: "PUBLISHED", OR: [{ branchId: allowedBranchId }, { branchId: null }] }
          : { organizationId, status: "PUBLISHED" },
        select: templateSelect,
        orderBy,
      });
    }

    if (!template) {
      return NextResponse.json(err("NOT_FOUND", "No published admission template is available"), { status: 404 });
    }

    const schema = (template.schema ?? {}) as Record<string, unknown>;
    const enabledFields = Array.isArray(schema.enabledFields)
      ? (schema.enabledFields as string[])
      : ALL_FIELD_IDS;
    const resolvedBranchId = await resolveTemplateBranchId(organizationId, template.branchId);
    const resolvedAdmissionCycle = await resolveAdmissionCycle(organizationId);

    return NextResponse.json(ok({
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        classLevels: template.classLevels,
        branchId: template.branchId,
        resolvedBranchId,
        resolvedAdmissionCycleId: resolvedAdmissionCycle?.id ?? null,
        resolvedAdmissionCycleName: resolvedAdmissionCycle?.name ?? null,
        resolvedAdmissionCycleYear: resolvedAdmissionCycle?.academicYear ?? null,
        enabledFields,
      },
    }));
  } catch (error) {
    console.error("[GET_APPLICATION_TEMPLATE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Failed to load application template"), { status: 500 });
  }
}
