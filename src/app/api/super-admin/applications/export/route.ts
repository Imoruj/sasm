import { ApplicationStatus, ClassLevel, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import {
  createCsv,
  createPdf,
  createXlsx,
  type ApplicationExportRow,
} from "@/lib/applicationExports";

export const runtime = "nodejs";

type ExportFormat = "xlsx" | "csv" | "pdf";

const applicationExportSelect = {
  applicationNumber: true,
  studentFirstName: true,
  studentMiddleName: true,
  studentLastName: true,
  studentDob: true,
  studentGender: true,
  studentNationality: true,
  studentStateOfOrigin: true,
  studentLga: true,
  previousSchool: true,
  previousSchoolAddress: true,
  formData: true,
  submittedAt: true,
  classApplied: true,
  status: true,
  paymentStatus: true,
  updatedAt: true,
  branch: { select: { name: true } },
  admissionCycle: { select: { name: true, academicYear: true } },
  applicant: {
    select: {
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      applicantProfile: {
        select: {
          guardianTitle: true,
          occupation: true,
          employer: true,
          officeAddress: true,
          secondaryPhone: true,
          residentialAddress: true,
          state: true,
          lga: true,
          city: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          emergencyContactRelation: true,
          dataConsentGiven: true,
          dataConsentDate: true,
        },
      },
    },
  },
  documents: {
    select: {
      fileName: true,
      documentType: true,
      fileSize: true,
      isVerified: true,
      verificationNote: true,
      uploadedAt: true,
    },
    orderBy: { uploadedAt: "asc" as const },
  },
} satisfies Prisma.ApplicationSelect;

type ExportApplication = Prisma.ApplicationGetPayload<{
  select: typeof applicationExportSelect;
}>;

function parseFormat(value: unknown): ExportFormat | null {
  return value === "xlsx" || value === "csv" || value === "pdf" ? value : null;
}

function buildWhere(
  organizationId: string,
  filters: URLSearchParams,
): Prisma.ApplicationWhereInput | null {
  const where: Prisma.ApplicationWhereInput = { organizationId };
  const campus = filters.get("branch");
  const session = filters.get("session");
  const classValue = filters.get("class");
  const status = filters.get("status");
  const search = filters.get("search")?.trim();

  if (classValue && !Object.values(ClassLevel).includes(classValue as ClassLevel)) return null;
  if (status && !Object.values(ApplicationStatus).includes(status as ApplicationStatus)) return null;

  if (campus) where.branchId = campus;
  if (session) where.admissionCycleId = session;
  if (classValue) where.classApplied = classValue as ClassLevel;
  if (status) where.status = status as ApplicationStatus;
  if (search) {
    where.OR = [
      { applicationNumber: { contains: search, mode: "insensitive" } },
      { studentFirstName: { contains: search, mode: "insensitive" } },
      { studentLastName: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

function addDetail(details: Record<string, string>, label: string, value: unknown) {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    if (value.trim()) details[label] = value.trim();
    return;
  }
  if (value instanceof Date) {
    details[label] = value.toISOString().slice(0, 10);
    return;
  }
  if (typeof value === "boolean") {
    details[label] = value ? "Yes" : "No";
    return;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    details[label] = String(value);
  }
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (character) => character.toUpperCase());
}

function formatFormValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  return null;
}

function flattenFormData(
  value: unknown,
  path: string[],
  details: Record<string, string>,
) {
  if (Array.isArray(value)) {
    if (value.every((item) => item === null || typeof item !== "object")) {
      const values = value.map(formatFormValue).filter((item): item is string => item !== null);
      if (values.length && path.length) {
        details["Form Response — " + path.map(humanizeKey).join(" — ")] = values.join("; ");
      }
      return;
    }
    value.forEach((item, index) => flattenFormData(item, [...path, "Item " + String(index + 1)], details));
    return;
  }

  if (typeof value === "object" && value !== null && !(value instanceof Date)) {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      flattenFormData(child, [...path, key], details);
    });
    return;
  }

  const formatted = formatFormValue(value);
  if (formatted !== null && path.length) {
    details["Form Response — " + path.map(humanizeKey).join(" — ")] = formatted;
  }
}

function makeExportRows(applications: ExportApplication[]): ApplicationExportRow[] {
  return applications.map((application) => {
    const details: Record<string, string> = {};
    const formData = application.formData && typeof application.formData === "object" &&
      !Array.isArray(application.formData)
      ? application.formData as Record<string, unknown>
      : {};
    const enrollment = formData.enrollment && typeof formData.enrollment === "object" &&
      !Array.isArray(formData.enrollment)
      ? formData.enrollment as Record<string, unknown>
      : {};

    addDetail(details, "Applicant First Name", application.applicant.firstName);
    addDetail(details, "Applicant Last Name", application.applicant.lastName);
    addDetail(details, "Applicant Phone", application.applicant.phone);
    addDetail(details, "Student Date of Birth", application.studentDob);
    addDetail(details, "Student Gender", application.studentGender);
    addDetail(details, "Student Nationality", application.studentNationality);
    addDetail(details, "Student State of Origin", application.studentStateOfOrigin);
    addDetail(details, "Student LGA", application.studentLga);
    addDetail(details, "Previous School", application.previousSchool);
    addDetail(details, "Previous School Address", application.previousSchoolAddress);
    addDetail(details, "Admission Cycle", application.admissionCycle.name);
    addDetail(details, "Student Type", enrollment.studentType);
    addDetail(details, "Submitted At", application.submittedAt);
    addDetail(details, "Payment Status", application.paymentStatus.replace(/_/g, " "));

    const profile = application.applicant.applicantProfile;
    if (profile) {
      addDetail(details, "Applicant Profile — Guardian Title", profile.guardianTitle);
      addDetail(details, "Applicant Profile — Occupation", profile.occupation);
      addDetail(details, "Applicant Profile — Employer", profile.employer);
      addDetail(details, "Applicant Profile — Office Address", profile.officeAddress);
      addDetail(details, "Applicant Profile — Secondary Phone", profile.secondaryPhone);
      addDetail(details, "Applicant Profile — Residential Address", profile.residentialAddress);
      addDetail(details, "Applicant Profile — State", profile.state);
      addDetail(details, "Applicant Profile — LGA", profile.lga);
      addDetail(details, "Applicant Profile — City", profile.city);
      addDetail(details, "Applicant Profile — Emergency Contact Name", profile.emergencyContactName);
      addDetail(details, "Applicant Profile — Emergency Contact Phone", profile.emergencyContactPhone);
      addDetail(details, "Applicant Profile — Emergency Contact Relationship", profile.emergencyContactRelation);
      addDetail(details, "Applicant Profile — Data Consent Given", profile.dataConsentGiven);
      addDetail(details, "Applicant Profile — Data Consent Date", profile.dataConsentDate);
    }

    flattenFormData(application.formData, [], details);

    application.documents.forEach((document, index) => {
      const prefix = "Uploaded Document " + String(index + 1) + " — ";
      addDetail(details, prefix + "File Name", document.fileName);
      addDetail(details, prefix + "Type", document.documentType.replace(/_/g, " "));
      addDetail(details, prefix + "Size (bytes)", document.fileSize);
      addDetail(details, prefix + "Verified", document.isVerified);
      addDetail(details, prefix + "Uploaded At", document.uploadedAt);
      addDetail(details, prefix + "Verification Note", document.verificationNote);
    });

    return {
      applicationNumber: application.applicationNumber,
      studentName:
        [application.studentFirstName, application.studentMiddleName, application.studentLastName]
          .filter((name): name is string => Boolean(name))
          .join(" ") || "—",
      email: application.applicant.email,
      campus: application.branch.name,
      className: CLASS_LEVEL_CONFIG[application.classApplied]?.label ?? application.classApplied,
      session: application.admissionCycle.academicYear,
      status: application.status.replace(/_/g, " "),
      updatedAt: application.updatedAt,
      details,
    };
  });
}

function downloadResponse(
  rows: ApplicationExportRow[],
  format: ExportFormat,
  scope: "selected" | "filtered",
) {
  const scopeLabel = scope === "selected" ? "selected" : "filtered";
  const date = new Date().toISOString().slice(0, 10);
  const filename = "students-" + scopeLabel + "-" + date + "." + format;
  const contentType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : format === "csv"
        ? "text/csv; charset=utf-8"
        : "application/pdf";
  const body =
    format === "xlsx"
      ? createXlsx(rows)
      : format === "csv"
        ? createCsv(rows)
        : createPdf(rows, scope === "selected" ? "Selected students" : "Filtered students");

  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": 'attachment; filename="' + filename + '"',
      "Cache-Control": "private, no-store",
    },
  });
}

async function authorizeSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN" || !session.user.organizationId) {
    return null;
  }
  return session.user.organizationId;
}

export async function GET(request: Request) {
  try {
    const organizationId = await authorizeSuperAdmin();
    if (!organizationId) {
      return NextResponse.json({ error: "Super admin access required" }, { status: 401 });
    }

    const url = new URL(request.url);
    const format = parseFormat(url.searchParams.get("format"));
    const where = buildWhere(organizationId, url.searchParams);
    if (!format || !where) {
      return NextResponse.json({ error: "Invalid export filters or format" }, { status: 400 });
    }

    const applications = await db.application.findMany({
      where,
      select: applicationExportSelect,
      orderBy: { updatedAt: "desc" },
    });

    return downloadResponse(makeExportRows(applications), format, "filtered");
  } catch (error) {
    console.error("[SA_EXPORT_APPLICATIONS]", error);
    return NextResponse.json({ error: "Could not export applications" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const organizationId = await authorizeSuperAdmin();
    if (!organizationId) {
      return NextResponse.json({ error: "Super admin access required" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => null)) as
      | { ids?: unknown; format?: unknown }
      | null;
    const format = parseFormat(payload?.format);
    const ids = Array.isArray(payload?.ids)
      ? payload.ids.filter((id): id is string => typeof id === "string" && id.length <= 64)
      : [];

    if (!format || ids.length === 0 || ids.length > 5000) {
      return NextResponse.json({ error: "Choose rows and a valid export format" }, { status: 400 });
    }

    const applications = await db.application.findMany({
      where: { organizationId, id: { in: [...new Set(ids)] } },
      select: applicationExportSelect,
      orderBy: { updatedAt: "desc" },
    });

    return downloadResponse(makeExportRows(applications), format, "selected");
  } catch (error) {
    console.error("[SA_EXPORT_SELECTED_APPLICATIONS]", error);
    return NextResponse.json({ error: "Could not export selected applications" }, { status: 500 });
  }
}
