"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Printer, Trash2, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import type { ApplicationStatus } from "@prisma/client";

interface Application {
  id: string;
  applicationNumber: string;
  status: ApplicationStatus;
  paymentStatus: string;
  studentFirstName: string | null;
  studentLastName: string | null;
  classApplied: string | null;
  createdAt: Date;
  updatedAt: Date;
  branch: { name: string };
  admissionCycle: { academicYear: string };
}

const STATUS_TABS: { label: string; value: ApplicationStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

const PAYMENT_BADGE: Record<string, { label: string; className: string }> = {
  UNPAID:  { label: "Unpaid",    className: "bg-red-50 text-red-700 border-red-200" },
  PENDING: { label: "Pending",   className: "bg-amber-50 text-amber-700 border-amber-200" },
  PAID:    { label: "Paid",      className: "bg-green-50 text-green-700 border-green-200" },
};

type SortKey = "applicationNumber" | "studentName" | "branch" | "classApplied" | "updatedAt";
type SortDir = "asc" | "desc";

export default function ApplicationsTable({ applications: initialApps }: { applications: Application[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(initialApps);
  const [activeStatus, setActiveStatus] = useState<ApplicationStatus | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(app: Application) {
    if (!window.confirm(`Delete application ${app.applicationNumber}? This cannot be undone.`)) return;
    setDeletingId(app.id);
    try {
      const res = await fetch(`/api/applications/${app.id}`, { method: "DELETE" });
      const json = await res.json() as { success: boolean; error?: { message: string } };
      if (!json.success) throw new Error(json.error?.message ?? "Delete failed");
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      toast.success("Application deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete application");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const list = activeStatus === "ALL"
      ? apps
      : apps.filter((a) => a.status === activeStatus);

    return [...list].sort((a, b) => {
      let va: string, vb: string;
      switch (sortKey) {
        case "applicationNumber": va = a.applicationNumber; vb = b.applicationNumber; break;
        case "studentName":
          va = `${a.studentFirstName ?? ""} ${a.studentLastName ?? ""}`.trim();
          vb = `${b.studentFirstName ?? ""} ${b.studentLastName ?? ""}`.trim();
          break;
        case "branch": va = a.branch.name; vb = b.branch.name; break;
        case "classApplied": va = a.classApplied ?? ""; vb = b.classApplied ?? ""; break;
        case "updatedAt":
          va = a.updatedAt.toString();
          vb = b.updatedAt.toString();
          break;
        default: return 0;
      }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [apps, activeStatus, sortKey, sortDir]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="ml-1 inline size-3.5 text-gray-300" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 inline size-3.5 text-gray-600" />
      : <ChevronDown className="ml-1 inline size-3.5 text-gray-600" />;
  }

  const canEdit = (status: ApplicationStatus) =>
    status === "DRAFT" || status === "REVISION_REQUIRED";

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1 border-b pb-3">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.value === "ALL"
              ? apps.length
              : apps.filter((a) => a.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveStatus(tab.value)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                activeStatus === tab.value
                  ? "bg-[#1B4332] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0 text-xs ${
                  activeStatus === tab.value
                    ? "bg-white/20 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-gray-400">
          No applications match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th
                  className="cursor-pointer px-4 py-3 text-left hover:text-gray-700"
                  onClick={() => handleSort("applicationNumber")}
                >
                  Ref No. <SortIcon col="applicationNumber" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left hover:text-gray-700"
                  onClick={() => handleSort("studentName")}
                >
                  Student <SortIcon col="studentName" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left hover:text-gray-700"
                  onClick={() => handleSort("branch")}
                >
                  Branch <SortIcon col="branch" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left hover:text-gray-700"
                  onClick={() => handleSort("classApplied")}
                >
                  Class <SortIcon col="classApplied" />
                </th>
                <th className="px-4 py-3 text-left">Year</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th
                  className="cursor-pointer px-4 py-3 text-left hover:text-gray-700"
                  onClick={() => handleSort("updatedAt")}
                >
                  Updated <SortIcon col="updatedAt" />
                </th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((app) => {
                const studentName =
                  app.studentFirstName
                    ? `${app.studentFirstName} ${app.studentLastName ?? ""}`.trim()
                    : "—";
                const classLabel =
                  app.classApplied && CLASS_LEVEL_CONFIG[app.classApplied as keyof typeof CLASS_LEVEL_CONFIG]
                    ? CLASS_LEVEL_CONFIG[app.classApplied as keyof typeof CLASS_LEVEL_CONFIG].label
                    : "—";
                const payment = PAYMENT_BADGE[app.paymentStatus] ?? PAYMENT_BADGE.UNPAID;

                return (
                  <tr
                    key={app.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {app.applicationNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {studentName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{app.branch.name}</td>
                    <td className="px-4 py-3 text-gray-600">{classLabel}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {app.admissionCycle.academicYear}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${payment.className}`}
                      >
                        {payment.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDate(app.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {/* View */}
                        <button
                          type="button"
                          title="View application"
                          onClick={() => router.push(`/dashboard/applications/${app.id}`)}
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Eye className="size-4" />
                        </button>

                        {/* Edit — only for editable statuses */}
                        {canEdit(app.status) ? (
                          <button
                            type="button"
                            title="Edit application"
                            onClick={() =>
                              router.push(`/dashboard/applications/new?resume=${app.id}`)
                            }
                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-700"
                          >
                            <Pencil className="size-4" />
                          </button>
                        ) : (
                          <span className="size-7" />
                        )}

                        {/* Print */}
                        <button
                          type="button"
                          title="Print application"
                          onClick={() =>
                            window.open(`/dashboard/applications/${app.id}/print`, "_blank")
                          }
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Printer className="size-4" />
                        </button>

                        {/* Delete — only for DRAFT */}
                        {app.status === "DRAFT" ? (
                          <button
                            type="button"
                            title="Delete application"
                            disabled={deletingId === app.id}
                            onClick={() => handleDelete(app)}
                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                          >
                            {deletingId === app.id
                              ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                              : <Trash2 className="size-4" />}
                          </button>
                        ) : (
                          <span className="size-7" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
