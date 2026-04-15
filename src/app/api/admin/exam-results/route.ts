import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { z } from "zod";
import { adminLimiter } from "@/lib/ratelimit";

function getGrade(pct: number): string {
  if (pct >= 75) return "A1";
  if (pct >= 70) return "B2";
  if (pct >= 65) return "B3";
  if (pct >= 60) return "C4";
  if (pct >= 55) return "C5";
  if (pct >= 50) return "C6";
  if (pct >= 45) return "D7";
  if (pct >= 40) return "E8";
  return "F9";
}

const createResultSchema = z.object({
  examBookingId: z.string().uuid(),
  applicationId: z.string().uuid(),
  scoreBreakdown: z.record(z.string(), z.number().min(0)),
  totalScore: z.number().min(0),
  maxScore: z.number().min(1),
  isPassed: z.boolean(),
  remarks: z.string().max(1000).optional(),
});

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
    const validated = createResultSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
    }

    const { examBookingId, applicationId, scoreBreakdown, totalScore, maxScore, isPassed, remarks } = validated.data;

    // Verify the booking belongs to this organization
    const booking = await db.examBooking.findFirst({
      where: {
        id: examBookingId,
        examSession: {
          organizationId: session.user.organizationId ?? "",
          ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
        },
      },
      select: {
        id: true,
        status: true,
        applicationId: true,
        application: {
          select: {
            id: true,
            status: true,
            organizationId: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(err("NOT_FOUND", "Exam booking not found"), { status: 404 });
    }

    if (booking.applicationId !== applicationId) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Exam booking does not match the selected application"),
        { status: 400 },
      );
    }

    const percentage = parseFloat(((totalScore / maxScore) * 100).toFixed(2));
    const grade = getGrade(percentage);

    // Upsert the result (create or update)
    const existingResult = await db.examResult.findUnique({ where: { examBookingId } });

    const result = existingResult
      ? await db.examResult.update({
          where: { examBookingId },
          data: {
            totalScore,
            maxScore,
            percentage,
            grade,
            scoreBreakdown,
            isPassed,
            remarks,
            gradedBy: session.user.id,
            // If re-grading a published result, unpublish it so admin must re-publish
            ...(existingResult.isPublished ? { isPublished: false, publishedAt: null } : {}),
          },
        })
      : await db.examResult.create({
          data: {
            examBookingId,
            applicationId: booking.applicationId,
            totalScore,
            maxScore,
            percentage,
            grade,
            scoreBreakdown,
            isPassed,
            remarks,
            gradedBy: session.user.id,
          },
        });

    // Mark booking as COMPLETED if it wasn't already
    if (booking.status !== "COMPLETED") {
      await db.examBooking.update({
        where: { id: examBookingId },
        data: { status: "COMPLETED" },
      });
    }

    // Transition application to EXAM_COMPLETED if still EXAM_SCHEDULED
    if (booking.application.status === "EXAM_SCHEDULED") {
      await db.$transaction([
        db.application.update({
          where: { id: booking.applicationId },
          data: { status: "EXAM_COMPLETED" },
        }),
        db.applicationStatusHistory.create({
          data: {
            applicationId: booking.applicationId,
            fromStatus: "EXAM_SCHEDULED",
            toStatus: "EXAM_COMPLETED",
            changedBy: session.user.id,
            reason: "Exam result entered by admin",
          },
        }),
      ]);
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        action: existingResult ? "EXAM_RESULT_UPDATED" : "EXAM_RESULT_CREATED",
        entityType: "ExamResult",
        entityId: result.id,
        changes: { totalScore, maxScore, percentage, isPassed, grade },
        ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
        userAgent: req.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json(ok(result), { status: existingResult ? 200 : 201 });
  } catch (error) {
    console.error("[EXAM_RESULT_CREATE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
