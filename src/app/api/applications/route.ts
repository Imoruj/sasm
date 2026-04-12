import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createApplicationSchema } from "@/validators/applicationSchema";
import { ok, err } from "@/types/api";
import { generateApplicationNumber } from "@/lib/utils";
import { applicantLimiter } from "@/lib/ratelimit";

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
    if (session.user.role !== "APPLICANT") return NextResponse.json(err("FORBIDDEN", "Only applicants can create applications"), { status: 403 });

    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success: allowed } = await applicantLimiter.limit(ip);
    if (!allowed) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const body = await req.json();
    const validated = createApplicationSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
    }

    const { branchId, admissionCycleId, classApplied } = validated.data;

    // Verify branch exists and get organization
    const branch = await db.branch.findFirst({
      where: { id: branchId, isActive: true },
      select: { organizationId: true },
    });
    if (!branch) return NextResponse.json(err("NOT_FOUND", "Branch not found"), { status: 404 });

    // Check for duplicate active application
    const existing = await db.application.findFirst({
      where: {
        applicantId: session.user.id,
        branchId,
        admissionCycleId,
        status: { notIn: ["REJECTED", "NOT_ADMITTED"] },
      },
    });
    if (existing) {
      return NextResponse.json(err("DUPLICATE", "You already have an active application for this branch and cycle."), { status: 409 });
    }

    const application = await db.application.create({
      data: {
        applicationNumber: generateApplicationNumber(),
        applicantId: session.user.id,
        organizationId: branch.organizationId,
        branchId,
        admissionCycleId,
        classApplied,
        status: "DRAFT",
      },
    });

    return NextResponse.json(ok(application), { status: 201 });
  } catch (error) {
    console.error("[CREATE_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
