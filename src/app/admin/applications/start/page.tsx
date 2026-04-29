"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminStartApplicationPage() {
  const router = useRouter();
  const [applicantEmail, setApplicantEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    const email = applicantEmail.trim();
    if (!email) {
      setError("Applicant email is required.");
      return;
    }

    setError(null);
    setCreating(true);

    // Jump straight into the exact same multi-step wizard used by the applicant.
    router.push(`/dashboard/applications/new?actingApplicantEmail=${encodeURIComponent(email)}`);
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Start Application for Applicant"
        description="Open the same application wizard used by the parent/applicant."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Applications", href: "/admin/applications" },
          { label: "Start for Applicant" },
        ]}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Applicant</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
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

          {error && <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button
              onClick={handleContinue}
              disabled={creating}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continue with Applicant Wizard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

