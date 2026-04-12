import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import Timeline from "@/components/shared/Timeline";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import { formatDate, formatDateTime, formatNaira, formatFileSize } from "@/lib/utils";
import { ExternalLink, CheckCircle, Clock, FileText, User, Calendar, CreditCard } from "lucide-react";
import ReviewActions from "./ReviewActions";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value || "—"}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
      {children}
    </h3>
  );
}

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;

  const application = await db.application.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId ?? "",
      ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
    },
    include: {
      branch: true,
      admissionCycle: true,
      applicant: {
        include: {
          applicantProfile: true,
        },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
      },
      examBookings: {
        include: {
          examSession: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
      },
      reviewer: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!application) notFound();

  const applicant = application.applicant;
  const profile = applicant.applicantProfile;
  const classConfig = CLASS_LEVEL_CONFIG[application.classApplied];

  const studentName = [
    application.studentFirstName,
    application.studentMiddleName,
    application.studentLastName,
  ]
    .filter(Boolean)
    .join(" ");

  const reviewerName = application.reviewer
    ? `${application.reviewer.firstName} ${application.reviewer.lastName}`
    : null;

  return (
    <div>
      <PageHeader
        title={application.applicationNumber}
        description={`${studentName || "Unnamed applicant"} · ${classConfig.label}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Applications", href: "/admin/applications" },
          { label: application.applicationNumber },
        ]}
        actions={<StatusBadge status={application.status} />}
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">
            <User className="size-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="size-3.5" />
            Documents
            {application.documents.length > 0 && (
              <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                {application.documents.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="review">
            <CheckCircle className="size-3.5" />
            Review
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="size-3.5" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="size-3.5" />
            Payments
            {application.payments.length > 0 && (
              <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                {application.payments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ──────────────── OVERVIEW TAB ──────────────── */}
        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column: Student + Application info */}
            <div className="space-y-6 lg:col-span-2">
              {/* Student Information */}
              <Card>
                <CardHeader className="border-b pb-3">
                  <CardTitle>Student Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <InfoRow label="Full Name" value={studentName || "—"} />
                  <InfoRow
                    label="Date of Birth"
                    value={
                      application.studentDob
                        ? formatDate(application.studentDob)
                        : "—"
                    }
                  />
                  <InfoRow
                    label="Gender"
                    value={
                      application.studentGender
                        ? application.studentGender.charAt(0).toUpperCase() +
                          application.studentGender.slice(1).toLowerCase()
                        : "—"
                    }
                  />
                  <InfoRow
                    label="Nationality"
                    value={application.studentNationality ?? "—"}
                  />
                  <InfoRow
                    label="State of Origin"
                    value={application.studentStateOfOrigin ?? "—"}
                  />
                  <InfoRow
                    label="LGA"
                    value={application.studentLga ?? "—"}
                  />
                  <InfoRow
                    label="Previous School"
                    value={application.previousSchool ?? "—"}
                  />
                  <InfoRow
                    label="Previous School Address"
                    value={application.previousSchoolAddress ?? "—"}
                  />
                </CardContent>
              </Card>

              {/* Application Details */}
              <Card>
                <CardHeader className="border-b pb-3">
                  <CardTitle>Application Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <InfoRow
                    label="Application Number"
                    value={application.applicationNumber}
                  />
                  <InfoRow label="Class Applied" value={classConfig.label} />
                  <InfoRow label="Branch" value={application.branch.name} />
                  <InfoRow
                    label="Admission Cycle"
                    value={application.admissionCycle.name}
                  />
                  <InfoRow
                    label="Academic Year"
                    value={application.admissionCycle.academicYear}
                  />
                  <InfoRow
                    label="Submitted"
                    value={
                      application.submittedAt
                        ? formatDateTime(application.submittedAt)
                        : "—"
                    }
                  />
                  <InfoRow
                    label="Last Updated"
                    value={formatDateTime(application.updatedAt)}
                  />
                  <InfoRow
                    label="Payment Status"
                    value={application.paymentStatus.replace(/_/g, " ")}
                  />
                </CardContent>
              </Card>

              {/* Admin Notes / Rejection Reason */}
              {(application.adminNotes || application.rejectionReason) && (
                <Card>
                  <CardHeader className="border-b pb-3">
                    <CardTitle>Review Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {application.adminNotes && (
                      <div>
                        <SectionTitle>Admin Notes</SectionTitle>
                        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                          {application.adminNotes}
                        </p>
                      </div>
                    )}
                    {application.rejectionReason && (
                      <div>
                        <SectionTitle>Rejection Reason</SectionTitle>
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                          {application.rejectionReason}
                        </p>
                      </div>
                    )}
                    {application.reviewedBy && reviewerName && (
                      <p className="text-xs text-gray-400">
                        Reviewed by {reviewerName}
                        {application.reviewedAt
                          ? ` on ${formatDateTime(application.reviewedAt)}`
                          : ""}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column: Guardian info + quick summary */}
            <div className="space-y-6">
              {/* Guardian / Parent Information */}
              <Card>
                <CardHeader className="border-b pb-3">
                  <CardTitle>Guardian / Parent</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <InfoRow
                    label="Name"
                    value={
                      [
                        profile?.guardianTitle,
                        applicant.firstName,
                        applicant.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ") || "—"
                    }
                  />
                  <InfoRow label="Email" value={applicant.email} />
                  <InfoRow label="Phone" value={applicant.phone ?? "—"} />
                  <InfoRow
                    label="Secondary Phone"
                    value={profile?.secondaryPhone ?? "—"}
                  />
                  <InfoRow
                    label="Occupation"
                    value={profile?.occupation ?? "—"}
                  />
                  <InfoRow
                    label="Employer"
                    value={profile?.employer ?? "—"}
                  />
                  <InfoRow
                    label="Address"
                    value={profile?.residentialAddress ?? "—"}
                  />
                  <InfoRow label="State" value={profile?.state ?? "—"} />
                  <InfoRow label="LGA" value={profile?.lga ?? "—"} />
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              {(profile?.emergencyContactName || profile?.emergencyContactPhone) && (
                <Card>
                  <CardHeader className="border-b pb-3">
                    <CardTitle>Emergency Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <InfoRow
                      label="Name"
                      value={profile.emergencyContactName ?? "—"}
                    />
                    <InfoRow
                      label="Phone"
                      value={profile.emergencyContactPhone ?? "—"}
                    />
                    <InfoRow
                      label="Relation"
                      value={profile.emergencyContactRelation ?? "—"}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Exam Booking Summary */}
              {application.examBookings.length > 0 && (
                <Card>
                  <CardHeader className="border-b pb-3">
                    <CardTitle>Exam Booking</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    {application.examBookings.map((booking) => (
                      <div key={booking.id} className="space-y-2">
                        <p className="font-medium text-sm text-gray-900">
                          {booking.examSession.title}
                        </p>
                        <InfoRow
                          label="Date"
                          value={formatDate(booking.examSession.examDate)}
                        />
                        <InfoRow
                          label="Time"
                          value={`${booking.examSession.startTime} – ${booking.examSession.endTime}`}
                        />
                        <InfoRow
                          label="Mode"
                          value={booking.examSession.mode}
                        />
                        <InfoRow
                          label="Seat #"
                          value={booking.seatNumber ?? "Not assigned"}
                        />
                        <InfoRow
                          label="Status"
                          value={booking.status.replace(/_/g, " ")}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ──────────────── DOCUMENTS TAB ──────────────── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Uploaded Documents</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {application.documents.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="mx-auto mb-3 size-10 text-gray-300" />
                  <p className="text-sm text-gray-500">No documents uploaded yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {application.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          {doc.isVerified ? (
                            <CheckCircle className="size-4 text-green-500" />
                          ) : (
                            <Clock className="size-4 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {doc.fileName}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {doc.documentType.replace(/_/g, " ")} ·{" "}
                            {formatFileSize(doc.fileSize)} ·{" "}
                            {doc.mimeType}
                          </p>
                          {doc.verificationNote && (
                            <p className="mt-1 text-xs text-amber-600">
                              Note: {doc.verificationNote}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            doc.isVerified
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {doc.isVerified ? "Verified" : "Pending"}
                        </span>
                        <Link
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          View
                          <ExternalLink className="size-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────────────── REVIEW TAB ──────────────── */}
        <TabsContent value="review">
          <div className="max-w-2xl">
            <ReviewActions
              applicationId={application.id}
              currentStatus={application.status}
              adminNotes={application.adminNotes}
            />
          </div>
        </TabsContent>

        {/* ──────────────── TIMELINE TAB ──────────────── */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Status History</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {application.statusHistory.length === 0 ? (
                <div className="py-12 text-center">
                  <Calendar className="mx-auto mb-3 size-10 text-gray-300" />
                  <p className="text-sm text-gray-500">No status history yet.</p>
                </div>
              ) : (
                <Timeline events={application.statusHistory} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────────────── PAYMENTS TAB ──────────────── */}
        <TabsContent value="payments">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {application.payments.length === 0 ? (
                <div className="py-12 text-center">
                  <CreditCard className="mx-auto mb-3 size-10 text-gray-300" />
                  <p className="text-sm text-gray-500">No payments recorded.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          Gateway
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          Reference
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          Paid At
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {application.payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">
                            {payment.paymentType.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {formatNaira(payment.amountKobo)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {payment.gateway}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">
                            {payment.gatewayReference ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                payment.status === "PAID"
                                  ? "bg-green-100 text-green-700"
                                  : payment.status === "FAILED"
                                  ? "bg-red-100 text-red-700"
                                  : payment.status === "REFUNDED"
                                  ? "bg-orange-100 text-orange-700"
                                  : payment.status === "WAIVED"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {payment.paidAt
                              ? formatDateTime(payment.paidAt)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
