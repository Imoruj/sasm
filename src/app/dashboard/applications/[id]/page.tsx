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
import { formatDate } from "@/lib/utils";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const application = await db.application.findFirst({
    where: { id, applicantId: session!.user.id },
    include: {
      branch: true,
      admissionCycle: true,
      documents: true,
      statusHistory: { orderBy: { createdAt: "desc" } },
      examBookings: {
        include: { examSession: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!application) notFound();

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
          <div className="flex items-center gap-3">
            <StatusBadge status={application.status} />
            {application.paymentStatus !== "PAID" && (
              <PayButton applicationId={application.id} />
            )}
            {["DRAFT", "REVISION_REQUIRED"].includes(application.status) && (
              <SubmitButton applicationId={application.id} />
            )}
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents ({application.documents.length})</TabsTrigger>
          <TabsTrigger value="timeline">Status Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold">Student Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Full Name" value={`${application.studentFirstName ?? "—"} ${application.studentMiddleName ?? ""} ${application.studentLastName ?? ""}`} />
                <InfoRow label="Date of Birth" value={application.studentDob ? formatDate(application.studentDob) : "—"} />
                <InfoRow label="Gender" value={application.studentGender ?? "—"} />
                <InfoRow label="Nationality" value={application.studentNationality ?? "—"} />
                <InfoRow label="State of Origin" value={application.studentStateOfOrigin ?? "—"} />
                <InfoRow label="Previous School" value={application.previousSchool ?? "—"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold">Application Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Application No." value={application.applicationNumber} />
                <InfoRow label="School Branch" value={application.branch.name} />
                <InfoRow label="Class Applied" value={CLASS_LEVEL_CONFIG[application.classApplied].label} />
                <InfoRow label="Academic Year" value={application.admissionCycle.academicYear} />
                <InfoRow label="Payment Status" value={application.paymentStatus} />
                {application.submittedAt && (
                  <InfoRow label="Submitted On" value={formatDate(application.submittedAt)} />
                )}
              </CardContent>
            </Card>

            {application.adminNotes && (
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-sm font-semibold">Admin Notes</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700">{application.adminNotes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="pt-6">
              {application.documents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {application.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.documentType.replace(/_/g, " ")}</p>
                        <p className="text-xs text-gray-500">{doc.fileName}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${doc.isVerified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {doc.isVerified ? "Verified" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
