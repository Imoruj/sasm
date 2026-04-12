import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { id } = await params;

    // Find the booking and verify it belongs to the current user via application
    const booking = await db.examBooking.findFirst({
      where: { id },
      include: {
        application: { select: { applicantId: true, status: true, organizationId: true } },
        examSession: { select: { title: true } },
      },
    });

    if (!booking) {
      return NextResponse.json(err("NOT_FOUND", "Booking not found"), { status: 404 });
    }

    if (booking.application.applicantId !== session.user.id) {
      return NextResponse.json(err("FORBIDDEN", "You do not have permission to cancel this booking"), { status: 403 });
    }

    if (booking.status !== "BOOKED") {
      return NextResponse.json(
        err("INVALID_STATE", "Only bookings in BOOKED status can be cancelled"),
        { status: 400 }
      );
    }

    await db.$transaction(async (tx) => {
      // Cancel the booking
      await tx.examBooking.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      // Decrement bookedCount
      await tx.examSession.update({
        where: { id: booking.examSessionId },
        data: { bookedCount: { decrement: 1 } },
      });

      // Revert application status to APPROVED
      await tx.application.update({
        where: { id: booking.applicationId },
        data: { status: "APPROVED" },
      });

      // Create status history entry
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: booking.applicationId,
          fromStatus: "EXAM_SCHEDULED",
          toStatus: "APPROVED",
          changedBy: session.user.id,
          reason: `Cancelled exam booking for: ${booking.examSession.title}`,
          metadata: { examBookingId: id },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: booking.application.organizationId,
          action: "EXAM_BOOKING_CANCELLED",
          entityType: "ExamBooking",
          entityId: id,
          changes: {
            before: { status: "BOOKED" },
            after: { status: "CANCELLED" },
          },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      });
    });

    return NextResponse.json(ok({ id, status: "CANCELLED" }));
  } catch (error) {
    console.error("[CANCEL_EXAM_BOOKING]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
