import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createExamSessionSchema } from "@/validators/adminSchema";
import { ok, err } from "@/types/api";
import { z } from "zod";
import { adminLimiter } from "@/lib/ratelimit";

const updateStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

const patchBodySchema = createExamSessionSchema.partial().merge(updateStatusSchema);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();
    const validated = patchBodySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.examSession.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId ?? "",
        ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
      },
    });
    if (!existing) {
      return NextResponse.json(err("NOT_FOUND", "Exam session not found"), { status: 404 });
    }

    if (existing.status === "CANCELLED") {
      return NextResponse.json(
        err("INVALID_STATE", "Cannot update a cancelled exam session"),
        { status: 400 }
      );
    }

    const {
      status,
      examDate,
      mode,
      venue,
      onlineLink,
      ...rest
    } = validated.data;

    // Build update data
    const updateData: Record<string, unknown> = { ...rest };
    if (examDate) updateData.examDate = new Date(examDate);
    if (mode !== undefined) {
      updateData.mode = mode;
      updateData.venue = mode === "ON_CAMPUS" ? (venue ?? existing.venue) : null;
      updateData.onlineLink = mode === "ONLINE" ? (onlineLink || existing.onlineLink || null) : null;
    } else {
      if (venue !== undefined) updateData.venue = venue;
      if (onlineLink !== undefined) updateData.onlineLink = onlineLink || null;
    }
    if (status !== undefined) updateData.status = status;

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.examSession.update({
        where: { id },
        data: updateData,
        include: {
          branch: { select: { name: true } },
          admissionCycle: { select: { name: true, academicYear: true } },
          _count: { select: { bookings: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "EXAM_SESSION_UPDATED",
          entityType: "ExamSession",
          entityId: id,
          changes: JSON.parse(JSON.stringify({ before: existing, after: updateData })),
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      });

      return result;
    });

    return NextResponse.json(ok(updated));
  } catch (error) {
    console.error("[UPDATE_EXAM_SESSION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Verify ownership
    const existing = await db.examSession.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId ?? "",
        ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
      },
    });
    if (!existing) {
      return NextResponse.json(err("NOT_FOUND", "Exam session not found"), { status: 404 });
    }

    if (existing.status === "CANCELLED") {
      return NextResponse.json(
        err("ALREADY_CANCELLED", "Exam session is already cancelled"),
        { status: 400 }
      );
    }

    const cancelled = await db.$transaction(async (tx) => {
      const result = await tx.examSession.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: session.user.organizationId,
          action: "EXAM_SESSION_CANCELLED",
          entityType: "ExamSession",
          entityId: id,
          changes: { before: { status: existing.status }, after: { status: "CANCELLED" } },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      });

      return result;
    });

    return NextResponse.json(ok(cancelled));
  } catch (error) {
    console.error("[CANCEL_EXAM_SESSION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
