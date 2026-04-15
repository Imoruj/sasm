import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { formatNaira } from "@/lib/utils";
import {
  FileText,
  TrendingUp,
  Wallet,
  Users,
  CheckCircle2,
  XCircle,
  BarChart2,
} from "lucide-react";
import { APPLICATION_STATUS_CONFIG } from "@/constants/statuses";
import type { ApplicationStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BAR_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-400",
  SUBMITTED: "bg-blue-500",
  UNDER_REVIEW: "bg-amber-500",
  REVISION_REQUIRED: "bg-orange-500",
  APPROVED: "bg-green-500",
  REJECTED: "bg-red-500",
  EXAM_SCHEDULED: "bg-indigo-500",
  EXAM_COMPLETED: "bg-violet-500",
  ADMITTED: "bg-emerald-500",
  NOT_ADMITTED: "bg-red-400",
  ENROLLED: "bg-teal-500",
};

const CLASS_COLORS: Record<string, string> = {
  NURSERY: "bg-pink-400",
  PRIMARY: "bg-rose-400",
  JSS1: "bg-sky-400",
  JSS2: "bg-blue-400",
  JSS3: "bg-indigo-400",
  SS1: "bg-violet-400",
  SS2: "bg-purple-400",
  SS3: "bg-fuchsia-400",
};

const FUNNEL_STEPS: { status: ApplicationStatus; label: string }[] = [
  { status: "SUBMITTED", label: "Submitted" },
  { status: "UNDER_REVIEW", label: "Under Review" },
  { status: "APPROVED", label: "Approved" },
  { status: "EXAM_SCHEDULED", label: "Exam Scheduled" },
  { status: "ADMITTED", label: "Admitted" },
  { status: "ENROLLED", label: "Enrolled" },
];

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function HBar({
  label,
  value,
  total,
  colorClass,
  suffix,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
  suffix?: string;
}) {
  const width = pct(value, total);
  return (
    <div className="group flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-right text-xs text-gray-500">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-3">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${Math.max(width, value > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-xs font-semibold text-gray-700">
        {value.toLocaleString()}{suffix ? ` ${suffix}` : ""}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReportsPage() {
  const session = await auth();
  const orgId = session!.user.organizationId ?? "";
  const branchFilter = session!.user.branchId ? { branchId: session!.user.branchId } : {};
  const base = { organizationId: orgId, ...branchFilter };

  const [
    statusGroups,
    classGroups,
    branches,
    paidPayments,
    pendingPaymentsCount,
    failedPaymentsCount,
  ] = await Promise.all([
    db.application.groupBy({
      by: ["status"],
      where: base,
      _count: { id: true },
    }),
    db.application.groupBy({
      by: ["classApplied"],
      where: base,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    session!.user.branchId
      ? Promise.resolve([] as { id: string; name: string; _count: { applications: number } }[])
      : db.branch.findMany({
          where: { organizationId: orgId, isActive: true },
          select: { id: true, name: true, _count: { select: { applications: true } } },
          orderBy: { name: "asc" },
        }),
    db.payment.aggregate({
      where: {
        organizationId: orgId,
        status: "PAID",
        ...(session!.user.branchId
          ? { application: { branchId: session!.user.branchId } }
          : {}),
      },
      _sum: { amountKobo: true },
      _count: { id: true },
    }),
    db.payment.count({
      where: {
        organizationId: orgId,
        status: "PENDING",
        ...(session!.user.branchId
          ? { application: { branchId: session!.user.branchId } }
          : {}),
      },
    }),
    db.payment.count({
      where: {
        organizationId: orgId,
        status: "FAILED",
        ...(session!.user.branchId
          ? { application: { branchId: session!.user.branchId } }
          : {}),
      },
    }),
  ]);

  // Build lookup: status → count
  const byStatus: Record<string, number> = {};
  for (const g of statusGroups) byStatus[g.status] = g._count.id;

  const totalApps = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const activeApps = totalApps - (byStatus["DRAFT"] ?? 0);

  // Funnel counts (cumulative submitted+)
  const funnelCounts = FUNNEL_STEPS.map((step) => ({
    ...step,
    count: byStatus[step.status] ?? 0,
  }));
  const funnelMax = funnelCounts[0]?.count ?? 1;

  // Approval rate = approved+ / (submitted+)
  const approvedPlus =
    (byStatus["APPROVED"] ?? 0) +
    (byStatus["EXAM_SCHEDULED"] ?? 0) +
    (byStatus["EXAM_COMPLETED"] ?? 0) +
    (byStatus["ADMITTED"] ?? 0) +
    (byStatus["NOT_ADMITTED"] ?? 0) +
    (byStatus["ENROLLED"] ?? 0);
  const submittedPlus = activeApps;
  const approvalRate = pct(approvedPlus, submittedPlus);

  // Admitted rate = admitted + enrolled / approved+
  const admittedCount = (byStatus["ADMITTED"] ?? 0) + (byStatus["ENROLLED"] ?? 0);
  const admissionRate = pct(admittedCount, approvedPlus);

  const revenueKobo = paidPayments._sum.amountKobo ?? 0;
  const paidCount = paidPayments._count.id;

  // Class breakdown max
  const classMax = Math.max(...classGroups.map((g) => g._count.id), 1);

  // Branch max
  const branchMax = branches.length > 0 ? Math.max(...branches.map((b) => b._count.applications), 1) : 1;

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
      sub: `${paidCount} payments`,
      icon: Wallet,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Approval Rate",
      value: `${approvalRate}%`,
      sub: `${approvedPlus} of ${submittedPlus} active`,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Admission Rate",
      value: `${admissionRate}%`,
      sub: `${admittedCount} admitted/enrolled`,
      icon: TrendingUp,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Admission statistics and analytics overview"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Reports" }]}
      />

      {/* KPI Cards */}
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
                <p className="mt-0.5 text-xs text-gray-400">{kpi.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status Breakdown + Funnel */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Status Breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <BarChart2 className="h-4 w-4 text-gray-400" />
            <CardTitle className="text-base font-semibold">Applications by Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {totalApps === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No applications yet</p>
            ) : (
              (Object.keys(APPLICATION_STATUS_CONFIG) as ApplicationStatus[]).map((status) => {
                const count = byStatus[status] ?? 0;
                return (
                  <HBar
                    key={status}
                    label={APPLICATION_STATUS_CONFIG[status].label}
                    value={count}
                    total={totalApps}
                    colorClass={BAR_COLORS[status] ?? "bg-gray-400"}
                  />
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Admission Funnel */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <CardTitle className="text-base font-semibold">Admission Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelMax === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No submitted applications yet</p>
            ) : (
              <div className="space-y-4">
                {funnelCounts.map((step, i) => {
                  const prev = i > 0 ? funnelCounts[i - 1].count : step.count;
                  const dropOff = prev > 0 ? 100 - pct(step.count, prev) : 0;
                  const width = pct(step.count, funnelMax);
                  return (
                    <div key={step.status}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700">{step.label}</span>
                        <span className="text-gray-400">
                          {step.count.toLocaleString()}
                          {i > 0 && prev > 0 && (
                            <span className="ml-2 text-red-400">−{dropOff}%</span>
                          )}
                        </span>
                      </div>
                      <div className="h-6 overflow-hidden rounded bg-gray-100">
                        <div
                          className="h-full rounded bg-[#1B4332] transition-all"
                          style={{ width: `${Math.max(width, step.count > 0 ? 1 : 0)}%`, opacity: 1 - i * 0.12 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Class Level Breakdown + Branch Breakdown / Payment Stats */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Class Level */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Users className="h-4 w-4 text-gray-400" />
            <CardTitle className="text-base font-semibold">Applications by Class Level</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {classGroups.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No data</p>
            ) : (
              classGroups.map((g) => (
                <HBar
                  key={g.classApplied}
                  label={g.classApplied}
                  value={g._count.id}
                  total={classMax}
                  colorClass={CLASS_COLORS[g.classApplied] ?? "bg-gray-400"}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Branch Breakdown OR Payment Summary */}
        {branches.length > 0 ? (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <BarChart2 className="h-4 w-4 text-gray-400" />
              <CardTitle className="text-base font-semibold">Applications by Branch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {branches.map((branch) => (
                <HBar
                  key={branch.id}
                  label={branch.name}
                  value={branch._count.applications}
                  total={branchMax}
                  colorClass="bg-[#2D6A4F]"
                />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Wallet className="h-4 w-4 text-gray-400" />
              <CardTitle className="text-base font-semibold">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentSummary
                paidCount={paidCount}
                revenueKobo={revenueKobo}
                pendingCount={pendingPaymentsCount}
                failedCount={failedPaymentsCount}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment Summary (if branch breakdown shown above, show payment below) */}
      {branches.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Wallet className="h-4 w-4 text-gray-400" />
            <CardTitle className="text-base font-semibold">Payment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentSummary
              paidCount={paidCount}
              revenueKobo={revenueKobo}
              pendingCount={pendingPaymentsCount}
              failedCount={failedPaymentsCount}
            />
          </CardContent>
        </Card>
      )}

      {/* Rejection Stats */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <XCircle className="h-4 w-4 text-gray-400" />
          <CardTitle className="text-base font-semibold">Outcome Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Rejected",
                value: byStatus["REJECTED"] ?? 0,
                color: "text-red-600",
                bg: "bg-red-50",
              },
              {
                label: "Revision Required",
                value: byStatus["REVISION_REQUIRED"] ?? 0,
                color: "text-orange-600",
                bg: "bg-orange-50",
              },
              {
                label: "Not Admitted",
                value: byStatus["NOT_ADMITTED"] ?? 0,
                color: "text-rose-600",
                bg: "bg-rose-50",
              },
              {
                label: "Enrolled",
                value: byStatus["ENROLLED"] ?? 0,
                color: "text-teal-600",
                bg: "bg-teal-50",
              },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl p-4 ${item.bg}`}>
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${item.color}`}>
                  {item.value.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {pct(item.value, totalApps)}% of total
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment summary sub-component (server, no "use client" needed)
// ---------------------------------------------------------------------------

function PaymentSummary({
  paidCount,
  revenueKobo,
  pendingCount,
  failedCount,
}: {
  paidCount: number;
  revenueKobo: number;
  pendingCount: number;
  failedCount: number;
}) {
  const total = paidCount + pendingCount + failedCount;

  const rows = [
    {
      label: "Successful",
      count: paidCount,
      amount: formatNaira(revenueKobo),
      color: "text-green-600",
      bg: "bg-green-50",
      barColor: "bg-green-500",
    },
    {
      label: "Pending",
      count: pendingCount,
      amount: null,
      color: "text-amber-600",
      bg: "bg-amber-50",
      barColor: "bg-amber-400",
    },
    {
      label: "Failed",
      count: failedCount,
      amount: null,
      color: "text-red-600",
      bg: "bg-red-50",
      barColor: "bg-red-400",
    },
  ];

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">No payment records yet</p>;
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">{row.label}</span>
            <span className={`font-semibold ${row.color}`}>
              {row.count.toLocaleString()} txn{row.amount ? ` · ${row.amount}` : ""}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${row.barColor}`}
              style={{ width: `${pct(row.count, total)}%` }}
            />
          </div>
        </div>
      ))}
      <p className="pt-1 text-right text-xs text-gray-400">{total} total transactions</p>
    </div>
  );
}
