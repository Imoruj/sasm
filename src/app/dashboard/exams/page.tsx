import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import ExamBookingUI from "./ExamBookingUI";
import type { ClassLevel, ExamMode, ExamSessionStatus, ExamBookingStatus } from "@prisma/client";

export type ExamSessionForBooking = {
  id: string;
  title: string;
  description: string | null;
  examDate: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  mode: ExamMode;
  venue: string | null;
  onlineLink: string | null;
  capacity: number;
  bookedCount: number;
  classLevels: ClassLevel[];
  status: ExamSessionStatus;
  admissionCycleId: string;
  branchId: string;
  branch: { name: string };
  admissionCycle: { name: string; academicYear: string };
};

export type BookingWithSession = {
  id: string;
  applicationId: string;
  examSessionId: string;
  seatNumber: string | null;
  qrCode: string;
  checkInTime: Date | null;
  status: ExamBookingStatus;
  createdAt: Date;
  examSession: ExamSessionForBooking;
};

export default async function DashboardExamsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;

  // Fetch applicant's applications that are APPROVED or EXAM_SCHEDULED
  const applications = await db.application.findMany({
    where: {
      applicantId: userId,
      status: { in: ["APPROVED", "EXAM_SCHEDULED"] },
      deletedAt: null,
    },
    select: {
      id: true,
      applicationNumber: true,
      classApplied: true,
      status: true,
      organizationId: true,
      branchId: true,
      admissionCycleId: true,
      branch: { select: { name: true } },
    },
  });

  if (applications.length === 0) {
    return (
      <div>
        <PageHeader
          title="Exam Booking"
          description="Book your exam session once your application is approved"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Exams" }]}
        />
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm font-medium text-gray-600">
              No approved applications available for exam booking
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Your application must be approved by the school before you can book an exam slot.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Collect unique classLevels, branchIds, and admissionCycleIds from approved applications
  const classLevels = [...new Set(applications.map((a) => a.classApplied))];
  const branchIds = [...new Set(applications.map((a) => a.branchId))];
  const admissionCycleIds = [...new Set(applications.map((a) => a.admissionCycleId))];

  // Fetch available exam sessions matching the applicant's class(es)
  const availableSessions = await db.examSession.findMany({
    where: {
      status: "SCHEDULED",
      branchId: { in: branchIds },
      admissionCycleId: { in: admissionCycleIds },
      classLevels: { hasSome: classLevels },
    },
    include: {
      branch: { select: { name: true } },
      admissionCycle: { select: { name: true, academicYear: true } },
    },
    orderBy: { examDate: "asc" },
  });

  // Fetch existing bookings for the applicant across all their applications
  const applicationIds = applications.map((a) => a.id);
  const existingBookings = await db.examBooking.findMany({
    where: {
      applicationId: { in: applicationIds },
    },
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

  return (
    <div>
      <PageHeader
        title="Exam Booking"
        description="Book your exam session for your approved application"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Exams" }]}
      />

      <ExamBookingUI
        applications={applications.map((a) => ({
          id: a.id,
          applicationNumber: a.applicationNumber,
          classApplied: a.classApplied,
          status: a.status,
          branch: a.branch,
        }))}
        availableSessions={availableSessions as ExamSessionForBooking[]}
        existingBookings={existingBookings as BookingWithSession[]}
      />
    </div>
  );
}
