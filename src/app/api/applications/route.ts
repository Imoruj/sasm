import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createApplicationSchema } from "@/validators/applicationSchema";
import { ok, err } from "@/types/api";
import { buildApplicationNumber } from "@/lib/utils";
import { applicantLimiter } from "@/lib/ratelimit";
import { resolveAdmissionCycle, resolveSessionOrganizationId, resolveTemplateBranchId } from "@/lib/tenant";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const applications = await db.application.findMany({
      where: { applicantId: session.user.id },
      include: {
        branch: { select: { name: true } },
        admissionCycle: { select: { academicYear: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(ok(applications));
  } catch (error) {
    console.error("[GET_APPLICATIONS]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    // Applicants and staff (who may apply on behalf of their children) are allowed
    if (!["APPLICANT", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Not authorized to create applications"), { status: 403 });
    }

    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success: allowed } = await applicantLimiter.limit(ip);
    if (!allowed) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const body = await req.json();
    const validated = createApplicationSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
    }

    const { branchId, admissionCycleId, classApplied, templateId, actingApplicantEmail } = validated.data;

    const isApplicant = session.user.role === "APPLICANT";
    const organizationId = isApplicant
      ? await resolveSessionOrganizationId(session.user.id, session.user.organizationId)
      : session.user.organizationId ?? null;
    if (!organizationId) {
      return NextResponse.json(err("NOT_FOUND", "No school context found for this user"), { status: 404 });
    }

    const template = await db.formTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        organizationId: true,
        branchId: true,
        classLevels: true,
      },
    });

    if (!template) {
      return NextResponse.json(err("NOT_FOUND", "Published application template not found"), { status: 404 });
    }
    if (template.classLevels.length > 0 && !template.classLevels.includes(classApplied as never)) {
      return NextResponse.json(err("VALIDATION_ERROR", "This template is not available for the selected class"), { status: 400 });
    }

    const resolvedBranchId = branchId ?? await resolveTemplateBranchId(template.organizationId, template.branchId);
    if (!resolvedBranchId) {
      return NextResponse.json(err("VALIDATION_ERROR", "The published template is not linked to a branch"), { status: 400 });
    }

    if (
      session.user.role === "SCHOOL_ADMIN" &&
      session.user.branchId &&
      resolvedBranchId !== session.user.branchId
    ) {
      return NextResponse.json(err("FORBIDDEN", "Insufficient permissions for the selected branch"), { status: 403 });
    }
    const resolvedAdmissionCycle = await resolveAdmissionCycle(template.organizationId, admissionCycleId);
    if (!resolvedAdmissionCycle) {
      return NextResponse.json(err("VALIDATION_ERROR", "No active admission cycle is available for this template"), { status: 400 });
    }

    // Verify branch exists and get organization
    const [branch, org] = await Promise.all([
      db.branch.findFirst({
        where: { id: resolvedBranchId, organizationId: template.organizationId, isActive: true },
        select: { organizationId: true, name: true },
      }),
      db.organization.findUnique({
        where: { id: template.organizationId },
        select: { name: true },
      }),
    ]);
    if (!branch) return NextResponse.json(err("NOT_FOUND", "Branch not found"), { status: 404 });

    // If admin is acting on behalf of an applicant, resolve that applicant account here.
    let applicantId = session.user.id;
    if (!isApplicant) {
      if (!actingApplicantEmail) {
        return NextResponse.json(
          err("VALIDATION_ERROR", "actingApplicantEmail is required when creating on behalf of an applicant"),
          { status: 400 },
        );
      }

      const actingApplicant = await db.user.findFirst({
        where: {
          email: actingApplicantEmail,
          role: "APPLICANT",
          isActive: true,
        },
        select: { id: true, organizationId: true },
      });

      if (!actingApplicant) {
        return NextResponse.json(err("NOT_FOUND", "Applicant account not found"), { status: 404 });
      }
      if (actingApplicant.organizationId && actingApplicant.organizationId !== organizationId) {
        return NextResponse.json(err("FORBIDDEN", "Applicant does not belong to this school"), { status: 403 });
      }

      applicantId = actingApplicant.id;
    }

    // Count existing applications for this branch in the current year to build a sequential number
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const existingCount = await db.application.count({
      where: { branchId: resolvedBranchId, createdAt: { gte: yearStart } },
    });
    const applicationNumber = buildApplicationNumber(
      org?.name ?? "SAMS",
      branch.name,
      existingCount + 1,
    );

    // No duplicate check — a parent/guardian may submit multiple applications
    // for different children under the same account.

    const application = await db.application.create({
      data: {
        applicationNumber,
        applicantId,
        organizationId: branch.organizationId,
        branchId: resolvedBranchId,
        admissionCycleId: resolvedAdmissionCycle.id,
        classApplied,
        formTemplateId: template.id,
        status: "DRAFT",
      },
    });

    return NextResponse.json(ok(application), { status: 201 });
  } catch (error) {
    console.error("[CREATE_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
