import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { z } from "zod";

const schema = z.object({
  applicationId: z.string().uuid(),
});

/**
 * GET /api/applications/fees?applicationId=xxx
 * Returns the APPLICATION_FEE and ONLINE_TEST_FEE for the given application's
 * branch + cycle, so the wizard can show the fee breakdown before redirecting
 * to Paystack.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = schema.safeParse({ applicationId: searchParams.get("applicationId") });
    if (!parsed.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "applicationId is required"), { status: 400 });
    }

    const { applicationId } = parsed.data;

    const isApplicant = session.user.role === "APPLICANT";
    const applicationWhere = isApplicant
      ? { id: applicationId, applicantId: session.user.id }
      : {
          id: applicationId,
          organizationId: session.user.organizationId ?? "",
          ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
        };

    const application = await db.application.findFirst({
      where: applicationWhere,
      select: { branchId: true, admissionCycleId: true, classApplied: true, organizationId: true },
    });

    if (!application) {
      return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    }

    // Look up fees with same priority as payment/initialize: branch+class > branch > class > org-wide
    const [appFee, onlineFee] = await Promise.all([
      db.feeStructure.findFirst({
        where: {
          admissionCycleId: application.admissionCycleId,
          paymentType: "APPLICATION_FEE",
          isActive: true,
          OR: [
            { branchId: application.branchId, classLevel: application.classApplied },
            { branchId: application.branchId, classLevel: null },
            { branchId: null, classLevel: application.classApplied },
            { branchId: null, classLevel: null },
          ],
        },
        orderBy: [{ branchId: "desc" }, { classLevel: "desc" }],
        select: { amountKobo: true },
      }),
      db.feeStructure.findFirst({
        where: {
          admissionCycleId: application.admissionCycleId,
          paymentType: "ONLINE_TEST_FEE",
          isActive: true,
          OR: [
            { branchId: application.branchId, classLevel: application.classApplied },
            { branchId: application.branchId, classLevel: null },
            { branchId: null, classLevel: application.classApplied },
            { branchId: null, classLevel: null },
          ],
        },
        orderBy: [{ branchId: "desc" }, { classLevel: "desc" }],
        select: { amountKobo: true },
      }),
    ]);

    return NextResponse.json(
      ok({
        applicationFeeKobo: appFee?.amountKobo ?? 0,
        onlineTestFeeKobo: onlineFee?.amountKobo ?? 0,
      })
    );
  } catch (error) {
    console.error("[APPLICATION_FEES]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
