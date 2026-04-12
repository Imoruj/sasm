import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { FileText, Clock, CheckCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session!.user.name.split(" ")[0];

  const applications = await db.application.findMany({
    where: { applicantId: session!.user.id },
    include: { branch: { select: { name: true } }, admissionCycle: { select: { academicYear: true } } },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const stats = {
    total: applications.length,
    active: applications.filter((a) => !["ENROLLED", "REJECTED", "NOT_ADMITTED"].includes(a.status)).length,
    admitted: applications.filter((a) => a.status === "ADMITTED").length,
  };

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}!`}
        description="Manage your school applications from here."
        actions={
          <Button className="bg-[#1B4332] hover:bg-[#2D6A4F]" asChild>
            <Link href="/dashboard/applications/new">
              <Plus className="mr-2 h-4 w-4" /> New Application
            </Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Admitted</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{stats.admitted}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent applications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Applications</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/applications">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No applications yet"
              description="Start your first application to get admitted to your dream school."
              action={
                <Button className="bg-[#1B4332] hover:bg-[#2D6A4F]" asChild>
                  <Link href="/dashboard/applications/new">Start application</Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {applications.map((app) => (
                <Link
                  key={app.id}
                  href={`/dashboard/applications/${app.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {app.studentFirstName
                        ? `${app.studentFirstName} ${app.studentLastName ?? ""} — ${app.branch.name}`
                        : `Application ${app.applicationNumber}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {app.admissionCycle.academicYear} · {app.classApplied} · Updated {formatDate(app.updatedAt)}
                    </p>
                  </div>
                  <StatusBadge status={app.status} size="sm" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
