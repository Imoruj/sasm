import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import Timeline from "@/components/shared/Timeline";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import { formatDate, formatDateTime, formatNaira, formatFileSize } from "@/lib/utils";
import {
  ExternalLink, CheckCircle, Clock, FileText, Calendar, CreditCard,
  User, Building2, GraduationCap, Heart, Phone, Mail, MapPin,
  FileImage, AlertCircle, Hash,
} from "lucide-react";
import ReviewActions from "./ReviewActions";
import DocumentReviewCard from "./DocumentReviewCard";

// ─── Helpers ────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0 min-w-[140px]">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right wrap-break-word">
        {value || <span className="text-gray-300">—</span>}
      </span>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-gray-400" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-1 divide-y divide-gray-50">{children}</CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

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
      applicant: { include: { applicantProfile: true } },
      documents: { orderBy: { uploadedAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      examBookings: { include: { examSession: true } },
      payments: { orderBy: { createdAt: "desc" } },
      reviewer: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  if (!application) notFound();

  const applicant = application.applicant;
  const profile = applicant.applicantProfile;
  const classConfig = application.classApplied
    ? CLASS_LEVEL_CONFIG[application.classApplied]
    : null;

  const studentName = [
    application.studentFirstName,
    application.studentMiddleName,
    application.studentLastName,
  ].filter(Boolean).join(" ") || "Unnamed Applicant";

  const reviewerName = application.reviewer
    ? `${application.reviewer.firstName} ${application.reviewer.lastName}`
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fd = (application.formData ?? {}) as Record<string, any>;
  const familyData = fd.family ?? {};
  const healthData = fd.health ?? {};
  const educationData = fd.education ?? {};

  const isEvidenceImage = application.paymentEvidenceUrl &&
    /\.(jpe?g|png|webp)(\?|$)/i.test(application.paymentEvidenceUrl);

  const paymentStatusColor: Record<string, string> = {
    PAID:    "bg-green-100 text-green-700",
    PENDING: "bg-amber-100 text-amber-700",
    UNPAID:  "bg-red-100 text-red-700",
  };

  return (
    <div>
      {/* ── Page header ── */}
      <PageHeader
        title={application.applicationNumber}
        description={`${studentName} · ${classConfig?.label ?? "—"} · ${application.branch.name}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Applications", href: "/admin/applications" },
          { label: application.applicationNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={application.status} />
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
              paymentStatusColor[application.paymentStatus] ?? "bg-gray-100 text-gray-600"
            }`}>
              {application.paymentStatus}
            </span>
          </div>
        }
      />

      {/* ── Main two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* ════════ LEFT — applicant details ════════ */}
        <div className="space-y-5 lg:col-span-2">

          {/* Student */}
          <SectionCard icon={User} title="Student Information">
            <InfoRow label="Full Name"        value={studentName} />
            <InfoRow label="Date of Birth"    value={application.studentDob ? formatDate(application.studentDob) : null} />
            <InfoRow label="Gender"           value={application.studentGender} />
            <InfoRow label="Nationality"      value={application.studentNationality} />
            <InfoRow label="State of Origin"  value={application.studentStateOfOrigin} />
            <InfoRow label="LGA"              value={application.studentLga} />
            {fd.candidate?.religion && <InfoRow label="Religion" value={fd.candidate.religion} />}
            {fd.candidate?.placeOfBirth && <InfoRow label="Place of Birth" value={fd.candidate.placeOfBirth} />}
            {fd.candidate?.hobbies && <InfoRow label="Hobbies / Interests" value={fd.candidate.hobbies} />}
          </SectionCard>

          {/* Enrollment */}
          <SectionCard icon={Building2} title="Enrollment Details">
            <InfoRow label="Application No."  value={application.applicationNumber} />
            <InfoRow label="Class Applied"    value={classConfig?.label} />
            <InfoRow label="Branch"           value={application.branch.name} />
            <InfoRow label="Admission Cycle"  value={application.admissionCycle.name} />
            <InfoRow label="Academic Year"    value={application.admissionCycle.academicYear} />
            <InfoRow label="Student Type"     value={fd.enrollment?.studentType?.replace("_", " ")} />
            <InfoRow label="Submitted"        value={application.submittedAt ? formatDateTime(application.submittedAt) : null} />
            <InfoRow label="Last Updated"     value={formatDateTime(application.updatedAt)} />
          </SectionCard>

          {/* Parents / Family */}
          {(familyData.fatherSurname || familyData.motherSurname || familyData.guardianName) && (
            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="size-4 text-gray-400" />
                  Family / Parent Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2 space-y-5">
                {(familyData.fatherSurname || familyData.fatherOtherNames) && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Father</p>
                    <div className="divide-y divide-gray-50">
                      <InfoRow label="Name"       value={[familyData.fatherSurname, familyData.fatherOtherNames].filter(Boolean).join(" ")} />
                      <InfoRow label="Occupation" value={familyData.fatherOccupation} />
                      <InfoRow label="Mobile"     value={familyData.fatherMobilePhone} />
                      <InfoRow label="Email"      value={familyData.fatherEmail} />
                      <InfoRow label="Address"    value={familyData.fatherHomeAddress} />
                    </div>
                  </div>
                )}
                {(familyData.motherSurname || familyData.motherOtherNames) && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Mother</p>
                    <div className="divide-y divide-gray-50">
                      <InfoRow label="Name"       value={[familyData.motherSurname, familyData.motherOtherNames].filter(Boolean).join(" ")} />
                      <InfoRow label="Occupation" value={familyData.motherOccupation} />
                      <InfoRow label="Mobile"     value={familyData.motherMobilePhone} />
                      <InfoRow label="Email"      value={familyData.motherEmail} />
                      <InfoRow label="Address"    value={familyData.motherHomeAddress} />
                    </div>
                  </div>
                )}
                {familyData.guardianName && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Guardian</p>
                    <div className="divide-y divide-gray-50">
                      <InfoRow label="Name"         value={familyData.guardianName} />
                      <InfoRow label="Relationship" value={familyData.guardianRelationship} />
                      <InfoRow label="Phone"        value={familyData.guardianPhone} />
                      <InfoRow label="Email"        value={familyData.guardianEmail} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Education */}
          {(educationData.primarySchoolName || application.previousSchool || educationData.previousSecondarySchool) && (
            <SectionCard icon={GraduationCap} title="Educational Background">
              <InfoRow label="Primary School"   value={educationData.primarySchoolName ?? application.previousSchool} />
              <InfoRow label="School Address"   value={educationData.primarySchoolAddress ?? application.previousSchoolAddress} />
              {educationData.previousSecondarySchool && (
                <>
                  <InfoRow label="Prev. Secondary"  value={educationData.previousSecondarySchool} />
                  <InfoRow label="Class Attended"   value={educationData.previousSecondaryClass} />
                  <InfoRow label="Reason for Transfer" value={educationData.reasonForTransfer} />
                </>
              )}
            </SectionCard>
          )}

          {/* Health */}
          {Object.keys(healthData).length > 0 && (
            <SectionCard icon={Heart} title="Health Information">
              {healthData.hasFoodAllergy    && <InfoRow label="Food Allergy"       value={healthData.foodAllergyDetails} />}
              {healthData.hasDrugAllergy    && <InfoRow label="Drug Allergy"       value={healthData.drugAllergyDetails} />}
              {healthData.hasPlantAllergy   && <InfoRow label="Plant Allergy"      value={healthData.plantAllergyDetails} />}
              {healthData.hasPhysicalDisability && <InfoRow label="Physical Disability" value={healthData.physicalDisabilityDetails} />}
              {healthData.otherAilments     && <InfoRow label="Other Ailments"     value={healthData.otherAilments} />}
              {healthData.eyeCheckDone      && <InfoRow label="Eye Check"          value={`${healthData.eyeCheckWhere ?? ""}${healthData.eyeCheckDate ? ` · ${healthData.eyeCheckDate}` : ""}`} />}
              {healthData.dentalCheckDone   && <InfoRow label="Dental Check"       value={`${healthData.dentalCheckWhere ?? ""}${healthData.dentalCheckDate ? ` · ${healthData.dentalCheckDate}` : ""}`} />}
              {!healthData.hasFoodAllergy && !healthData.hasDrugAllergy && !healthData.hasPhysicalDisability && !healthData.otherAilments && (
                <div className="py-3 text-sm text-gray-400">No health conditions reported.</div>
              )}
            </SectionCard>
          )}

          {/* Documents */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-gray-400" />
                Uploaded Documents
                {application.documents.length > 0 && (
                  <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {application.documents.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {application.documents.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No documents uploaded yet.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {application.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          {doc.isVerified ? (
                            <CheckCircle className="size-4 text-green-500" />
                          ) : doc.verificationNote ? (
                            <AlertCircle className="size-4 text-red-400" />
                          ) : (
                            <Clock className="size-4 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{doc.fileName}</p>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {doc.documentType.replace(/_/g, " ")} · {formatFileSize(doc.fileSize)}
                          </p>
                          {doc.verificationNote && !doc.isVerified && (
                            <p className="mt-0.5 text-xs text-red-600">Rejected: {doc.verificationNote}</p>
                          )}
                        </div>
                      </div>
                      <Link
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        View <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-gray-400" />
                Status History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {application.statusHistory.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No status changes yet.</div>
              ) : (
                <Timeline events={application.statusHistory} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* ════════ RIGHT — action panel (sticky) ════════ */}
        <div className="space-y-5">
          <div className="lg:sticky lg:top-6 space-y-5">

            {/* Applicant contact */}
            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Phone className="size-4 text-gray-400" />
                  Applicant Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1B4332]/10 text-sm font-bold text-[#1B4332]">
                    {[applicant.firstName?.[0], applicant.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {[applicant.firstName, applicant.lastName].filter(Boolean).join(" ")}
                    </p>
                    <p className="text-xs text-gray-500">{profile?.guardianTitle ?? "Parent/Guardian"}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="size-3.5 text-gray-400 shrink-0" />
                    <a href={`mailto:${applicant.email}`} className="hover:text-primary truncate">{applicant.email}</a>
                  </div>
                  {applicant.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="size-3.5 text-gray-400 shrink-0" />
                      <span>{applicant.phone}</span>
                    </div>
                  )}
                  {profile?.residentialAddress && (
                    <div className="flex items-start gap-2 text-gray-600">
                      <MapPin className="size-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-xs">{profile.residentialAddress}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment evidence */}
            {application.paymentEvidenceUrl && (
              <Card>
                <CardHeader className="border-b pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileImage className="size-4 text-gray-400" />
                    Payment Evidence
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2">
                    <AlertCircle className="size-4 shrink-0 text-amber-500" />
                    <p className="text-xs text-amber-700 font-medium">Verify this receipt before approving</p>
                  </div>
                  {isEvidenceImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={application.paymentEvidenceUrl}
                      alt="Payment receipt"
                      className="w-full rounded-lg border object-contain max-h-56"
                    />
                  ) : null}
                  <a
                    href={application.paymentEvidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <ExternalLink className="size-4" />
                    {isEvidenceImage ? "Open Full Image" : "View Payment Document"}
                  </a>
                  {application.paymentConfirmedAt && reviewerName && (
                    <p className="text-xs text-gray-400">
                      Confirmed by {reviewerName} on {formatDateTime(application.paymentConfirmedAt)}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Document verification — shown for ADMITTED applications with uploads */}
            {application.status === "ADMITTED" && application.documents.length > 0 && (
              <DocumentReviewCard
                applicationId={application.id}
                documents={application.documents.map((d) => ({
                  id: d.id,
                  documentType: d.documentType,
                  fileName: d.fileName,
                  fileUrl: d.fileUrl,
                  fileSize: d.fileSize,
                  mimeType: d.mimeType,
                  isVerified: d.isVerified,
                  verificationNote: d.verificationNote,
                }))}
                acceptancePaid={application.payments.some(
                  (p) => p.paymentType === "ADMISSION_FEE" && p.status === "PAID",
                )}
              />
            )}

            {/* Review actions — always visible */}
            <ReviewActions
              applicationId={application.id}
              currentStatus={application.status}
              adminNotes={application.adminNotes}
              paymentEvidenceUrl={application.paymentEvidenceUrl}
              acceptancePaid={application.payments.some(
                (p) => p.paymentType === "ADMISSION_FEE" && p.status === "PAID",
              )}
              documentsCount={application.documents.length}
              pendingAdmissionTransfer={(() => {
                const pt = application.payments.find(
                  (p) =>
                    p.paymentType === "ADMISSION_FEE" &&
                    p.gateway === "BANK_TRANSFER" &&
                    p.status === "PENDING" &&
                    p.receiptUrl,
                );
                return pt ? { paymentId: pt.id, receiptUrl: pt.receiptUrl! } : null;
              })()}
            />

            {/* Review notes (if any) */}
            {(application.adminNotes || application.rejectionReason) && (
              <Card>
                <CardHeader className="border-b pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Hash className="size-4 text-gray-400" />
                    Review Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-sm">
                  {application.adminNotes && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Admin Notes</p>
                      <p className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800">{application.adminNotes}</p>
                    </div>
                  )}
                  {application.rejectionReason && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Rejection Reason</p>
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{application.rejectionReason}</p>
                    </div>
                  )}
                  {reviewerName && application.reviewedAt && (
                    <p className="text-xs text-gray-400">
                      By {reviewerName} on {formatDateTime(application.reviewedAt)}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payments */}
            {application.payments.length > 0 && (
              <Card>
                <CardHeader className="border-b pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="size-4 text-gray-400" />
                    Payments
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-3">
                  {application.payments.map((p) => (
                    <div key={p.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">{formatNaira(p.amountKobo)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "PAID"    ? "bg-green-100 text-green-700" :
                          p.status === "FAILED"  ? "bg-red-100 text-red-700" :
                                                   "bg-gray-100 text-gray-600"
                        }`}>{p.status}</span>
                      </div>
                      <p className="text-xs text-gray-400">{p.paymentType.replace(/_/g, " ")} · {p.gateway}</p>
                      {p.paidAt && <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(p.paidAt)}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Exam booking */}
            {application.examBookings.length > 0 && (
              <Card>
                <CardHeader className="border-b pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="size-4 text-gray-400" />
                    Exam Booking
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1 divide-y divide-gray-50">
                  {application.examBookings.map((b) => (
                    <div key={b.id}>
                      <InfoRow label="Session"  value={b.examSession.title} />
                      <InfoRow label="Date"     value={formatDate(b.examSession.examDate)} />
                      <InfoRow label="Time"     value={`${b.examSession.startTime} – ${b.examSession.endTime}`} />
                      <InfoRow label="Mode"     value={b.examSession.mode} />
                      <InfoRow label="Seat #"   value={b.seatNumber ?? "Not assigned"} />
                      <InfoRow label="Status"   value={b.status.replace(/_/g, " ")} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
