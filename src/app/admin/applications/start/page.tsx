"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, Copy, CheckCircle2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";

type Branch = { id: string; name: string; address: string; hasTemplate: boolean };
type Cycle = { id: string; name: string; academicYear: string };
type BranchTemplate = {
  id: string;
  name: string;
  classLevels: string[];
  resolvedAdmissionCycleId: string | null;
};

const ALL_CLASSES = Object.keys(CLASS_LEVEL_CONFIG) as Array<keyof typeof CLASS_LEVEL_CONFIG>;

export default function AdminStartApplicationPage() {
  const [applicantEmail, setApplicantEmail] = useState("");
  const [branchId, setBranchId] = useState<string>("");
  const [classApplied, setClassApplied] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | {
    applicationNumber: string;
    resumeUrl: string;
    applicantName: string;
  }>(null);
  const [copied, setCopied] = useState(false);

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to load branches");
      const json = await res.json();
      return json.data as { branches: Branch[]; cycles: Cycle[] };
    },
  });

  const branches = (branchesData?.branches ?? []).filter((b) => b.hasTemplate);

  const {
    data: templateData,
    isLoading: templateLoading,
    isError: templateError,
    error: templateErrorValue,
  } = useQuery({
    queryKey: ["application-template", branchId],
    queryFn: async () => {
      const res = await fetch(`/api/applications/template?branchId=${branchId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to load application template");
      return json.data as { template: BranchTemplate };
    },
    enabled: Boolean(branchId),
  });

  const template = templateData?.template ?? null;
  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;
  const selectedClassLabel = classApplied
    ? CLASS_LEVEL_CONFIG[classApplied as keyof typeof CLASS_LEVEL_CONFIG]?.label
    : "";

  const availableClasses = useMemo(() => {
    if (!template) return [];
    if (!template.classLevels?.length) return ALL_CLASSES;
    const allowed = new Set(template.classLevels);
    return ALL_CLASSES.filter((c) => allowed.has(c));
  }, [template]);

  async function copyResumeLink() {
    if (!result?.resumeUrl) return;
    await navigator.clipboard.writeText(result.resumeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    setResult(null);
    try {
      if (!applicantEmail) throw new Error("Applicant email is required.");
      if (!branchId) throw new Error("Branch is required.");
      if (!classApplied) throw new Error("Class applied is required.");
      if (!template?.id) throw new Error("No published template found for this branch.");

      const res = await fetch("/api/admin/applications/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantEmail,
          templateId: template.id,
          branchId,
          admissionCycleId: template.resolvedAdmissionCycleId ?? undefined,
          classApplied,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? "Failed to start application");

      setResult({
        applicationNumber: json.data.application.applicationNumber as string,
        resumeUrl: json.data.resumeUrl as string,
        applicantName: (json.data.applicant.name as string) || applicantEmail,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start application");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Start Application for Applicant"
        description="Create a draft application on behalf of a parent/guardian and share the resume link."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Applications", href: "/admin/applications" },
          { label: "Start for Applicant" },
        ]}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Applicant & Enrollment</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Applicant Email</Label>
            <Input
              id="email"
              value={applicantEmail}
              onChange={(e) => setApplicantEmail(e.target.value)}
              placeholder="parent@example.com"
              type="email"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Branch</Label>
              {branchesLoading ? (
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading branches…
                </div>
              ) : (
                <Select
                  value={branchId}
                  onValueChange={(v) => {
                    setBranchId(v ?? "");
                    setClassApplied("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={branches.length ? "Select branch" : "No branches with templates"}>
                      {selectedBranch?.name ?? ""}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Class Applied</Label>
              {branchId && templateLoading ? (
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading template…
                </div>
              ) : branchId && templateError ? (
                <div className="text-sm text-red-600">
                  {(templateErrorValue as Error)?.message ?? "Failed to load template for selected branch."}
                </div>
              ) : (
                <Select
                  value={classApplied}
                  onValueChange={(v) => setClassApplied(v ?? "")}
                  disabled={!template}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={template ? "Select class" : "Select branch first"}>
                      {selectedClassLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CLASS_LEVEL_CONFIG[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3">
            <Link href="/admin/applications" className="text-sm text-gray-500 hover:underline self-center">
              Cancel
            </Link>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Start Application
            </Button>
          </div>

          {result && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                Draft created for {result.applicantName}
              </p>
              <p className="text-sm text-green-800">
                Application #: <span className="font-mono font-semibold">{result.applicationNumber}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-white/70 border px-2 py-1 text-xs break-all">{result.resumeUrl}</code>
                <Button variant="outline" size="sm" onClick={copyResumeLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
              <p className="text-xs text-green-700">
                Send this link to the parent/applicant. After they log in, it will open their draft and they can continue.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

