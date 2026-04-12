"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, XCircle, RotateCcw, Clock, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ApplicationStatus } from "@prisma/client";

interface ReviewActionsProps {
  applicationId: string;
  currentStatus: ApplicationStatus;
  adminNotes?: string | null;
}

export default function ReviewActions({
  applicationId,
  currentStatus,
  adminNotes,
}: ReviewActionsProps) {
  const router = useRouter();

  // ── Approve state ──────────────────────────────────────────────────────
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState(adminNotes ?? "");
  const [approveLoading, setApproveLoading] = useState(false);

  // ── Reject state ───────────────────────────────────────────────────────
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  // ── Revision state ─────────────────────────────────────────────────────
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revisionLoading, setRevisionLoading] = useState(false);

  const anyLoading = approveLoading || rejectLoading || revisionLoading;

  // ── Handlers ───────────────────────────────────────────────────────────
  async function handleApprove() {
    setApproveLoading(true);
    try {
      const res = await fetch(
        `/api/admin/applications/${applicationId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminNotes: approveNotes || undefined }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? "Failed to approve");
      toast.success("Application approved successfully.");
      setApproveOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve application.");
    } finally {
      setApproveLoading(false);
    }
  }

  async function handleReject() {
    if (rejectReason.trim().length < 10) {
      toast.error("Please provide a rejection reason (minimum 10 characters).");
      return;
    }
    setRejectLoading(true);
    try {
      const res = await fetch(
        `/api/admin/applications/${applicationId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason: rejectReason }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? "Failed to reject");
      toast.success("Application rejected.");
      setRejectOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject application.");
    } finally {
      setRejectLoading(false);
    }
  }

  async function handleRevision() {
    setRevisionLoading(true);
    try {
      const res = await fetch(
        `/api/admin/applications/${applicationId}/revision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revisionFeedback: {},
            adminNotes: revisionNotes || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? "Failed to request revision");
      toast.success("Revision requested. Applicant has been notified.");
      setRevisionOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to request revision."
      );
    } finally {
      setRevisionLoading(false);
    }
  }

  // ── Status-specific UI helpers ─────────────────────────────────────────
  const canTakeAction =
    currentStatus === "SUBMITTED" || currentStatus === "UNDER_REVIEW";

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>Review Actions</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {/* ── Actionable states: SUBMITTED / UNDER_REVIEW ───────────────── */}
        {canTakeAction && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              This application is awaiting review. Choose an action below.
            </p>

            <div className="flex flex-wrap gap-3">
              {/* ── APPROVE ─────────────────────────────────────────────── */}
              <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
                  <button
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:pointer-events-none disabled:opacity-50"
                    disabled={anyLoading}
                    onClick={() => setApproveOpen(true)}
                  >
                    <CheckCircle className="size-4" />
                    Approve
                  </button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve Application</AlertDialogTitle>
                    <AlertDialogDescription>
                      The applicant will be notified that their application has
                      been approved and is eligible for exam scheduling.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="space-y-2">
                    <Label htmlFor="approve-notes">
                      Admin Notes{" "}
                      <span className="font-normal text-gray-400">
                        (optional)
                      </span>
                    </Label>
                    <Textarea
                      id="approve-notes"
                      placeholder="Any notes for internal use or to share with the applicant…"
                      value={approveNotes}
                      onChange={(e) => setApproveNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={approveLoading}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleApprove}
                      disabled={approveLoading}
                    >
                      {approveLoading ? "Approving…" : "Confirm Approval"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* ── REQUEST REVISION ──────────────────────────────────── */}
              <AlertDialog open={revisionOpen} onOpenChange={setRevisionOpen}>
                  <button
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-transparent bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-50"
                    disabled={anyLoading}
                    onClick={() => setRevisionOpen(true)}
                  >
                    <RotateCcw className="size-4" />
                    Request Revision
                  </button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Request Revision</AlertDialogTitle>
                    <AlertDialogDescription>
                      The applicant will be asked to review and resubmit their
                      application with the requested changes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="space-y-2">
                    <Label htmlFor="revision-notes">
                      Feedback for Applicant{" "}
                      <span className="font-normal text-gray-400">
                        (optional)
                      </span>
                    </Label>
                    <Textarea
                      id="revision-notes"
                      placeholder="Describe what the applicant needs to update or provide…"
                      value={revisionNotes}
                      onChange={(e) => setRevisionNotes(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={revisionLoading}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleRevision}
                      disabled={revisionLoading}
                    >
                      {revisionLoading ? "Sending…" : "Request Revision"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* ── REJECT ──────────────────────────────────────────────── */}
              <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
                  <button
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
                    disabled={anyLoading}
                    onClick={() => setRejectOpen(true)}
                  >
                    <XCircle className="size-4" />
                    Reject
                  </button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject Application</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action is not easily reversible. Please provide a
                      clear reason for the rejection.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="space-y-2">
                    <Label htmlFor="reject-reason">
                      Rejection Reason{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="reject-reason"
                      placeholder="Minimum 10 characters. The reason will be visible to the applicant."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={4}
                      aria-invalid={rejectReason.length > 0 && rejectReason.length < 10}
                    />
                    {rejectReason.length > 0 && rejectReason.length < 10 && (
                      <p className="text-xs text-red-500">
                        Reason must be at least 10 characters.
                      </p>
                    )}
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={rejectLoading}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleReject}
                      disabled={rejectLoading || rejectReason.trim().length < 10}
                    >
                      {rejectLoading ? "Rejecting…" : "Confirm Rejection"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {/* ── APPROVED ──────────────────────────────────────────────────── */}
        {currentStatus === "APPROVED" && (
          <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4">
            <CalendarDays className="mt-0.5 size-5 shrink-0 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Application Approved</p>
              <p className="mt-1 text-sm text-green-700">
                This application has been approved. Exam scheduling is coming
                soon — you will be able to assign this applicant to an exam
                session from the Exams module.
              </p>
            </div>
          </div>
        )}

        {/* ── EXAM_SCHEDULED / EXAM_COMPLETED / ADMITTED / ENROLLED ──────── */}
        {(currentStatus === "EXAM_SCHEDULED" ||
          currentStatus === "EXAM_COMPLETED" ||
          currentStatus === "ADMITTED" ||
          currentStatus === "ENROLLED") && (
          <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
            <CheckCircle className="mt-0.5 size-5 shrink-0 text-blue-600" />
            <div>
              <p className="font-medium text-blue-800">
                Application in Progress
              </p>
              <p className="mt-1 text-sm text-blue-700">
                This application is currently at the{" "}
                <strong>{currentStatus.replace(/_/g, " ")}</strong> stage.
                Further actions are managed through the Exams and Admissions
                modules.
              </p>
            </div>
          </div>
        )}

        {/* ── REJECTED ──────────────────────────────────────────────────── */}
        {currentStatus === "REJECTED" && (
          <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4">
            <XCircle className="mt-0.5 size-5 shrink-0 text-red-500" />
            <div>
              <p className="font-medium text-red-800">Application Rejected</p>
              <p className="mt-1 text-sm text-red-700">
                This application has been rejected. No further actions are
                available. The applicant may appeal through the standard
                process.
              </p>
            </div>
          </div>
        )}

        {/* ── NOT_ADMITTED ────────────────────────────────────────────────── */}
        {currentStatus === "NOT_ADMITTED" && (
          <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4">
            <XCircle className="mt-0.5 size-5 shrink-0 text-red-500" />
            <div>
              <p className="font-medium text-red-800">Not Admitted</p>
              <p className="mt-1 text-sm text-red-700">
                The student was not admitted after examination. This is a
                terminal state.
              </p>
            </div>
          </div>
        )}

        {/* ── REVISION_REQUIRED ────────────────────────────────────────── */}
        {currentStatus === "REVISION_REQUIRED" && (
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4">
            <Clock className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Awaiting Resubmission</p>
              <p className="mt-1 text-sm text-amber-700">
                A revision has been requested. Waiting for the applicant to
                address the feedback and resubmit their application.
              </p>
            </div>
          </div>
        )}

        {/* ── DRAFT ──────────────────────────────────────────────────────── */}
        {currentStatus === "DRAFT" && (
          <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-4">
            <Clock className="mt-0.5 size-5 shrink-0 text-gray-400" />
            <div>
              <p className="font-medium text-gray-700">Draft Application</p>
              <p className="mt-1 text-sm text-gray-500">
                This application has not been submitted yet. No review actions
                are available.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
