"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, FilePlus2, RefreshCw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminStartApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "new" ? "new" : "resume";

  const [applicantEmail, setApplicantEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // New application — go straight to the wizard without resuming a draft.
        // The wizard will create a fresh draft on step 1 completion.
        router.push(
          `/dashboard/applications/new?actingApplicantEmail=${encodeURIComponent(email)}`,
        );
        return;
      }

      // Resume mode — find the applicant's latest DRAFT or REVISION_REQUIRED application.
      const res = await fetch("/api/admin/applications/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantEmail: email }),
      });
      const json = await res.json();

      if (!res.ok || !json?.success) {
        setError(json?.error?.message ?? "Failed to find applicant application.");
        setLoading(false);
        return;
      }

      if (json.data?.applicationId) {
        router.push(
          `/dashboard/applications/new?resume=${encodeURIComponent(json.data.applicationId)}&actingApplicantEmail=${encodeURIComponent(email)}`,
        );
        return;
      }

      // No existing draft found — tell the admin to use "New Application" instead.
      setError(
        "No in-progress application found for this applicant. Use 'New Application' to start a fresh one.",
      );
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setLoading(false);
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
          {isNew && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Enter the applicant&apos;s registered email address. If they don&apos;t have an account yet,
              ask them to register first at the applicant portal.
            </div>
          )}

          {!isNew && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Enter the applicant&apos;s email to pick up their draft or revision-required application
              from where they left off.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Applicant Email</Label>
            <Input
              id="email"
              value={applicantEmail}
              onChange={(e) => {
                setApplicantEmail(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleContinue(); }}
              placeholder="parent@example.com"
              type="email"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              onClick={() => router.push("/admin/applications")}
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
