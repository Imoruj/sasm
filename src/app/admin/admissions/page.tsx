import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import AdmissionsClient from "./AdmissionsClient";

export const metadata = { title: "Admissions" };

export default async function AdminAdmissionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) redirect("/dashboard");

  const applications = await db.application.findMany({
    where: {
      status: "ENROLLED",
      organizationId: session.user.organizationId ?? "",
      ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
    },
    include: {
      branch: { select: { name: true } },
      admissionCycle: { select: { name: true, academicYear: true } },
      applicant: { select: { firstName: true, lastName: true, email: true, phone: true } },
      documents: { select: { id: true, isVerified: true } },
      payments: {
        where: { paymentType: "ADMISSION_FEE" },
        select: { id: true, status: true, amountKobo: true, paidAt: true },
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const serialized = applications.map((app) => ({
    id: app.id,
    applicationNumber: app.applicationNumber,
    status: "ENROLLED" as const,
    studentFirstName: app.studentFirstName,
    studentLastName: app.studentLastName,
    studentGender: app.studentGender,
    classApplied: app.classApplied,
    branch: app.branch,
    admissionCycle: app.admissionCycle,
    applicant: app.applicant,
    documentsCount: app.documents.length,
    documentsVerified: app.documents.filter((d) => d.isVerified).length,
    admissionFeePaid: app.payments[0]?.status === "PAID",
    admissionFee: app.payments[0]?.status === "PAID"
      ? { amountKobo: app.payments[0].amountKobo, paidAt: app.payments[0].paidAt?.toISOString() ?? null }
      : null,
    updatedAt: app.updatedAt.toISOString(),
  }));

  const feePaid = serialized.filter((a) => a.admissionFeePaid).length;
  const docsComplete = serialized.filter(
    (a) => a.documentsCount > 0 && a.documentsVerified === a.documentsCount,
  ).length;

  return (
    <div>
      <PageHeader
        title="Admissions"
        description="Students who have been offered and confirmed admission"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Admissions" }]}
      />

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Total Enrolled",  value: serialized.length, color: "text-green-700"   },
          { label: "Fee Confirmed",   value: feePaid,           color: "text-blue-700"    },
          { label: "Docs Complete",   value: docsComplete,      color: "text-[#1B4332]"   },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <AdmissionsClient enrollments={serialized} />
    </div>
  );
}
