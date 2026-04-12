import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { Building2, Users, FileText, GraduationCap } from "lucide-react";
import Link from "next/link";

export default async function SuperAdminDashboardPage() {
  const session = await auth();
  const orgId = session!.user.organizationId ?? "";

  const [branches, staff, totalApps, cycles] = await Promise.all([
    db.branch.count({ where: { organizationId: orgId, isActive: true } }),
    db.user.count({ where: { organizationId: orgId, role: { in: ["SCHOOL_ADMIN"] } } }),
    db.application.count({ where: { organizationId: orgId } }),
    db.admissionCycle.count({ where: { organizationId: orgId, status: "OPEN" } }),
  ]);

  const kpis = [
    { label: "Active Branches", value: branches, icon: Building2, href: "/super-admin/branches", color: "text-blue-600" },
    { label: "Staff Accounts", value: staff, icon: Users, href: "/super-admin/staff", color: "text-purple-600" },
    { label: "Total Applications", value: totalApps, icon: FileText, href: "/super-admin/analytics", color: "text-amber-600" },
    { label: "Open Cycles", value: cycles, icon: GraduationCap, href: "/super-admin/cycles", color: "text-green-600" },
  ];

  return (
    <div>
      <PageHeader title="Super Admin Dashboard" description="Organisation-wide overview" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link key={kpi.label} href={kpi.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">{kpi.label}</CardTitle>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
