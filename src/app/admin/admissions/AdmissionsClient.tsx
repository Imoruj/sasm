"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, GraduationCap, ExternalLink, CheckCircle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import type { ClassLevel } from "@prisma/client";

interface Enrollment {
  id: string;
  applicationNumber: string;
  status: "ENROLLED";
  studentFirstName: string | null;
  studentLastName: string | null;
  studentGender: string | null;
  classApplied: string | null;
  branch: { name: string };
  admissionCycle: { name: string; academicYear: string };
  applicant: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
  };
  documentsCount: number;
  documentsVerified: number;
  admissionFeePaid: boolean;
  admissionFee: { amountKobo: number; paidAt: string | null } | null;
  updatedAt: string;
}

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function AdmissionsClient({ enrollments }: { enrollments: Enrollment[] }) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [cycleFilter, setCycleFilter] = useState("all");

  const branches = useMemo(
    () => Array.from(new Set(enrollments.map((e) => e.branch.name))).sort(),
    [enrollments],
  );
  const cycles = useMemo(
    () => Array.from(new Set(enrollments.map((e) => e.admissionCycle.name))).sort(),
    [enrollments],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return enrollments.filter((e) => {
      const studentName = `${e.studentFirstName ?? ""} ${e.studentLastName ?? ""}`.toLowerCase();
      const parentName  = `${e.applicant.firstName ?? ""} ${e.applicant.lastName ?? ""}`.toLowerCase();
      const matchSearch =
        !q ||
        studentName.includes(q) ||
        parentName.includes(q) ||
        e.applicationNumber.toLowerCase().includes(q) ||
        e.applicant.email.toLowerCase().includes(q);
      const matchBranch = branchFilter === "all" || e.branch.name === branchFilter;
      const matchCycle  = cycleFilter === "all"  || e.admissionCycle.name === cycleFilter;
      return matchSearch && matchBranch && matchCycle;
    });
  }, [enrollments, search, branchFilter, cycleFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or application number…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {branches.length > 1 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}

        {cycles.length > 1 && (
          <select
            value={cycleFilter}
            onChange={(e) => setCycleFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30"
          >
            <option value="all">All Cycles</option>
            {cycles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <GraduationCap className="mb-3 size-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No enrolled students found</p>
          <p className="mt-1 text-xs text-gray-400">
            {search || branchFilter !== "all" || cycleFilter !== "all"
              ? "Try adjusting your filters"
              : "Students appear here once all their admission documents are verified and they are fully enrolled"}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Student</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Class</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Branch / Cycle</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Parent / Guardian</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Documents</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Fee</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Enrolled</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e) => {
                  const studentName  = `${e.studentFirstName ?? "—"} ${e.studentLastName ?? ""}`.trim();
                  const parentName   = `${e.applicant.firstName ?? ""} ${e.applicant.lastName ?? ""}`.trim() || "—";
                  const classConfig  = e.classApplied ? CLASS_LEVEL_CONFIG[e.classApplied as ClassLevel] : null;
                  const docsComplete = e.documentsCount > 0 && e.documentsVerified === e.documentsCount;

                  return (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      {/* Student */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                            {(e.studentFirstName?.[0] ?? "?").toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{studentName}</p>
                            <p className="text-xs text-gray-400 font-mono">{e.applicationNumber}</p>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-[#1B4332]/10 px-2 py-0.5 text-xs font-medium text-[#1B4332]">
                          {classConfig?.label ?? e.classApplied ?? "—"}
                        </span>
                        {e.studentGender && (
                          <p className="mt-0.5 text-xs text-gray-400 capitalize">{e.studentGender.toLowerCase()}</p>
                        )}
                      </td>

                      {/* Branch / Cycle */}
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{e.branch.name}</p>
                        <p className="text-xs text-gray-400">{e.admissionCycle.name}</p>
                      </td>

                      {/* Parent */}
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{parentName}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{e.applicant.email}</p>
                        {e.applicant.phone && (
                          <p className="text-xs text-gray-400">{e.applicant.phone}</p>
                        )}
                      </td>

                      {/* Documents */}
                      <td className="px-4 py-3">
                        {e.documentsCount === 0 ? (
                          <span className="text-xs text-gray-400">None uploaded</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {docsComplete
                              ? <CheckCircle className="size-3.5 text-green-500 shrink-0" />
                              : <Clock className="size-3.5 text-amber-500 shrink-0" />}
                            <span className="text-xs text-gray-600">
                              {e.documentsVerified}/{e.documentsCount} verified
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Fee */}
                      <td className="px-4 py-3">
                        {e.admissionFee ? (
                          <div>
                            <p className="text-xs font-semibold text-green-700">{formatNaira(e.admissionFee.amountKobo)}</p>
                            <p className="text-xs text-gray-400">Confirmed</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Pending</span>
                        )}
                      </td>

                      {/* Enrolled date */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="size-3.5 text-green-500 shrink-0" />
                          <p className="text-xs text-gray-500">{formatDate(e.updatedAt)}</p>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/applications/${e.id}`}
                          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          View <ExternalLink className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {filtered.length} of {enrollments.length} enrolled student{enrollments.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
