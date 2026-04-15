import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import AdmissionInvoiceClient from "./AdmissionInvoiceClient";

export const metadata = { title: "Admission Acceptance Invoice" };

export default async function AdmissionInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const application = await db.application.findFirst({
    where: { id, applicantId: session.user.id },
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      branchId: true,
      admissionCycleId: true,
      classApplied: true,
      organizationId: true,
      studentFirstName: true,
      studentLastName: true,
      branch: { select: { name: true } },
      payments: {
        where: { paymentType: "ADMISSION_FEE" },
        select: {
          id: true,
          status: true,
          gateway: true,
          receiptUrl: true,
          amountKobo: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!application) notFound();

  // Only accessible for ADMITTED students
  if (application.status !== "ADMITTED") {
    redirect(`/dashboard/applications/${id}`);
  }

  // Already paid online → back to application
  const paidPayment = application.payments.find((p) => p.status === "PAID");
  if (paidPayment) {
    redirect(`/dashboard/applications/${id}`);
  }

  // Pending bank transfer (if any)
  const pendingBankTransfer = application.payments.find(
    (p) => p.gateway === "BANK_TRANSFER" && p.status === "PENDING",
  ) ?? null;

  // Look up the ADMISSION_FEE fee structure
  const feeWhere = {
    admissionCycleId: application.admissionCycleId,
    paymentType: "ADMISSION_FEE" as const,
    isActive: true,
    OR: [
      { branchId: application.branchId, classLevel: application.classApplied },
      { branchId: application.branchId, classLevel: null },
      { branchId: null, classLevel: application.classApplied },
      { branchId: null, classLevel: null },
    ],
  };

  const [admissionFee, org] = await Promise.all([
    db.feeStructure.findFirst({
      where: feeWhere,
      orderBy: [{ branchId: "desc" }, { classLevel: "desc" }],
      select: { amountKobo: true },
    }),
    db.organization.findUnique({
      where: { id: application.organizationId },
      select: { name: true, settings: true },
    }),
  ]);

  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const bankDetails = (settings.bankDetails ?? null) as {
    bankName: string;
    accountName: string;
    accountNumber: string;
    sortCode?: string;
  } | null;

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <PageHeader
        title="Admission Acceptance Invoice"
        description="Pay the acceptance fee to secure your child's admission offer"
        breadcrumbs={[
          { label: "Applications", href: "/dashboard/applications" },
          {
            label: application.applicationNumber,
            href: `/dashboard/applications/${id}`,
          },
          { label: "Admission Invoice" },
        ]}
      />
      <AdmissionInvoiceClient
        applicationId={id}
        applicationNumber={application.applicationNumber}
        studentName={`${application.studentFirstName ?? ""} ${application.studentLastName ?? ""}`.trim()}
        branchName={application.branch.name}
        admissionFeeKobo={admissionFee?.amountKobo ?? 0}
        bankDetails={bankDetails}
        orgName={org?.name ?? "School"}
        pendingBankTransfer={
          pendingBankTransfer
            ? {
                id: pendingBankTransfer.id,
                receiptUrl: pendingBankTransfer.receiptUrl,
              }
            : null
        }
      />
    </div>
  );
}
