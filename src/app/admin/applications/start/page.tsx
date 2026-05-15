"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, FilePlus2, RefreshCw, CheckCircle2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProvisionStatus = "idle" | "provisioning" | "account_created" | "account_exists" | "resuming";

export default function AdminStartApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "new" ? "new" : "resume";

  const [applicantEmail, setApplicantEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisionStatus, setProvisionStatus] = useState<ProvisionStatus>("idle");

  const isNew = mode === "new";

  async function handleContinue() {
    const email = applicantEmail.trim();
    if (!email) {
      setError("Applicant email is required.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (isNew) {
        // Provision account if it doesn't exist, then open the wizard
        setProvisionStatus("provisioning");

        const res = await fetch("/api/admin/applications/provision-applicant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicantEmail: email }),
        });
        const json = await res.json();

        if (!res.ok || !json?.success) {
          setError(json?.error?.message ?? "Failed to create applicant account.");
          setProvisionStatus("idle");
          setLoading(false);
          return;
        }

        const wasCreated: boolean = json.data.created;
        setProvisionStatus(wasCreated ? "account_created" : "account_exists");

        // Brief pause so the admin can see the status, then go to the wizard
        await new Promise((r) => setTimeout(r, 1200));

        router.push(
          `/dashboard/applications/new?actingApplicantEmail=${encodeURIComponent(email)}`,
        );
        return;
      }

      // Resume mode — find the applicant's latest DRAFT or REVISION_REQUIRED application.
      setProvisionStatus("resuming");
      const res = await fetch("/api/admin/applications/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantEmail: email }),
      });
      const json = await res.json();

      if (!res.ok || !json?.success) {
        setError(json?.error?.message ?? "Failed to find applicant application.");
        setProvisionStatus("idle");
        setLoading(false);
        return;
      }

      if (json.data?.applicationId) {
        router.push(
          `/dashboard/applications/new?resume=${encodeURIComponent(json.data.applicationId)}&actingApplicantEmail=${encodeURIComponent(email)}`,
        );
        return;
      }

      setError(
        "No in-progress application found for this applicant. Use 'New Application' to start a fresh one.",
      );
      setProvisionStatus("idle");
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setProvisionStatus("idle");
      setLoading(false);
    }
  }

  function getStatusBanner() {
    switch (provisionStatus) {
      case "provisioning":
        return (
          <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Checking account and sending login credentials…
          </div>
        );
      case "account_created":
        return (
          <div className="flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Account created — login details sent to <strong className="ml-1">{applicantEmail}</strong>. Opening wizard…
          </div>
        );
      case "account_exists":
        return (
          <div className="flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Account found. Opening wizard…
          </div>
        );
      case "resuming":
        return (
          <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Looking up application…
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={isNew ? "New Application" : "Resume Application"}
        description={
          isNew
            ? "Start a brand-new application on behalf of a parent or applicant."
            : "Continue an in-progress application that was started by the applicant."
        }
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Applications", href: "/admin/applications" },
          { label: isNew ? "New Application" : "Resume Application" },
        ]}
      />

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            {isNew
              ? <FilePlus2 className="h-4 w-4 text-gray-400" />
              : <RefreshCw className="h-4 w-4 text-gray-400" />
            }
            <CardTitle className="text-base">
              {isNew ? "Applicant Details" : "Applicant"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">

          {isNew && provisionStatus === "idle" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Enter the applicant&apos;s email address. If they don&apos;t have an account yet,
              one will be <strong>created automatically</strong> and their login credentials will be
              emailed to them.
            </div>
          )}

          {!isNew && provisionStatus === "idle" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Enter the applicant&apos;s email to pick up their draft or revision-required application
              from where they left off.
            </div>
          )}

          {getStatusBanner()}

          <div className="space-y-2">
            <Label htmlFor="email">Applicant Email</Label>
            <Input
              id="email"
              value={applicantEmail}
              onChange={(e) => {
                setApplicantEmail(e.target.value);
                setError(null);
                setProvisionStatus("idle");
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && !loading) void handleContinue(); }}
              placeholder="parent@example.com"
              type="email"
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              onClick={() => router.push("/admin/applications")}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleContinue} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isNew ? "Start New Application" : "Resume Application"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
