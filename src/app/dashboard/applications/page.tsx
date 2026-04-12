import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/utils";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";

export default async function ApplicationsPage() {
  const session = await auth();

  const applications = await db.application.findMany({
    where: { applicantId: session!.user.id },
    include: {
      branch: { select: { name: true } },
      admissionCycle: { select: { academicYear: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="My Applications"
        description="Track all your school applications"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Applications" }]}
        actions={
          <Button className="bg-[#1B4332] hover:bg-[#2D6A4F]" asChild>
            <Link href="/dashboard/applications/new">
              <Plus className="mr-2 h-4 w-4" /> New Application
            </Link>
          </Button>
        }
      />

      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={FileText}
              title="No applications yet"
              description="Create your first application to get the process started."
              action={
                <Button className="bg-[#1B4332] hover:bg-[#2D6A4F]" asChild>
                  <Link href="/dashboard/applications/new">Start application</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Link key={app.id} href={`/dashboard/applications/${app.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{app.applicationNumber}</span>
                      <StatusBadge status={app.status} size="sm" />
                    </div>
                    <p className="font-medium text-gray-900">
                      {app.studentFirstName
                        ? `${app.studentFirstName} ${app.studentLastName ?? ""}`
                        : "Incomplete application"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {app.branch.name} · {CLASS_LEVEL_CONFIG[app.classApplied].label} · {app.admissionCycle.academicYear}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-xs text-gray-400">Updated</p>
                    <p className="text-xs font-medium text-gray-600">{formatDate(app.updatedAt)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
