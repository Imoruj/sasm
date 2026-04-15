import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { initializeTransaction } from "@/lib/paystack";
import { ok, err } from "@/types/api";
import { nanoid } from "nanoid";
import { z } from "zod";
import { applicantLimiter } from "@/lib/ratelimit";

const schema = z.object({
  applicationId: z.string().uuid(),
  paymentType: z.enum(["APPLICATION_FEE", "EXAM_FEE", "ADMISSION_FEE", "ONLINE_TEST_FEE"]).default("APPLICATION_FEE"),
  placementTestType: z.enum(["ON_CAMPUS", "ONLINE"]).optional(),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await applicantLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const body = await req.json();
    const validated = schema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
    }

    const { applicationId, paymentType, placementTestType } = validated.data;

    // Load application + applicant + fee structure
    const application = await db.application.findFirst({
      where: { id: applicationId, applicantId: session.user.id },
      include: {
        applicant: { select: { email: true, firstName: true, lastName: true } },
        admissionCycle: true,
        branch: { select: { name: true } },
      },
    });

    if (!application) {
      return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    }

    // Check for existing successful payment
    const existingPaid = await db.payment.findFirst({
      where: { applicationId, paymentType, status: "PAID" },
    });
    if (existingPaid) {
      return NextResponse.json(err("ALREADY_PAID", "This fee has already been paid"), { status: 400 });
    }

    // Look up fee structure: branch-specific first, then org-wide
    const feeStructure = await db.feeStructure.findFirst({
      where: {
        admissionCycleId: application.admissionCycleId,
        paymentType,
        isActive: true,
        OR: [
          { branchId: application.branchId, classLevel: application.classApplied },
          { branchId: application.branchId, classLevel: null },
          { branchId: null, classLevel: application.classApplied },
          { branchId: null, classLevel: null },
        ],
      },
      orderBy: [
        { branchId: "desc" },  // prefer branch-specific
        { classLevel: "desc" }, // prefer class-specific
      ],
    });

    if (!feeStructure) {
      return NextResponse.json(
        err("NO_FEE_STRUCTURE", "No fee structure configured for this application. Please contact the school."),
        { status: 400 }
      );
    }

    // If online placement test selected, look up the surcharge and add it
    let totalAmountKobo = feeStructure.amountKobo;
    if (paymentType === "APPLICATION_FEE" && placementTestType === "ONLINE") {
      const onlineFeeStructure = await db.feeStructure.findFirst({
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
      });
      if (onlineFeeStructure) {
        totalAmountKobo += onlineFeeStructure.amountKobo;
      }
    }

    // Persist the placement test preference on the application
    if (placementTestType) {
      await db.application.update({
        where: { id: applicationId },
        data: { formData: { placementTestType } },
      });
    }

    // Create a pending Payment record + unique reference
    const reference = `SAMS-${nanoid(12).toUpperCase()}`;
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/applications/${applicationId}/payment-callback`;

    const payment = await db.payment.create({
      data: {
        organizationId: application.organizationId,
        applicationId,
        paymentType,
        amountKobo: totalAmountKobo,
        gateway: "PAYSTACK",
        gatewayReference: reference,
        status: "PENDING",
      },
    });

    // Initialize with Paystack
    const paystackRes = await initializeTransaction({
      email: application.applicant.email,
      amountKobo: totalAmountKobo,
      reference,
      callbackUrl,
      metadata: {
        paymentId: payment.id,
        applicationId,
        applicationNumber: application.applicationNumber,
        placementTestType: placementTestType ?? "ON_CAMPUS",
      },
    });

    return NextResponse.json(
      ok({
        authorizationUrl: paystackRes.data.authorization_url,
        reference,
        amountKobo: totalAmountKobo,
      })
    );
  } catch (error) {
    console.error("[PAYMENT_INITIALIZE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
