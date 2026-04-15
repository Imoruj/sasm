import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import Timeline from "@/components/shared/Timeline";
import SubmitButton from "./SubmitButton";
import PayButton from "./PayButton";
import DocumentUploadSection from "./DocumentUploadSection";
import { formatDate } from "@/lib/utils";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import { CheckCircle2, CreditCard, GraduationCap, UploadCloud } from "lucide-react";

// ─── Status helpers ───────────────────────────────────────────────────────────
const ADMITTED_STATUSES = ["ADMITTED", "ENROLLED"] as const;
type AdmittedStatus = (typeof ADMITTED_STATUSES)[number];

function isAdmittedStatus(s: string): s is AdmittedStatus {
  return (ADMITTED_STATUSES as readonly string[]).includes(s);
}

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const session = await auth();

  const application = await db.application.findFirst({
    where: { id, applicantId: session!.user.id },
    include: {
      branch: true,
      admissionCycle: true,
      documents: { orderBy: { uploadedAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" } },
      examBookings: {
        include: { examSession: true, result: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      payments: {
        where: { paymentType: "ADMISSION_FEE", status: "PAID" },
        take: 1,
      },
    },
  });

  if (!application) notFound();

  const isAdmitted = isAdmittedStatus(application.status);
  const isEnrolled = application.status === "ENROLLED";
  const acceptancePaid = application.payments.length > 0;
  const latestBooking = application.examBookings[0] ?? null;
  const examResult = latestBooking?.result ?? null;
  const resultPublished = examResult?.isPublished ?? false;

  // Default tab logic: show documents tab when navigated with ?tab=documents
  const defaultTab = tab === "documents" && isAdmitted && acceptancePaid ? "documents" : "overview";

  return (
    <div>
      <PageHeader
        title={
          application.studentFirstName
            ? `${application.studentFirstName} ${application.studentLastName ?? ""}`
            : "Application Details"
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Applications", href: "/dashboard/applications" },
          { label: application.applicationNumber },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={application.status} />

            {/* Application fee payment (pre-admission flow) */}
            {application.paymentStatus !== "PAID" &&
              !["ADMITTED", "ENROLLED", "NOT_ADMITTED", "REJECTED"].includes(application.status) && (
                <PayButton applicationId={application.id} />
              )}

            {/* Submit / re-submit */}
            {["DRAFT", "REVISION_REQUIRED"].includes(application.status) && (
              <SubmitButton applicationId={application.id} />
            )}
          </div>
        }
      />

      {/* ── Admission offer banner (ADMITTED / ENROLLED) ─────────────────────── */}
      {isAdmitted && resultPublished && (
        <div
          className={`mb-6 rounded-xl border p-5 ${
            isEnrolled
              ? "border-green-200 bg-green-50"
              : "border-[#1B4332]/20 bg-[#1B4332]/5"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-[#1B4332]" />
              <div>
                {isEnrolled ? (
                  <>
                    <p className="text-sm font-bold text-green-800">
                      Enrolment Confirmed
                    </p>
                    <p className="mt-0.5 text-sm text-green-700">
                      {application.studentFirstName ?? "Your ward"} is officially enrolled at{" "}
                      {application.branch.name}. Welcome to the school family!
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-[#1B4332]">
                      Admission Offer — Action Required
                    </p>
                    <p className="mt-0.5 text-sm text-gray-700">
                      {application.studentFirstName ?? "Your ward"} has been offered admission.
                      {!acceptancePaid
                        ? " Pay the acceptance fee below to confirm this offer."
                        : " Upload the required documents in the Documents tab to complete enrolment."}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Admission steps quick-view */}
            {!isEnrolled && (
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="flex items-center gap-1 text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Result published
                </span>
                <span className={`flex items-center gap-1 ${acceptancePaid ? "text-green-700" : "text-gray-400"}`}>
                  {acceptancePaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                  Acceptance fee
                </span>
                <span className={`flex items-center gap-1 ${application.documents.length > 0 ? "text-green-700" : "text-gray-400"}`}>
                  {application.documents.length > 0 ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <UploadCloud className="h-3.5 w-3.5" />
                  )}
                  Documents
                </span>
              </div>
            )}
          </div>

          {/* Acceptance fee PayButton (ADMISSION_FEE type) */}
          {isAdmitted && !acceptancePaid && !isEnrolled && (
            <div className="mt-4 border-t border-[#1B4332]/10 pt-4">
              <p className="mb-2 text-xs text-gray-600">
                Pay the acceptance fee to secure this admission offer.
              </p>
              <PayButton applicationId={application.id} paymentType="ADMISSION_FEE" />
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({application.documents.length})
          </TabsTrigger>
          {isAdmitted && acceptancePaid && (
            <TabsTrigger value="upload" className="relative">
              Upload Documents
              {application.documents.length === 0 && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500" />
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="timeline">Status Timeline</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Student Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow
                  label="Full Name"
                  value={`${application.studentFirstName ?? "—"} ${application.studentMiddleName ?? ""} ${application.studentLastName ?? ""}`}
                />
                <InfoRow
                  label="Date of Birth"
                  value={application.studentDob ? formatDate(application.studentDob) : "—"}
                />
                <InfoRow label="Gender" value={application.studentGender ?? "—"} />
                <InfoRow label="Nationality" value={application.studentNationality ?? "—"} />
                <InfoRow label="State of Origin" value={application.studentStateOfOrigin ?? "—"} />
                <InfoRow label="Previous School" value={application.previousSchool ?? "—"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Application Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Application No." value={application.applicationNumber} />
                <InfoRow label="School Branch" value={application.branch.name} />
                <InfoRow
                  label="Class Applied"
                  value={CLASS_LEVEL_CONFIG[application.classApplied].label}
                />
                <InfoRow label="Academic Year" value={application.admissionCycle.academicYear} />
                <InfoRow label="Payment Status" value={application.paymentStatus} />
                {acceptancePaid && (
                  <InfoRow label="Acceptance Fee" value="PAID" />
                )}
                {application.submittedAt && (
                  <InfoRow label="Submitted On" value={formatDate(application.submittedAt)} />
                )}
              </CardContent>
            </Card>

            {/* Exam result summary card */}
            {examResult && resultPublished && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Entrance Exam Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Score</p>
                      <p className="text-lg font-bold text-gray-900">
                        {Number(examResult.totalScore).toFixed(0)} /{" "}
                        {Number(examResult.maxScore).toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Percentage</p>
                      <p className="text-lg font-bold text-gray-900">
                        {Number(examResult.percentage).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Grade</p>
                      <p className="text-lg font-bold text-gray-900">{examResult.grade ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Outcome</p>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          examResult.isPassed
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {examResult.isPassed ? "PASSED" : "NOT PASSED"}
                      </span>
                    </div>
                  </div>
                  {examResult.remarks && (
                    <p className="mt-3 text-sm text-gray-600">
                      <span className="font-medium">Remarks: </span>
                      {examResult.remarks}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {application.adminNotes && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Admin Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{application.adminNotes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Uploaded documents (read-only list) ──────────────────────────── */}
        <TabsContent value="documents">
          <Card>
            <CardContent className="pt-6">
              {application.documents.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  No documents uploaded yet.
                  {isAdmitted && acceptancePaid && " Use the Upload Documents tab to add them."}
                </p>
              ) : (
                <div className="space-y-2">
                  {application.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {doc.documentType.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-gray-500">{doc.fileName}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          doc.isVerified
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {doc.isVerified ? "Verified" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Document upload (ADMITTED + acceptance paid only) ─────────────── */}
        {isAdmitted && acceptancePaid && (
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Upload Admission Documents</CardTitle>
                <p className="text-xs text-gray-500 mt-1">
                  All required documents must be uploaded to complete your enrolment.
                  The admissions team will verify each document.
                </p>
              </CardHeader>
              <CardContent>
                <DocumentUploadSection
                  applicationId={application.id}
                  existingDocuments={application.documents.map((d) => ({
                    id: d.id,
                    documentType: d.documentType as Parameters<typeof DocumentUploadSection>[0]["existingDocuments"][number]["documentType"],
                    fileName: d.fileName,
                    fileUrl: d.fileUrl,
                    fileSize: d.fileSize,
                    isVerified: d.isVerified,
                  }))}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <TabsContent value="timeline">
          <Card>
            <CardContent className="pt-6">
              <Timeline events={application.statusHistory} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value || "—"}</span>
    </div>
  );
}
