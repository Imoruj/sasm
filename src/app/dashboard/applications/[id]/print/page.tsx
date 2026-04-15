import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import PrintTrigger from "./PrintTrigger";

export default async function PrintApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const application = await db.application.findFirst({
    where: { id, applicantId: session.user.id },
    include: {
      branch: { select: { name: true } },
      admissionCycle: { select: { academicYear: true, name: true } },
      organization: { select: { name: true } },
    },
  });

  if (!application) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fd = (application.formData ?? {}) as Record<string, any>;
  const candidate = fd.candidate ?? {};
  const family = fd.family ?? {};
  const education = fd.education ?? {};
  const health = fd.health ?? {};

  const classLabel =
    application.classApplied && CLASS_LEVEL_CONFIG[application.classApplied]
      ? CLASS_LEVEL_CONFIG[application.classApplied].label
      : application.classApplied ?? "—";

  return (
    <>
      <PrintTrigger />
      <div className="min-h-screen bg-white p-8 text-gray-900 print:p-4">
        {/* Header */}
        <div className="mb-8 border-b pb-6 text-center">
          <h1 className="text-2xl font-bold">{application.organization?.name ?? "School"}</h1>
          <p className="mt-1 text-sm text-gray-500">Application for Admission</p>
          <div className="mt-4 inline-block rounded border px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Application Number
            </span>
            <p className="font-mono text-lg font-bold">{application.applicationNumber}</p>
          </div>
        </div>

        {/* Summary row */}
        <div className="mb-8 grid grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">Branch</p>
            <p className="font-medium">{application.branch.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Class Applied</p>
            <p className="font-medium">{classLabel}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Academic Year</p>
            <p className="font-medium">{application.admissionCycle.academicYear}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <p className="font-medium capitalize">{application.status.replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Payment</p>
            <p className="font-medium">{application.paymentStatus}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Date</p>
            <p className="font-medium">{formatDate(application.createdAt)}</p>
          </div>
        </div>

        {/* Section helper */}
        {/* Candidate details */}
        <Section title="Candidate Information">
          <Row label="Surname" value={application.studentLastName} />
          <Row label="First Name" value={application.studentFirstName} />
          <Row label="Middle Name" value={application.studentMiddleName} />
          <Row label="Date of Birth" value={application.studentDob ? formatDate(application.studentDob) : null} />
          <Row label="Gender" value={application.studentGender} />
          <Row label="Nationality" value={application.studentNationality} />
          <Row label="State of Origin" value={application.studentStateOfOrigin} />
          <Row label="LGA" value={application.studentLga} />
          <Row label="Religion" value={candidate.religion} />
          <Row label="Place of Birth" value={candidate.placeOfBirth} />
          {candidate.hobbies && <Row label="Hobbies" value={candidate.hobbies} />}
        </Section>

        {/* Father */}
        {(family.fatherSurname || family.fatherOtherNames) && (
          <Section title="Father's Information">
            <Row label="Surname" value={family.fatherSurname} />
            <Row label="Other Names" value={family.fatherOtherNames} />
            <Row label="Occupation" value={family.fatherOccupation} />
            <Row label="Mobile" value={family.fatherMobilePhone} />
            <Row label="Email" value={family.fatherEmail} />
            <Row label="Home Address" value={family.fatherHomeAddress} />
          </Section>
        )}

        {/* Mother */}
        {(family.motherSurname || family.motherOtherNames) && (
          <Section title="Mother's Information">
            <Row label="Surname" value={family.motherSurname} />
            <Row label="Other Names" value={family.motherOtherNames} />
            <Row label="Occupation" value={family.motherOccupation} />
            <Row label="Mobile" value={family.motherMobilePhone} />
            <Row label="Email" value={family.motherEmail} />
            <Row label="Home Address" value={family.motherHomeAddress} />
          </Section>
        )}

        {/* Education */}
        {(education.primarySchoolName || application.previousSchool) && (
          <Section title="Educational Background">
            <Row label="Primary School" value={education.primarySchoolName ?? application.previousSchool} />
            <Row label="Primary School Address" value={education.primarySchoolAddress ?? application.previousSchoolAddress} />
            {education.previousSecondarySchool && (
              <>
                <Row label="Previous Secondary School" value={education.previousSecondarySchool} />
                <Row label="Class Attended" value={education.previousSecondaryClass} />
                <Row label="Reason for Transfer" value={education.reasonForTransfer} />
              </>
            )}
          </Section>
        )}

        {/* Health */}
        {Object.keys(health).length > 0 && (
          <Section title="Health Information">
            {health.hasFoodAllergy && <Row label="Food Allergy" value={health.foodAllergyDetails} />}
            {health.hasDrugAllergy && <Row label="Drug Allergy" value={health.drugAllergyDetails} />}
            {health.hasPhysicalDisability && <Row label="Physical Disability" value={health.physicalDisabilityDetails} />}
            {health.otherAilments && <Row label="Other Ailments" value={health.otherAilments} />}
          </Section>
        )}

        {/* Footer */}
        <div className="mt-12 grid grid-cols-2 gap-16 border-t pt-8 text-sm">
          <div>
            <p className="mb-8 text-gray-500">Applicant Signature</p>
            <div className="border-b border-gray-400" />
            <p className="mt-1 text-xs text-gray-400">Signature &amp; Date</p>
          </div>
          <div>
            <p className="mb-8 text-gray-500">School Official</p>
            <div className="border-b border-gray-400" />
            <p className="mt-1 text-xs text-gray-400">Signature &amp; Date</p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400 print:block">
          Printed on {new Date().toLocaleDateString("en-NG")} · {application.applicationNumber}
        </p>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide text-gray-600">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="min-w-[140px] shrink-0 text-gray-400">{label}:</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
