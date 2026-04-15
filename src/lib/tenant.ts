import { db } from "@/lib/db";

export async function resolveSessionOrganizationId(
  userId: string,
  organizationId?: string | null,
): Promise<string | null> {
  if (organizationId) {
    return organizationId;
  }

  const recentApplication = await db.application.findFirst({
    where: { applicantId: userId },
    select: { organizationId: true },
    orderBy: { updatedAt: "desc" },
  });

  if (recentApplication?.organizationId) {
    return recentApplication.organizationId;
  }

  const activeOrganizations = await db.organization.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true },
    take: 2,
    orderBy: { createdAt: "asc" },
  });

  return activeOrganizations.length === 1 ? activeOrganizations[0].id : null;
}

export async function resolveTemplateBranchId(
  organizationId: string,
  templateBranchId?: string | null,
): Promise<string | null> {
  if (templateBranchId) {
    return templateBranchId;
  }

  const activeBranch = await db.branch.findFirst({
    where: { organizationId, isActive: true, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return activeBranch?.id ?? null;
}

export async function resolveAdmissionCycle(
  organizationId: string,
  admissionCycleId?: string | null,
): Promise<{ id: string; name: string; academicYear: string } | null> {
  if (admissionCycleId) {
    const cycle = await db.admissionCycle.findFirst({
      where: {
        id: admissionCycleId,
        organizationId,
        status: { in: ["OPEN", "DRAFT"] },
      },
      select: { id: true, name: true, academicYear: true },
    });

    return cycle ?? null;
  }

  const cycle = await db.admissionCycle.findFirst({
    where: {
      organizationId,
      status: { in: ["OPEN", "DRAFT"] },
    },
    select: { id: true, name: true, academicYear: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return cycle ?? null;
}
