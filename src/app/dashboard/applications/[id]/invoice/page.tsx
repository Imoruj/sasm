import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import InvoiceClient from "./InvoiceClient";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [application, org] = await Promise.all([
    db.application.findFirst({
      where: { id, applicantId: session.user.id },
      select: {
        id: true,
        applicationNumber: true,
        status: true,
        paymentStatus: true,
        paymentEvidenceUrl: true,
        branchId: true,
        admissionCycleId: true,
        classApplied: true,
        organizationId: true,
        formData: true,
        branch: { select: { name: true } },
      },
    }),
    db.organization.findFirst({
      select: { settings: true, name: true },
    }),
  ]);

  if (!application) notFound();

  // Redirect if already paid
  if (application.paymentStatus === "PAID") {
    redirect(`/dashboard/applications/${id}`);
  }

  const formData = (application.formData ?? {}) as Record<string, unknown>;
  const isOnlinePlacementTest = formData.placementTestType === "ONLINE";

  // Look up application fee and online test fee in parallel
  const feeWhere = {
    admissionCycleId: application.admissionCycleId,
    isActive: true,
    OR: [
      { branchId: application.branchId, classLevel: application.classApplied },
      { branchId: application.branchId, classLevel: null },
      { branchId: null, classLevel: application.classApplied },
      { branchId: null, classLevel: null },
    ],
  };

  const [appFee, onlineTestFee] = await Promise.all([
    db.feeStructure.findFirst({
      where: { ...feeWhere, paymentType: "APPLICATION_FEE" },
      orderBy: [{ branchId: "desc" }, { classLevel: "desc" }],
      select: { amountKobo: true },
    }),
    db.feeStructure.findFirst({
      where: { ...feeWhere, paymentType: "ONLINE_TEST_FEE" },
      orderBy: [{ branchId: "desc" }, { classLevel: "desc" }],
      select: { amountKobo: true },
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
        title="Payment Invoice"
        breadcrumbs={[
          { label: "Applications", href: "/dashboard/applications" },
          { label: application.applicationNumber, href: `/dashboard/applications/${id}` },
          { label: "Invoice" },
        ]}
      />
      <InvoiceClient
        applicationId={id}
        applicationNumber={application.applicationNumber}
        applicationFeeKobo={appFee?.amountKobo ?? 0}
        onlineTestFeeKobo={onlineTestFee?.amountKobo ?? 0}
        isOnlinePlacementTest={isOnlinePlacementTest}
        bankDetails={bankDetails}
        existingEvidenceUrl={application.paymentEvidenceUrl ?? null}
        orgName={org?.name ?? "School"}
      />
    </div>
  );
}
