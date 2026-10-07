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

function makeExportRows(
  applications: Array<{
    applicationNumber: string;
    studentFirstName: string | null;
    studentMiddleName: string | null;
    studentLastName: string | null;
    classApplied: ClassLevel;
    status: ApplicationStatus;
    updatedAt: Date;
    branch: { name: string };
    admissionCycle: { academicYear: string };
    applicant: { email: string };
  }>,
): ApplicationExportRow[] {
  return applications.map((application) => ({
    applicationNumber: application.applicationNumber,
    studentName:
      [
        application.studentFirstName,
        application.studentMiddleName,
        application.studentLastName,
      ]
        .filter((name): name is string => Boolean(name))
        .join(" ") || "—",
    email: application.applicant.email,
    campus: application.branch.name,
    className: CLASS_LEVEL_CONFIG[application.classApplied]?.label ?? application.classApplied,
    session: application.admissionCycle.academicYear,
    status: application.status.replace(/_/g, " "),
    updatedAt: application.updatedAt,
  }));
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
      select: {
        applicationNumber: true,
        studentFirstName: true,
        studentMiddleName: true,
        studentLastName: true,
        classApplied: true,
        status: true,
        updatedAt: true,
        branch: { select: { name: true } },
        admissionCycle: { select: { academicYear: true } },
        applicant: { select: { email: true } },
      },
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
      select: {
        applicationNumber: true,
        studentFirstName: true,
        studentMiddleName: true,
        studentLastName: true,
        classApplied: true,
        status: true,
        updatedAt: true,
        branch: { select: { name: true } },
        admissionCycle: { select: { academicYear: true } },
        applicant: { select: { email: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return downloadResponse(makeExportRows(applications), format, "selected");
  } catch (error) {
    console.error("[SA_EXPORT_SELECTED_APPLICATIONS]", error);
    return NextResponse.json({ error: "Could not export selected applications" }, { status: 500 });
  }
}
