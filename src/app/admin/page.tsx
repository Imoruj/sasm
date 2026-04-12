import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { FileText, Clock, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const session = await auth();
  const branchFilter = session!.user.branchId
    ? { branchId: session!.user.branchId }
    : {};

  const [total, submitted, approved, rejected, recent] = await Promise.all([
    db.application.count({ where: { ...branchFilter, organizationId: session!.user.organizationId ?? "" } }),
    db.application.count({ where: { ...branchFilter, organizationId: session!.user.organizationId ?? "", status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    db.application.count({ where: { ...branchFilter, organizationId: session!.user.organizationId ?? "", status: "APPROVED" } }),
    db.application.count({ where: { ...branchFilter, organizationId: session!.user.organizationId ?? "", status: "REJECTED" } }),
    db.application.findMany({
      where: { ...branchFilter, organizationId: session!.user.organizationId ?? "" },
      include: { branch: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  const kpis = [
    { label: "Total Applications", value: total, icon: FileText, color: "text-blue-600" },
    { label: "Awaiting Review", value: submitted, icon: Clock, color: "text-amber-600" },
    { label: "Approved", value: approved, icon: CheckCircle, color: "text-green-600" },
    { label: "Rejected", value: rejected, icon: XCircle, color: "text-red-600" },
  ];

  return (
    <div>
      <PageHeader title="Admin Dashboard" description="Overview of all applications" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{kpi.label}</CardTitle>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Applications</CardTitle>
          <Link href="/admin/applications" className="text-sm text-[#1B4332] hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100">
            {recent.map((app) => (
              <Link
                key={app.id}
                href={`/admin/applications/${app.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {app.studentFirstName
                      ? `${app.studentFirstName} ${app.studentLastName ?? ""}`
                      : app.applicationNumber}
                  </p>
                  <p className="text-xs text-gray-500">{app.branch.name} · {app.classApplied} · {formatDate(app.updatedAt)}</p>
                </div>
                <StatusBadge status={app.status} size="sm" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
