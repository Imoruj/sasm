import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import ExamSessionsManager from "./ExamSessionsManager";
import type { ClassLevel, ExamMode, ExamSessionStatus } from "@prisma/client";

export type ExamSessionWithCounts = {
  id: string;
  organizationId: string;
  branchId: string;
  admissionCycleId: string;
  title: string;
  description: string | null;
  examDate: Date;
  examDates: Date[];
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
  createdAt: Date;
  branch: { name: string };
  admissionCycle: { name: string; academicYear: string };
  _count: { bookings: number };
};

export default async function AdminExamsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const orgId = session.user.organizationId ?? "";
  const branchFilter = session.user.branchId ? { branchId: session.user.branchId } : {};

  const [admissionCycles, sessions] = await Promise.all([
    db.admissionCycle.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["OPEN", "DRAFT"] },
      },
      select: { id: true, name: true, academicYear: true },
      orderBy: { academicYear: "desc" },
    }),
    db.examSession.findMany({
      where: {
        organizationId: orgId,
        ...branchFilter,
      },
      include: {
        branch: { select: { name: true } },
        admissionCycle: { select: { name: true, academicYear: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { examDate: "asc" },
    }),
  ]);

  const totalSessions = sessions.length;
  const upcoming = sessions.filter(
    (s) => s.status === "SCHEDULED" && new Date(s.examDate) >= new Date()
  ).length;
  const totalBookings = sessions.reduce((sum, s) => sum + s._count.bookings, 0);

  return (
    <div>
      <PageHeader
        title="Exam Sessions"
        description="Manage and schedule exam sessions for applicants"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Exam Sessions" }]}
      />

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Sessions</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalSessions}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Upcoming</p>
          <p className="mt-1 text-2xl font-bold text-[#1B4332]">{upcoming}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Bookings</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalBookings}</p>
        </div>
      </div>

      <ExamSessionsManager
        initialSessions={sessions as ExamSessionWithCounts[]}
        admissionCycles={admissionCycles}
        branchId={session.user.branchId ?? undefined}
      />
    </div>
  );
}
