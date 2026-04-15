import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import ExamResultsManager from "./ExamResultsManager";

export const metadata = { title: "Exam Results" };

export default async function AdminResultsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) redirect("/dashboard");

  // Fetch completed exam sessions with all bookings + results for this branch/org
  const examSessions = await db.examSession.findMany({
    where: {
      organizationId: session.user.organizationId ?? "",
      ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
      status: { in: ["COMPLETED", "IN_PROGRESS", "SCHEDULED"] },
    },
    include: {
      branch: { select: { name: true } },
      admissionCycle: { select: { name: true, academicYear: true } },
      bookings: {
        where: { status: { not: "CANCELLED" } },
        include: {
          application: {
            select: {
              id: true,
              applicationNumber: true,
              studentFirstName: true,
              studentLastName: true,
              classApplied: true,
              status: true,
              payments: {
                where: { paymentType: "ADMISSION_FEE" },
                select: { id: true, status: true, gateway: true, receiptUrl: true },
                orderBy: { createdAt: "desc" as const },
              },
              documents: {
                select: {
                  id: true,
                  documentType: true,
                  fileName: true,
                  fileUrl: true,
                  fileSize: true,
                  mimeType: true,
                  isVerified: true,
                  verificationNote: true,
                },
                orderBy: { uploadedAt: "asc" as const },
              },
            },
          },
          result: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { examDate: "desc" },
  });

  // Stats
  const totalBookings = examSessions.reduce((s, e) => s + e.bookings.length, 0);
  const totalGraded = examSessions.reduce(
    (s, e) => s + e.bookings.filter((b) => b.result).length,
    0,
  );
  const totalPublished = examSessions.reduce(
    (s, e) => s + e.bookings.filter((b) => b.result?.isPublished).length,
    0,
  );
  const totalAdmitted = examSessions.reduce(
    (s, e) =>
      s + e.bookings.filter((b) => b.result?.isPassed && b.result.isPublished && b.application.status === "ENROLLED").length,
    0,
  );

  // Serialize Prisma Decimal fields to plain numbers for client components
  const serializedSessions = examSessions.map((s) => ({
    ...s,
    bookings: s.bookings.map((b) => ({
      ...b,
      application: {
        ...b.application,
        acceptancePaid: b.application.payments.some((p) => p.status === "PAID"),
        allDocsVerified:
          b.application.documents.length > 0 &&
          b.application.documents.every((d) => d.isVerified),
        documentsCount: b.application.documents.length,
        pendingAdmissionTransfer: (() => {
          const pt = b.application.payments.find(
            (p) => p.gateway === "BANK_TRANSFER" && p.status === "PENDING" && p.receiptUrl,
          );
          return pt ? { paymentId: pt.id, receiptUrl: pt.receiptUrl! } : null;
        })(),
      },
      result: b.result
        ? {
            ...b.result,
            totalScore: Number(b.result.totalScore),
            maxScore: Number(b.result.maxScore),
            percentage: Number(b.result.percentage),
          }
        : null,
    })),
  }));

  return (
    <div>
      <PageHeader
        title="Exam Results"
        description="Enter, manage, and publish candidate exam results"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Results" }]}
      />

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Candidates", value: totalBookings, color: "text-gray-800" },
          { label: "Graded", value: totalGraded, color: "text-blue-700" },
          { label: "Published", value: totalPublished, color: "text-amber-700" },
          { label: "Admitted", value: totalAdmitted, color: "text-green-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <ExamResultsManager examSessions={serializedSessions} />
    </div>
  );
}
