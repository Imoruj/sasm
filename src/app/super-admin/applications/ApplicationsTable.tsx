"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, FileText, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ApplicationRowActions from "@/components/shared/ApplicationRowActions";
import StatusBadge from "@/components/shared/StatusBadge";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import { formatDate } from "@/lib/utils";
import type { ApplicationStatus, ClassLevel } from "@prisma/client";

interface ApplicationRecord {
  id: string;
  applicationNumber: string;
  studentFirstName: string | null;
  studentLastName: string | null;
  applicantEmail: string;
  classApplied: ClassLevel;
  status: ApplicationStatus;
  updatedAt: string;
  campus: string;
  session: string;
}

interface Filters {
  branch?: string;
  session?: string;
  class?: string;
  status?: string;
  search?: string;
}

interface Props {
  applications: ApplicationRecord[];
  total: number;
  filters: Filters;
  resetKey: string;
}

type ExportFormat = "xlsx" | "csv" | "pdf";
type ExportScope = "filtered" | "selected";

const FORMAT_OPTIONS: Array<{ value: ExportFormat; label: string; icon: typeof FileText }> = [
  { value: "xlsx", label: "Excel workbook (.xlsx)", icon: FileSpreadsheet },
  { value: "csv", label: "CSV (.csv)", icon: FileText },
  { value: "pdf", label: "PDF (.pdf)", icon: FileText },
];

export default function ApplicationsTable({ applications, total, filters, resetKey }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [scope, setScope] = useState<ExportScope>("filtered");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [isExporting, setIsExporting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const selectedCount = selectedIds.size;
  const allSelected =
    applications.length > 0 && applications.every((application) => selectedIds.has(application.id));
  const someSelected = applications.some((application) => selectedIds.has(application.id));
  const formatOption = useMemo(
    () => FORMAT_OPTIONS.find((option) => option.value === format) ?? FORMAT_OPTIONS[0],
    [format],
  );
  const FormatIcon = formatOption.icon;

  useEffect(() => {
    setSelectedIds(new Set());
    setScope("filtered");
  }, [resetKey]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [allSelected, someSelected]);

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCurrentPage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) applications.forEach((application) => next.delete(application.id));
      else applications.forEach((application) => next.add(application.id));
      return next;
    });
  };

  const downloadExport = async () => {
    if (scope === "selected" && selectedCount === 0) return;
    setIsExporting(true);

    try {
      let response: Response;
      if (scope === "selected") {
        response = await fetch("/api/super-admin/applications/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [...selectedIds], format }),
        });
      } else {
        const query = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) query.set(key, value);
        });
        query.set("format", format);
        response = await fetch("/api/super-admin/applications/export?" + query.toString());
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Download failed. Please try again.");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") ?? "";
      const filename = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] ??
        "students-" + scope + "." + format;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download the file");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">Export student records</p>
          <p className="text-xs text-gray-500">
            {scope === "filtered"
              ? String(total) + " records matching the current filters"
              : String(selectedCount) + " selected on this page"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="export-scope">Records to export</label>
          <select
            id="export-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as ExportScope)}
            className="h-9 min-w-52 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition-colors focus-visible:border-[#1B4332] focus-visible:ring-2 focus-visible:ring-[#1B4332]/20"
          >
            <option value="filtered">All records matching filters</option>
            <option value="selected" disabled={selectedCount === 0}>
              Selected rows ({selectedCount})
            </option>
          </select>
          <label className="sr-only" htmlFor="export-format">File format</label>
          <select
            id="export-format"
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
            className="h-9 min-w-48 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition-colors focus-visible:border-[#1B4332] focus-visible:ring-2 focus-visible:ring-[#1B4332]/20"
          >
            {FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Button
            type="button"
            onClick={downloadExport}
            disabled={isExporting || (scope === "selected" && selectedCount === 0)}
            className="bg-[#1B4332] hover:bg-[#153527]"
          >
            {isExporting ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <FormatIcon aria-hidden="true" />
            )}
            {isExporting ? "Preparing…" : "Download"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label="Select all rows on this page"
                      checked={allSelected}
                      onChange={toggleCurrentPage}
                      className="h-4 w-4 rounded border-gray-300 accent-[#1B4332] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332]"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Application #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Student</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Campus</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Class</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Session</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Updated</th>
                  <th className="w-10 px-4 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.map((application) => (
                  <tr
                    key={application.id}
                    className={selectedIds.has(application.id) ? "bg-[#1B4332]/[0.035]" : "hover:bg-gray-50"}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={"Select " + application.applicationNumber}
                        checked={selectedIds.has(application.id)}
                        onChange={() => toggleSelection(application.id)}
                        className="h-4 w-4 rounded border-gray-300 accent-[#1B4332] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={"/admin/applications/" + application.id}
                        className="font-mono text-xs text-[#1B4332] hover:underline"
                      >
                        {application.applicationNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {application.studentFirstName
                          ? application.studentFirstName + " " + (application.studentLastName ?? "")
                          : "—"}
                      </p>
                      <p className="text-xs text-gray-500">{application.applicantEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{application.campus}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {CLASS_LEVEL_CONFIG[application.classApplied]?.label ?? application.classApplied}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{application.session}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={application.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDate(new Date(application.updatedAt))}
                    </td>
                    <td className="px-4 py-3">
                      <ApplicationRowActions
                        id={application.id}
                        applicationNumber={application.applicationNumber}
                        status={application.status}
                        viewHref={"/admin/applications/" + application.id}
                        deleteEndpoint="/api/super-admin/applications"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {applications.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-gray-800">No students match these filters</p>
                <p className="mt-1 text-sm text-gray-500">Change a class, session, or campus filter and try again.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedCount > 0 && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>{selectedCount} row{selectedCount === 1 ? "" : "s"} selected on this page</span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex items-center gap-1 rounded text-[#1B4332] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4332]"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Clear selection
          </button>
        </div>
      )}
    </>
  );
}
