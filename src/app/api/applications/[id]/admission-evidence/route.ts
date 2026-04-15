import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { getUploadPresignedUrl } from "@/lib/storage";
import { applicantLimiter } from "@/lib/ratelimit";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — return a presigned upload URL for bank-transfer evidence */
export async function GET(req: Request, { params }: RouteContext) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await applicantLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const { id } = await params;

    const application = await db.application.findFirst({
      where: { id, applicantId: session.user.id, status: "ADMITTED" },
      select: { id: true },
    });
    if (!application) {
      return NextResponse.json(err("NOT_FOUND", "Application not found or not in ADMITTED status"), { status: 404 });
    }

    // Reject if already paid
    const existingPaid = await db.payment.findFirst({
      where: { applicationId: id, paymentType: "ADMISSION_FEE", status: "PAID" },
    });
    if (existingPaid) {
      return NextResponse.json(err("ALREADY_PAID", "Admission acceptance fee has already been paid"), { status: 400 });
    }

    const { uploadUrl, publicUrl } = await getUploadPresignedUrl(
      `admission-evidence/${id}`,
      `receipt-${Date.now()}.jpg`,
      "image/jpeg",
      300,
    );

    return NextResponse.json(ok({ uploadUrl, publicUrl }));
  } catch (error) {
    console.error("[GET_ADMISSION_EVIDENCE_URL]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}

const confirmSchema = z.object({
  receiptUrl: z.string().url(),
  contentType: z.string().min(1),
});

/** POST — save receipt URL → create/update a BANK_TRANSFER pending Payment */
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await applicantLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const { id } = await params;

    const application = await db.application.findFirst({
      where: { id, applicantId: session.user.id, status: "ADMITTED" },
      select: { id: true, organizationId: true, admissionCycleId: true, branchId: true, classApplied: true },
    });
    if (!application) {
      return NextResponse.json(err("NOT_FOUND", "Application not found or not in ADMITTED status"), { status: 404 });
    }

    const existingPaid = await db.payment.findFirst({
      where: { applicationId: id, paymentType: "ADMISSION_FEE", status: "PAID" },
    });
    if (existingPaid) {
      return NextResponse.json(err("ALREADY_PAID", "Admission acceptance fee has already been paid"), { status: 400 });
    }

    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()), { status: 400 });
    }

    const { receiptUrl } = parsed.data;

    // Look up the fee amount
    const feeStructure = await db.feeStructure.findFirst({
      where: {
        admissionCycleId: application.admissionCycleId,
        paymentType: "ADMISSION_FEE",
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

    // Upsert: update existing pending BANK_TRANSFER payment or create one
    const existingPending = await db.payment.findFirst({
      where: { applicationId: id, paymentType: "ADMISSION_FEE", gateway: "BANK_TRANSFER", status: "PENDING" },
    });

    const payment = existingPending
      ? await db.payment.update({
          where: { id: existingPending.id },
          data: { receiptUrl },
        })
      : await db.payment.create({
          data: {
            organizationId: application.organizationId,
            applicationId: id,
            paymentType: "ADMISSION_FEE",
            amountKobo: feeStructure?.amountKobo ?? 0,
            currency: "NGN",
            gateway: "BANK_TRANSFER",
            gatewayReference: `BT-ADMISSION-${id.slice(0, 8).toUpperCase()}`,
            status: "PENDING",
            receiptUrl,
          },
        });

    return NextResponse.json(ok({ paymentId: payment.id, receiptUrl }), { status: 201 });
  } catch (error) {
    console.error("[POST_ADMISSION_EVIDENCE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
