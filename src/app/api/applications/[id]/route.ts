import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateApplicationSchema } from "@/validators/applicationSchema";
import { ok, err } from "@/types/api";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const { id } = await params;

    const isApplicant = session.user.role === "APPLICANT";
    const applicationWhere = isApplicant
      ? { id, applicantId: session.user.id }
      : {
          id,
          organizationId: session.user.organizationId ?? "",
          ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
        };
    const application = await db.application.findFirst({
      where: applicationWhere,
      include: {
        branch: true,
        admissionCycle: true,
        documents: true,
        statusHistory: { orderBy: { createdAt: "desc" } },
        examBookings: { include: { examSession: true }, orderBy: { createdAt: "desc" } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });

    return NextResponse.json(ok(application));
  } catch (error) {
    console.error("[GET_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const { id } = await params;

    const isApplicant = session.user.role === "APPLICANT";
    const applicationWhere = isApplicant
      ? { id, applicantId: session.user.id }
      : {
          id,
          organizationId: session.user.organizationId ?? "",
          ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
        };
    const application = await db.application.findFirst({
      where: applicationWhere,
      select: { id: true, status: true },
    });

    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    if (!["DRAFT", "REVISION_REQUIRED"].includes(application.status)) {
      return NextResponse.json(err("INVALID_STATE", "Application cannot be edited in its current status"), { status: 400 });
    }

    const body = await req.json();
    const validated = updateApplicationSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
    }

    const { formData, studentDob, ...rest } = validated.data;
    const updated = await db.application.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        ...rest,
        ...(formData !== undefined ? { formData: formData as any } : {}),
        ...(studentDob !== undefined ? { studentDob: new Date(studentDob) } : {}),
      },
    });

    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("[UPDATE_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
