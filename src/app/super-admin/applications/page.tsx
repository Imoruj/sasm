import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ApplicationStatus } from "@prisma/client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import ApplicationRowActions from "@/components/shared/ApplicationRowActions";
import { formatDate } from "@/lib/utils";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";

const STATUSES: ApplicationStatus[] = [
  "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVISION_REQUIRED",
  "EXAM_SCHEDULED", "EXAM_COMPLETED", "ADMITTED", "ENROLLED",
];

export default async function SuperAdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; branch?: string; search?: string; page?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const limit = 25;

  const orgId = session!.user.organizationId ?? "";

  const where = {
    organizationId: orgId,
    ...(params.branch ? { branchId: params.branch } : {}),
    ...(params.status ? { status: params.status as ApplicationStatus } : {}),
    ...(params.search
      ? {
          OR: [
            { applicationNumber: { contains: params.search, mode: "insensitive" as const } },
            { studentFirstName: { contains: params.search, mode: "insensitive" as const } },
            { studentLastName: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [applications, total, branches] = await Promise.all([
    db.application.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        applicant: { select: { email: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.application.count({ where }),
    db.branch.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  function filterHref(extra: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { status: params.status, branch: params.branch, search: params.search, ...extra };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return `/super-admin/applications${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <PageHeader
        title="All Applications"
        description={`${total} application${total !== 1 ? "s" : ""} across all branches`}
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Applications" }]}
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {/* Branch filter */}
        <div className="flex gap-1.5 overflow-x-auto">
          <Link href={filterHref({ branch: undefined, page: undefined })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${!params.branch ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            All Branches
          </Link>
          {branches.map((b) => (
            <Link key={b.id} href={filterHref({ branch: b.id, page: undefined })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${params.branch === b.id ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {b.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        <Link href={filterHref({ status: undefined, page: undefined })}
          className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${!params.status ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          All Statuses
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={filterHref({ status: s, page: undefined })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${params.status === s ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Application #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Student</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Branch</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Class</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Updated</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/applications/${app.id}`} className="font-mono text-xs text-[#1B4332] hover:underline">
                        {app.applicationNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {app.studentFirstName
                          ? `${app.studentFirstName} ${app.studentLastName ?? ""}`
                          : "—"}
                      </p>
                      <p className="text-xs text-gray-500">{app.applicant.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{app.branch.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {CLASS_LEVEL_CONFIG[app.classApplied]?.label ?? app.classApplied}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={app.status} size="sm" /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(app.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <ApplicationRowActions
                        id={app.id}
                        applicationNumber={app.applicationNumber}
                        status={app.status}
                        viewHref={`/admin/applications/${app.id}`}
                        deleteEndpoint="/api/super-admin/applications"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {applications.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-500">No applications found.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && (
            <Link href={filterHref({ page: String(page - 1) })}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
              Previous
            </Link>
          )}
          <span className="rounded-md border bg-gray-50 px-3 py-1.5 text-sm">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={filterHref({ page: String(page + 1) })}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
