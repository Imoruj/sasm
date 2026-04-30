import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import type { ApplicationStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_PAYMENT_EVIDENCE_STATUSES: ApplicationStatus[] = ["DRAFT", "REVISION_REQUIRED", "UNDER_REVIEW"];

/** GET — return the current payment evidence URL */
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const { id } = await params;
    const isApplicant = session.user.role === "APPLICANT";
    const where = isApplicant
      ? { id, applicantId: session.user.id }
      : { id, organizationId: session.user.organizationId ?? "" };

    const application = await db.application.findFirst({
      where,
      select: { paymentEvidenceUrl: true },
    });
    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });

    return NextResponse.json(ok({ evidenceUrl: application.paymentEvidenceUrl ?? null }));
  } catch (error) {
    console.error("[GET_PAYMENT_EVIDENCE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}

/** PATCH — save the uploaded evidence URL to the application */
export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const { id } = await params;
    const { evidenceUrl } = await req.json();

    if (!evidenceUrl || typeof evidenceUrl !== "string") {
      return NextResponse.json(err("VALIDATION_ERROR", "evidenceUrl is required"), { status: 400 });
    }

    const isApplicant = session.user.role === "APPLICANT";
    const applicationWhere = isApplicant
      ? {
          id,
          applicantId: session.user.id,
          status: { in: ALLOWED_PAYMENT_EVIDENCE_STATUSES },
        }
      : {
          id,
          organizationId: session.user.organizationId ?? "",
          ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
          status: { in: ALLOWED_PAYMENT_EVIDENCE_STATUSES },
        };

    const application = await db.application.findFirst({
      where: applicationWhere,
      select: { id: true, status: true },
    });
    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });

    // Saving evidence automatically moves the application into review queue
    await db.application.update({
      where: { id },
      data: {
        paymentEvidenceUrl: evidenceUrl,
        status: "UNDER_REVIEW",
        paymentStatus: "PENDING",
        submittedAt: new Date(),
      },
    });

    return NextResponse.json(ok({ message: "Payment evidence saved" }));
  } catch (error) {
    console.error("[PATCH_PAYMENT_EVIDENCE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
