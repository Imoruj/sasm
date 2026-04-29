"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Eye, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import type { ApplicationStatus, ClassLevel } from "@prisma/client";

interface Application {
  id: string;
  applicationNumber: string;
  studentFirstName: string | null;
  studentLastName: string | null;
  status: ApplicationStatus;
  classApplied: ClassLevel;
  updatedAt: Date;
  branch: { name: string };
  applicant: { email: string };
}

interface Props {
  applications: Application[];
  total: number;
  statuses: ApplicationStatus[];
  currentStatus?: string;
  currentSearch?: string;
  page: number;
  limit: number;
}

export default function ApplicationsListClient({
  applications: initialApps,
  total,
  statuses,
  currentStatus,
  currentSearch,
  page,
  limit,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState(initialApps);
  const [search, setSearch] = useState(currentSearch ?? "");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const buildUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v === undefined || v === "") p.delete(k);
        else p.set(k, v);
      });
      p.delete("page");
      return `${pathname}?${p.toString()}`;
    },
    [pathname, searchParams],
  );

  const handleSearch = (value: string) => {
    setSearch(value);
    startTransition(() => {
      router.push(buildUrl({ search: value || undefined }));
    });
  };

  const handleDelete = async (app: Application) => {
    if (!window.confirm(`Delete application ${app.applicationNumber}? This cannot be undone.`)) return;

    setDeletingId(app.id);
    try {
      const res = await fetch(`/api/admin/applications/${app.id}`, { method: "DELETE" });
      const json = await res.json() as { success: boolean; error?: { message: string } };
      if (!json.success) throw new Error(json.error?.message ?? "Delete failed");
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      toast.success(`Application ${app.applicationNumber} deleted`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete application");
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto">
          <Link
            href={buildUrl({ status: undefined, search: search || undefined })}
            className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${!currentStatus ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            All ({total})
          </Link>
          {statuses.map((s) => (
            <Link
              key={s}
              href={buildUrl({ status: s, search: search || undefined })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${currentStatus === s ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {s.replace(/_/g, " ")}
            </Link>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search name or app #"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 pr-8 h-8 text-sm"
          />
          {search && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
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
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {apps.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/admin/applications/${app.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[#1B4332]">
                        {app.applicationNumber}
                      </span>
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
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDate(app.updatedAt)}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-[#1B4332]"
                          asChild
                        >
                          <Link href={`/admin/applications/${app.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                          onClick={() => handleDelete(app)}
                          disabled={
                            deletingId === app.id ||
                            ["ENROLLED", "ADMITTED"].includes(app.status)
                          }
                        >
                          {deletingId === app.id ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {apps.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-500">No applications found.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl({ page: String(page - 1) })}>Previous</Link>
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildUrl({ page: String(page + 1) })}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
