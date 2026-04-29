import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ApplicationStatus } from "@prisma/client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import { Button } from "@/components/ui/button";

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const limit = 20;

  const where = {
    organizationId: session!.user.organizationId ?? "",
    ...(session!.user.branchId ? { branchId: session!.user.branchId } : {}),
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

  const [applications, total] = await Promise.all([
    db.application.findMany({
      where,
      include: { branch: { select: { name: true } }, applicant: { select: { email: true, phone: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.application.count({ where }),
  ]);

  const statuses: ApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVISION_REQUIRED"];

  return (
    <div>
      <PageHeader
        title="Applications"
        description={`${total} total applications`}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Applications" }]}
        actions={
          <Button asChild>
            <Link href="/admin/applications/start">Start for Applicant</Link>
          </Button>
        }
      />

      {/* Status filter tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto">
        <Link
          href="/admin/applications"
          className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${!params.status ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          All ({total})
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/admin/applications?status=${s}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${params.status === s ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
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
                        {app.studentFirstName ? `${app.studentFirstName} ${app.studentLastName ?? ""}` : "—"}
                      </p>
                      <p className="text-xs text-gray-500">{app.applicant.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{app.branch.name}</td>
                    <td className="px-4 py-3 text-gray-600">{CLASS_LEVEL_CONFIG[app.classApplied].label}</td>
                    <td className="px-4 py-3"><StatusBadge status={app.status} size="sm" /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(app.updatedAt)}</td>
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
    </div>
  );
}
