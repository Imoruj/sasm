import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createExamSessionSchema } from "@/validators/adminSchema";
import { ok, err } from "@/types/api";
import { z } from "zod";
import { adminLimiter } from "@/lib/ratelimit";

const createSessionBodySchema = createExamSessionSchema.extend({
  admissionCycleId: z.string().uuid("Invalid admission cycle ID"),
});

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await adminLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Insufficient permissions"), { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get("cycleId");

    const where = {
      organizationId: session.user.organizationId ?? "",
      ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
      ...(cycleId ? { admissionCycleId: cycleId } : {}),
    };

    const [sessions, total] = await Promise.all([
      db.examSession.findMany({
        where,
        include: {
          branch: { select: { name: true } },
          admissionCycle: { select: { name: true, academicYear: true } },
          _count: { select: { bookings: true } },
        },
        orderBy: { examDate: "asc" },
      }),
      db.examSession.count({ where }),
    ]);

    return NextResponse.json(ok({ sessions, total }));
  } catch (error) {
    console.error("[GET_EXAM_SESSIONS]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await adminLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Insufficient permissions"), { status: 403 });
    }

    const body = await req.json();
    const validated = createSessionBodySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    const {
      admissionCycleId,
      title,
      description,
      examDate,
      startTime,
      endTime,
      durationMinutes,
      mode,
      venue,
      onlineLink,
      capacity,
      classLevels,
    } = validated.data;

    // Verify admission cycle belongs to org
    const cycle = await db.admissionCycle.findFirst({
      where: {
        id: admissionCycleId,
        organizationId: session.user.organizationId ?? "",
      },
    });
    if (!cycle) {
      return NextResponse.json(
        err("NOT_FOUND", "Admission cycle not found or does not belong to your organization"),
        { status: 404 }
      );
    }

    // SCHOOL_ADMIN must have a branchId
    if (session.user.role === "SCHOOL_ADMIN" && !session.user.branchId) {
      return NextResponse.json(
        err("MISSING_BRANCH", "School admin must be assigned to a branch"),
        { status: 400 }
      );
    }

    const branchId =
      session.user.branchId ??
      (body.branchId as string | undefined);

    if (!branchId) {
      return NextResponse.json(
        err("MISSING_BRANCH", "Branch ID is required"),
        { status: 400 }
      );
    }

    const examSession = await db.$transaction(async (tx) => {
      const created = await tx.examSession.create({
        data: {
          organizationId: session.user.organizationId!,
          branchId,
          admissionCycleId,
          title,
          description,
          examDate: new Date(examDate),
          startTime,
          endTime,
          durationMinutes,
          mode,
          venue: mode === "ON_CAMPUS" ? venue : null,
          onlineLink: mode === "ONLINE" ? (onlineLink || null) : null,
          capacity,
          classLevels,
          status: "SCHEDULED",
        },
        include: {
          branch: { select: { name: true } },
          admissionCycle: { select: { name: true, academicYear: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "EXAM_SESSION_CREATED",
          entityType: "ExamSession",
          entityId: created.id,
          changes: { after: { title, examDate, mode, capacity } },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      });

      return created;
    });

    return NextResponse.json(ok(examSession), { status: 201 });
  } catch (error) {
    console.error("[CREATE_EXAM_SESSION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
