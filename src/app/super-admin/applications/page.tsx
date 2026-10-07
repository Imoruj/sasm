import { ApplicationStatus, ClassLevel, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import { CLASS_LEVEL_CONFIG, CLASS_LEVELS } from "@/constants/classLevels";
import ApplicationsTable from "./ApplicationsTable";

const STATUSES: ApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUIRED",
  "EXAM_SCHEDULED",
  "EXAM_COMPLETED",
  "ADMITTED",
  "NOT_ADMITTED",
  "ENROLLED",
];

interface PageParams {
  status?: string;
  branch?: string;
  class?: string;
  session?: string;
  search?: string;
  page?: string;
}

export default async function SuperAdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  const session = await auth();
  const params = await searchParams;
  const page = Math.max(1, Math.trunc(Number(params.page ?? 1)) || 1);
  const limit = 25;
  const organizationId = session?.user?.organizationId ?? "";

  const selectedClass =
    params.class && Object.values(ClassLevel).includes(params.class as ClassLevel)
      ? (params.class as ClassLevel)
      : undefined;
  const selectedStatus =
    params.status && STATUSES.includes(params.status as ApplicationStatus)
      ? (params.status as ApplicationStatus)
      : undefined;

  const where: Prisma.ApplicationWhereInput = {
    organizationId,
    ...(params.branch ? { branchId: params.branch } : {}),
    ...(params.session ? { admissionCycleId: params.session } : {}),
    ...(selectedClass ? { classApplied: selectedClass } : {}),
    ...(selectedStatus ? { status: selectedStatus } : {}),
    ...(params.search?.trim()
      ? {
          OR: [
            { applicationNumber: { contains: params.search.trim(), mode: "insensitive" as const } },
            { studentFirstName: { contains: params.search.trim(), mode: "insensitive" as const } },
            { studentLastName: { contains: params.search.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [applications, total, branches, cycles] = await Promise.all([
    db.application.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        applicant: { select: { email: true } },
        admissionCycle: { select: { academicYear: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.application.count({ where }),
    db.branch.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.admissionCycle.findMany({
      where: { organizationId },
      select: { id: true, academicYear: true, name: true },
      orderBy: [{ academicYear: "desc" }, { name: "asc" }],
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const activeFilters = {
    branch: params.branch,
    class: selectedClass,
    session: params.session,
    status: selectedStatus,
    search: params.search?.trim() || undefined,
  };
  const resetKey = [
    activeFilters.branch,
    activeFilters.class,
    activeFilters.session,
    activeFilters.status,
    activeFilters.search,
    String(page),
  ].join("|");

  function filterHref(extra: Record<string, string | undefined>) {
    const merged: Record<string, string | undefined> = {
      ...activeFilters,
      ...extra,
    };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    const search = query.toString();
    return "/super-admin/applications" + (search ? "?" + search : "");
  }

  return (
    <div>
      <PageHeader
        title="All Applications"
        description={
          String(total) +
          " application" +
          (total === 1 ? "" : "s") +
          " matching the current filters"
        }
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Applications" }]}
      />

      <form
        method="get"
        action="/super-admin/applications"
        className="mb-4 rounded-lg border border-gray-200 bg-white p-3"
      >
        {selectedStatus && <input type="hidden" name="status" value={selectedStatus} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(160px,1fr)_minmax(150px,0.8fr)_minmax(160px,1fr)_minmax(220px,1.2fr)_auto_auto]">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-gray-600">
            Campus
            <select
              name="branch"
              defaultValue={params.branch ?? ""}
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 outline-none transition-colors focus-visible:border-[#1B4332] focus-visible:ring-2 focus-visible:ring-[#1B4332]/20"
            >
              <option value="">All campuses</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-gray-600">
            Class
            <select
              name="class"
              defaultValue={selectedClass ?? ""}
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 outline-none transition-colors focus-visible:border-[#1B4332] focus-visible:ring-2 focus-visible:ring-[#1B4332]/20"
            >
              <option value="">All classes</option>
              {CLASS_LEVELS.map((classLevel) => (
                <option key={classLevel} value={classLevel}>
                  {CLASS_LEVEL_CONFIG[classLevel].label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-gray-600">
            Session
            <select
              name="session"
              defaultValue={params.session ?? ""}
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 outline-none transition-colors focus-visible:border-[#1B4332] focus-visible:ring-2 focus-visible:ring-[#1B4332]/20"
            >
              <option value="">All sessions</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.academicYear}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-gray-600">
            Search
            <input
              type="search"
              name="search"
              defaultValue={params.search ?? ""}
              placeholder="Student name or application #"
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus-visible:border-[#1B4332] focus-visible:ring-2 focus-visible:ring-[#1B4332]/20"
            />
          </label>

          <button
            type="submit"
            className="mt-auto inline-flex h-9 items-center justify-center rounded-md bg-[#1B4332] px-4 text-sm font-medium text-white transition-colors hover:bg-[#153527] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332]"
          >
            Apply filters
          </button>
          <Link
            href="/super-admin/applications"
            className="mt-auto inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332]"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        <Link
          href={filterHref({ status: undefined, page: undefined })}
          className={
            "rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors " +
            (!selectedStatus
              ? "bg-[#1B4332] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200")
          }
        >
          All Statuses
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={filterHref({ status, page: undefined })}
            className={
              "rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors " +
              (selectedStatus === status
                ? "bg-[#1B4332] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200")
            }
          >
            {status.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <ApplicationsTable
        applications={applications.map((application) => ({
          id: application.id,
          applicationNumber: application.applicationNumber,
          studentFirstName: application.studentFirstName,
          studentLastName: application.studentLastName,
          applicantEmail: application.applicant.email,
          classApplied: application.classApplied,
          status: application.status,
          updatedAt: application.updatedAt.toISOString(),
          campus: application.branch.name,
          session: application.admissionCycle.academicYear,
        }))}
        total={total}
        filters={activeFilters}
        resetKey={resetKey}
      />

      <div className="mt-3 flex flex-col items-center justify-between gap-2 text-sm text-gray-500 sm:flex-row">
        <span>
          {total === 0
            ? "No records"
            : "Showing " + String((page - 1) * limit + 1) + "–" +
              String(Math.min(page * limit, total)) + " of " + String(total)}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={filterHref({ page: String(page - 1) })}
                className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
              >
                Previous
              </Link>
            )}
            <span className="rounded-md border bg-gray-50 px-3 py-1.5 text-sm">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={filterHref({ page: String(page + 1) })}
                className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
