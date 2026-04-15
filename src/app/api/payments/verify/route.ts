import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyTransaction } from "@/lib/paystack";
import { ok, err } from "@/types/api";
import { z } from "zod";
import { applicantLimiter } from "@/lib/ratelimit";
import { sendEnrollmentConfirmationEmail } from "@/lib/email";

const schema = z.object({ reference: z.string().min(1) });

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
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input"), { status: 400 });
    }

    const { reference } = validated.data;

    // Find the pending payment record
    const payment = await db.payment.findFirst({
      where: { gatewayReference: reference },
      include: {
        application: {
          include: { applicant: { select: { email: true, firstName: true } } },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(err("NOT_FOUND", "Payment not found"), { status: 404 });
    }

    // Guard: applicant can only verify their own payments
    if (payment.application.applicantId !== session.user.id) {
      return NextResponse.json(err("FORBIDDEN", "Access denied"), { status: 403 });
    }

    // Already verified
    if (payment.status === "PAID") {
      return NextResponse.json(ok({ status: "PAID", amountKobo: payment.amountKobo }));
    }

    // Verify with Paystack
    const paystackRes = await verifyTransaction(reference);

    if (paystackRes.data.status !== "success") {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", gatewayResponse: paystackRes.data as object },
      });
      return NextResponse.json(
        err("PAYMENT_FAILED", `Payment ${paystackRes.data.status}. Please try again.`),
        { status: 400 }
      );
    }

    // Confirm amount matches (guard against tampered requests)
    if (paystackRes.data.amount !== payment.amountKobo) {
      console.error("[PAYMENT_VERIFY] Amount mismatch", {
        expected: payment.amountKobo,
        received: paystackRes.data.amount,
      });
      return NextResponse.json(err("AMOUNT_MISMATCH", "Payment amount mismatch"), { status: 400 });
    }

    const isAdmissionFee = payment.paymentType === "ADMISSION_FEE";

    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paidAt: new Date(paystackRes.data.paid_at),
          gatewayResponse: paystackRes.data as object,
        },
      }),
      ...(!isAdmissionFee
        ? [
            db.application.update({
              where: { id: payment.applicationId },
              data: { paymentStatus: "PAID" },
            }),
          ]
        : []),
    ]);

    // If this is an ADMISSION_FEE payment, check if all documents are verified
    // and auto-enroll the student if so (handles the case where payment is confirmed
    // AFTER all documents were already approved).
    if (isAdmissionFee) {
      const application = await db.application.findFirst({
        where: { id: payment.applicationId, status: "ADMITTED" },
        include: {
          documents: { select: { id: true } },
          applicant: { select: { id: true, email: true, firstName: true } },
          branch: { select: { name: true } },
          admissionCycle: { select: { name: true } },
          organization: { select: { name: true } },
        },
      });

      if (application && application.documents.length > 0) {
        const verifiedCount = await db.applicationDocument.count({
          where: { applicationId: application.id, isVerified: true },
        });

        if (verifiedCount === application.documents.length) {
          // All docs verified + fee now paid → enroll
          await db.application.update({
            where: { id: application.id },
            data: { status: "ENROLLED" },
          });

          await db.applicationStatusHistory.create({
            data: {
              applicationId: application.id,
              toStatus: "ENROLLED",
              reason: "Admission fee confirmed. All documents already verified. Student auto-enrolled.",
            },
          });

          await db.notification.create({
            data: {
              userId: application.applicant.id,
              type: "IN_APP",
              category: "APPLICATION_UPDATE",
              title: "Admission Confirmed — You are Enrolled!",
              message: `Congratulations! Your admission fee has been confirmed and all documents verified. Your child has been officially enrolled at ${application.organization.name}.`,
              data: { applicationId: application.id, link: "/dashboard/applications" },
              deliveryStatus: "PENDING",
            },
          });

          sendEnrollmentConfirmationEmail(
            application.applicant.email,
            application.applicant.firstName ?? "Parent",
            `${application.studentFirstName ?? ""} ${application.studentLastName ?? ""}`.trim(),
            application.applicationNumber,
            application.organization.name,
            application.branch.name,
            application.classApplied ?? undefined,
          ).catch((e) => console.error("[ENROLLMENT_EMAIL_ON_PAYMENT]", e));
        }
      }
    }

    return NextResponse.json(ok({ status: "PAID", amountKobo: payment.amountKobo }));
  } catch (error) {
    console.error("[PAYMENT_VERIFY]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
