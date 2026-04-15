import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { formatNaira } from "@/lib/utils";
import {
  FileText,
  TrendingUp,
  Wallet,
  Building2,
  Users,
  CheckCircle2,
  BarChart2,
  GraduationCap,
} from "lucide-react";
import { APPLICATION_STATUS_CONFIG } from "@/constants/statuses";
import type { ApplicationStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Helpers (inline, no external chart library)
// ---------------------------------------------------------------------------

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function HBar({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}) {
  const width = pct(value, total);
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-right text-xs text-gray-500">{label}</span>
      <div className="flex-1 h-3 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${Math.max(width, value > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-semibold text-gray-700">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SuperAdminAnalyticsPage() {
  const session = await auth();
  const orgId = session!.user.organizationId ?? "";

  const [
    statusGroups,
    branchStats,
    cycleStats,
    paidPayments,
    pendingPayments,
    staffCount,
    applicantCount,
  ] = await Promise.all([
    db.application.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: { id: true },
    }),
    db.branch.findMany({
      where: { organizationId: orgId, isActive: true },
      select: {
        id: true,
        name: true,
        capacity: true,
        _count: { select: { applications: true, users: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.admissionCycle.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        academicYear: true,
        status: true,
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.payment.aggregate({
      where: { organizationId: orgId, status: "PAID" },
      _sum: { amountKobo: true },
      _count: { id: true },
    }),
    db.payment.count({ where: { organizationId: orgId, status: "PENDING" } }),
    db.user.count({ where: { organizationId: orgId, role: "SCHOOL_ADMIN" } }),
    db.user.count({ where: { organizationId: orgId, role: "APPLICANT" } }),
  ]);

  // Build status lookup
  const byStatus: Record<string, number> = {};
  for (const g of statusGroups) byStatus[g.status] = g._count.id;
  const totalApps = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const activeApps = totalApps - (byStatus["DRAFT"] ?? 0);

  const approvedPlus =
    (byStatus["APPROVED"] ?? 0) +
    (byStatus["EXAM_SCHEDULED"] ?? 0) +
    (byStatus["EXAM_COMPLETED"] ?? 0) +
    (byStatus["ADMITTED"] ?? 0) +
    (byStatus["NOT_ADMITTED"] ?? 0) +
    (byStatus["ENROLLED"] ?? 0);

  const admittedCount = (byStatus["ADMITTED"] ?? 0) + (byStatus["ENROLLED"] ?? 0);
  const revenueKobo = paidPayments._sum.amountKobo ?? 0;
  const branchMax = Math.max(...branchStats.map((b) => b._count.applications), 1);

  const kpis = [
    {
      label: "Total Applications",
      value: totalApps.toLocaleString(),
      sub: `${activeApps} submitted`,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Revenue Collected",
      value: formatNaira(revenueKobo),
      sub: `${paidPayments._count.id} payments · ${pendingPayments} pending`,
      icon: Wallet,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Approval Rate",
      value: `${pct(approvedPlus, activeApps)}%`,
      sub: `${approvedPlus} of ${activeApps} active`,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Admitted",
      value: admittedCount.toLocaleString(),
      sub: `${pct(admittedCount, totalApps)}% of total`,
      icon: TrendingUp,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Active Branches",
      value: branchStats.length.toLocaleString(),
      sub: "",
      icon: Building2,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Staff Accounts",
      value: staffCount.toLocaleString(),
      sub: "",
      icon: Users,
      color: "text-sky-600",
      bg: "bg-sky-50",
    },
    {
      label: "Registered Applicants",
      value: applicantCount.toLocaleString(),
      sub: "",
      icon: GraduationCap,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      label: "Pending Payments",
      value: pendingPayments.toLocaleString(),
      sub: "awaiting confirmation",
      icon: Wallet,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Organisation-wide performance overview"
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Analytics" }]}
      />

      {/* KPI Grid */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{kpi.label}</CardTitle>
                <div className={`rounded-lg p-2 ${kpi.bg}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{kpi.value}</p>
                {kpi.sub && <p className="mt-0.5 text-xs text-gray-400">{kpi.sub}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status Breakdown + Branch Stats */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Status breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <BarChart2 className="h-4 w-4 text-gray-400" />
            <CardTitle className="text-base font-semibold">Applications by Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {totalApps === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No applications yet</p>
            ) : (
              (Object.keys(APPLICATION_STATUS_CONFIG) as ApplicationStatus[]).map((status) => (
                <HBar
                  key={status}
                  label={APPLICATION_STATUS_CONFIG[status].label}
                  value={byStatus[status] ?? 0}
                  total={totalApps}
                  colorClass="bg-[#1B4332]"
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Branch comparison */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Building2 className="h-4 w-4 text-gray-400" />
            <CardTitle className="text-base font-semibold">Applications by Branch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {branchStats.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No branches</p>
            ) : (
              branchStats.map((branch) => (
                <HBar
                  key={branch.id}
                  label={branch.name}
                  value={branch._count.applications}
                  total={branchMax}
                  colorClass="bg-[#2D6A4F]"
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cycle performance + Branch capacity */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Cycle stats */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <GraduationCap className="h-4 w-4 text-gray-400" />
            <CardTitle className="text-base font-semibold">Recent Admission Cycles</CardTitle>
          </CardHeader>
          <CardContent>
            {cycleStats.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No cycles</p>
            ) : (
              <div className="divide-y">
                {cycleStats.map((cycle) => (
                  <div key={cycle.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{cycle.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{cycle.academicYear}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {cycle._count.applications.toLocaleString()}
                      </p>
                      <span
                        className={`text-xs font-medium ${
                          cycle.status === "OPEN"
                            ? "text-green-600"
                            : cycle.status === "CLOSED"
                            ? "text-gray-500"
                            : "text-amber-600"
                        }`}
                      >
                        {cycle.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Branch capacity */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Users className="h-4 w-4 text-gray-400" />
            <CardTitle className="text-base font-semibold">Branch Capacity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {branchStats.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No branches</p>
            ) : (
              branchStats.map((branch) => {
                const utilisation = pct(branch._count.applications, branch.capacity);
                return (
                  <div key={branch.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700 truncate">{branch.name}</span>
                      <span className="ml-2 shrink-0 text-gray-400">
                        {branch._count.applications}/{branch.capacity}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          utilisation >= 90 ? "bg-red-500" : utilisation >= 70 ? "bg-amber-500" : "bg-[#1B4332]"
                        }`}
                        style={{ width: `${Math.min(utilisation, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
