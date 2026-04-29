import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    });

    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    if (!["DRAFT", "REVISION_REQUIRED"].includes(application.status)) {
      return NextResponse.json(err("INVALID_STATE", "Application cannot be submitted in its current state"), { status: 400 });
    }

    // Check mandatory fields
    if (!application.studentFirstName || !application.studentLastName || !application.studentDob) {
      return NextResponse.json(err("INCOMPLETE", "Please complete all required fields before submitting"), { status: 400 });
    }

    const [updated] = await db.$transaction([
      db.application.update({
        where: { id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      }),
      db.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: "SUBMITTED",
          changedBy: session.user.id,
        },
      }),
    ]);

    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("[SUBMIT_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
