import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { adminLimiter } from "@/lib/ratelimit";
import { buildApplicationNumber } from "@/lib/utils";
import { resolveAdmissionCycle, resolveTemplateBranchId } from "@/lib/tenant";
import { startApplicationForApplicantSchema } from "@/validators/adminSchema";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await adminLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Insufficient permissions"), { status: 403 });
    }

    const body = await req.json();
    const validated = startApplicationForApplicantSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
    }

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    const { applicantEmail, branchId, admissionCycleId, classApplied, templateId } = validated.data;

    const template = await db.formTemplate.findFirst({
      where: {
        id: templateId,
        status: "PUBLISHED",
        ...(isSuperAdmin ? {} : { organizationId: session.user.organizationId ?? "" }),
      },
      select: { id: true, organizationId: true, branchId: true, classLevels: true },
    });

    if (!template) {
      return NextResponse.json(err("NOT_FOUND", "Published application template not found"), { status: 404 });
    }
    if (template.classLevels.length > 0 && !template.classLevels.includes(classApplied as never)) {
      return NextResponse.json(err("VALIDATION_ERROR", "This template is not available for the selected class"), { status: 400 });
    }

    const applicant = await db.user.findUnique({
      where: { email: applicantEmail },
      select: { id: true, role: true, organizationId: true, isActive: true, firstName: true, lastName: true },
    });

    if (!applicant || !applicant.isActive) {
      return NextResponse.json(err("NOT_FOUND", "Applicant account not found"), { status: 404 });
    }
    if (applicant.role !== "APPLICANT") {
      return NextResponse.json(err("VALIDATION_ERROR", "User is not an applicant account"), { status: 400 });
    }
    if (applicant.organizationId && applicant.organizationId !== template.organizationId) {
      return NextResponse.json(err("FORBIDDEN", "Applicant does not belong to this school"), { status: 403 });
    }

    const resolvedBranchId = branchId ?? await resolveTemplateBranchId(template.organizationId, template.branchId);
    if (!resolvedBranchId) {
      return NextResponse.json(err("VALIDATION_ERROR", "The published template is not linked to a branch"), { status: 400 });
    }
    const resolvedAdmissionCycle = await resolveAdmissionCycle(template.organizationId, admissionCycleId);
    if (!resolvedAdmissionCycle) {
      return NextResponse.json(err("VALIDATION_ERROR", "No active admission cycle is available for this template"), { status: 400 });
    }

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

    const created = await db.application.create({
      data: {
        applicationNumber,
        applicantId: applicant.id,
        organizationId: branch.organizationId,
        branchId: resolvedBranchId,
        admissionCycleId: resolvedAdmissionCycle.id,
        classApplied,
        formTemplateId: template.id,
        status: "DRAFT",
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        action: "APPLICATION_STARTED_FOR_APPLICANT",
        entityType: "Application",
        entityId: created.id,
        changes: {
          applicant: { email: applicantEmail, id: applicant.id },
          applicationNumber: created.applicationNumber,
        },
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? "",
      },
    });

    const resumeUrl = `/dashboard/applications/new?resume=${created.id}`;

    return NextResponse.json(ok({
      application: created,
      applicant: {
        id: applicant.id,
        email: applicantEmail,
        name: [applicant.firstName, applicant.lastName].filter(Boolean).join(" "),
      },
      resumeUrl,
    }), { status: 201 });
  } catch (error) {
    console.error("[ADMIN_START_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

