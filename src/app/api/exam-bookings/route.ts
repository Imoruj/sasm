import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import { applicantLimiter } from "@/lib/ratelimit";

const nanoidQR = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 12);

const bookExamSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  examSessionId: z.string().uuid("Invalid exam session ID"),
  bookedDate: z.string().optional(), // ISO date string "YYYY-MM-DD" chosen by the applicant
});

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await applicantLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const applicationId = searchParams.get("applicationId");

    if (!applicationId) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "applicationId query parameter is required"),
        { status: 400 }
      );
    }

    // Verify the application belongs to the current user
    const application = await db.application.findFirst({
      where: {
        id: applicationId,
        applicantId: session.user.id,
      },
      select: {
        id: true,
        status: true,
        classApplied: true,
        organizationId: true,
        branchId: true,
        admissionCycleId: true,
      },
    });
    if (!application) {
      return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    }

    const bookings = await db.examBooking.findMany({
      where: { applicationId },
      include: {
        examSession: {
          include: {
            branch: { select: { name: true } },
            admissionCycle: { select: { name: true, academicYear: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(ok(bookings));
  } catch (error) {
    console.error("[GET_EXAM_BOOKINGS]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const body = await req.json();
    const validated = bookExamSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    const { applicationId, examSessionId, bookedDate } = validated.data;

    // Verify application belongs to current user and is in APPROVED status
    const application = await db.application.findFirst({
      where: {
        id: applicationId,
        applicantId: session.user.id,
      },
    });
    if (!application) {
      return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });
    }
    if (application.status !== "APPROVED") {
      return NextResponse.json(
        err("INVALID_STATE", "Your application must be approved before booking an exam"),
        { status: 400 }
      );
    }

    // Verify exam session exists and has available slots
    const examSession = await db.examSession.findFirst({
      where: {
        id: examSessionId,
        organizationId: application.organizationId,
        branchId: application.branchId,
        admissionCycleId: application.admissionCycleId,
        status: "SCHEDULED",
        classLevels: { has: application.classApplied },
      },
    });
    if (!examSession) {
      return NextResponse.json(
        err("NOT_FOUND", "Exam session not found or not available for your application"),
        { status: 404 }
      );
    }
    if (examSession.bookedCount >= examSession.capacity) {
      return NextResponse.json(
        err("SESSION_FULL", "This exam session is fully booked"),
        { status: 409 }
      );
    }

    // Check if already booked for this session
    const existingBooking = await db.examBooking.findFirst({
      where: {
        applicationId,
        examSessionId,
        status: { notIn: ["CANCELLED"] },
      },
    });
    if (existingBooking) {
      return NextResponse.json(
        err("ALREADY_BOOKED", "You have already booked this exam session"),
        { status: 409 }
      );
    }

    const qrCode = nanoidQR();

    const booking = await db.$transaction(async (tx) => {
      // Create the booking
      const newBooking = await tx.examBooking.create({
        data: {
          applicationId,
          examSessionId,
          qrCode,
          status: "BOOKED",
          ...(bookedDate ? { bookedDate: new Date(bookedDate) } : {}),
        },
        include: {
          examSession: {
            include: {
              branch: { select: { name: true } },
              admissionCycle: { select: { name: true, academicYear: true } },
            },
          },
        },
      });

      // Increment bookedCount
      await tx.examSession.update({
        where: { id: examSessionId },
        data: { bookedCount: { increment: 1 } },
      });

      // Update application status to EXAM_SCHEDULED
      await tx.application.update({
        where: { id: applicationId },
        data: { status: "EXAM_SCHEDULED" },
      });

      // Create status history entry
      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: "APPROVED",
          toStatus: "EXAM_SCHEDULED",
          changedBy: session.user.id,
          reason: `Booked exam session: ${examSession.title}`,
          metadata: { examSessionId, qrCode },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: application.organizationId,
          action: "EXAM_BOOKED",
          entityType: "ExamBooking",
          entityId: newBooking.id,
          changes: {
            after: { applicationId, examSessionId, qrCode },
          },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      });

      return newBooking;
    });

    return NextResponse.json(ok(booking), { status: 201 });
  } catch (error) {
    console.error("[CREATE_EXAM_BOOKING]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
