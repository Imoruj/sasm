"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, XCircle, RotateCcw, Clock, CalendarDays, FileImage, ExternalLink, GraduationCap, CreditCard, UploadCloud } from "lucide-react";
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

interface PendingAdmissionTransfer {
  paymentId: string;
  receiptUrl: string;
}

interface ReviewActionsProps {
  applicationId: string;
  currentStatus: ApplicationStatus;
  adminNotes?: string | null;
  paymentEvidenceUrl?: string | null;
  acceptancePaid?: boolean;
  documentsCount?: number;
  pendingAdmissionTransfer?: PendingAdmissionTransfer | null;
}

export default function ReviewActions({
  applicationId,
  currentStatus,
  adminNotes,
  paymentEvidenceUrl,
  acceptancePaid = false,
  documentsCount = 0,
  pendingAdmissionTransfer = null,
}: ReviewActionsProps) {
  const router = useRouter();

  // ── Enroll state ───────────────────────────────────────────────────────
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);

  // ── Confirm admission transfer state ───────────────────────────────────
  const [confirmTransferOpen, setConfirmTransferOpen] = useState(false);
  const [confirmTransferLoading, setConfirmTransferLoading] = useState(false);

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

  async function handleEnroll() {
    setEnrollLoading(true);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/enroll`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? "Failed to enroll");
      toast.success("Student enrolled successfully.");
      setEnrollOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enroll student.");
    } finally {
      setEnrollLoading(false);
    }
  }

  async function handleConfirmTransfer(action: "approve" | "reject" = "approve") {
    setConfirmTransferLoading(true);
    try {
      const res = await fetch(
        `/api/admin/applications/${applicationId}/confirm-admission-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? "Failed to confirm payment");
      toast.success(
        action === "approve"
          ? "Admission payment confirmed successfully."
          : "Payment evidence rejected. The parent may re-upload.",
      );
      setConfirmTransferOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process payment.");
    } finally {
      setConfirmTransferLoading(false);
    }
  }

  const anyLoading = approveLoading || rejectLoading || revisionLoading || enrollLoading || confirmTransferLoading;

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

  const isImage = paymentEvidenceUrl && /\.(jpe?g|png|webp)(\?|$)/i.test(paymentEvidenceUrl);

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>Review Actions</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {/* ── Payment evidence preview (shown when in UNDER_REVIEW with evidence) ── */}
        {currentStatus === "UNDER_REVIEW" && paymentEvidenceUrl && (
          <div className="mb-5 space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <Clock className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <div>
                <p className="font-medium text-amber-800">Payment Evidence Uploaded — Review Pending</p>
                <p className="mt-1 text-sm text-amber-700">
                  The applicant has submitted payment proof. Verify the receipt below, then approve or reject the application.
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment Receipt</p>
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={paymentEvidenceUrl}
                  alt="Payment evidence"
                  className="max-h-72 w-full rounded-md border object-contain"
                />
              ) : (
                <a
                  href={paymentEvidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-primary hover:bg-primary/5"
                >
                  <FileImage className="size-4" />
                  View Uploaded Document
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Actionable states: SUBMITTED / UNDER_REVIEW ───────────────── */}
        {canTakeAction && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {currentStatus === "UNDER_REVIEW"
                ? "After reviewing the payment evidence above, choose an action."
                : "This application is awaiting review. Choose an action below."}
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

        {/* ── EXAM_SCHEDULED / EXAM_COMPLETED ───────────────────────────── */}
        {(currentStatus === "EXAM_SCHEDULED" || currentStatus === "EXAM_COMPLETED") && (
          <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
            <CheckCircle className="mt-0.5 size-5 shrink-0 text-blue-600" />
            <div>
              <p className="font-medium text-blue-800">
                {currentStatus === "EXAM_SCHEDULED" ? "Exam Scheduled" : "Exam Completed — Awaiting Result Entry"}
              </p>
              <p className="mt-1 text-sm text-blue-700">
                {currentStatus === "EXAM_SCHEDULED"
                  ? "The applicant has been booked for an exam. Manage results via the Results module."
                  : "The exam is complete. Go to the Results module to enter and publish the candidate's score."}
              </p>
            </div>
          </div>
        )}

        {/* ── ADMITTED — Enrolment action ────────────────────────────────── */}
        {currentStatus === "ADMITTED" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-[#1B4332]/20 bg-[#1B4332]/5 p-4">
              <GraduationCap className="mt-0.5 size-5 shrink-0 text-[#1B4332]" />
              <div>
                <p className="font-medium text-[#1B4332]">Admission Offered</p>
                <p className="mt-1 text-sm text-gray-700">
                  The student passed the entrance exam and has been offered admission.
                  Enrol once the acceptance fee is paid and required documents are uploaded.
                </p>
              </div>
            </div>

            {/* Pre-enrolment checklist */}
            <div className="space-y-2 text-sm">
              <div className={`flex items-center gap-2 ${acceptancePaid ? "text-green-700" : "text-gray-500"}`}>
                <CreditCard className="h-4 w-4 shrink-0" />
                {acceptancePaid ? "Acceptance fee paid" : "Acceptance fee not yet paid"}
              </div>
              <div className={`flex items-center gap-2 ${documentsCount > 0 ? "text-green-700" : "text-gray-500"}`}>
                <UploadCloud className="h-4 w-4 shrink-0" />
                {documentsCount > 0
                  ? `${documentsCount} document${documentsCount > 1 ? "s" : ""} uploaded`
                  : "No documents uploaded yet"}
              </div>
            </div>

            {/* Bank transfer confirmation — shown when receipt uploaded but not yet confirmed */}
            {!acceptancePaid && pendingAdmissionTransfer?.receiptUrl && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                <p className="text-sm font-medium text-amber-800">
                  Bank Transfer Receipt Uploaded — Awaiting Confirmation
                </p>
                <p className="text-xs text-amber-700">
                  The parent has uploaded payment evidence for the admission acceptance fee.
                  Review the receipt below and confirm if valid.
                </p>
                {/\.(jpe?g|png|webp)(\?|$)/i.test(pendingAdmissionTransfer.receiptUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingAdmissionTransfer.receiptUrl}
                    alt="Admission payment receipt"
                    className="max-h-56 w-full rounded-md border object-contain"
                  />
                ) : (
                  <a
                    href={pendingAdmissionTransfer.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-primary hover:bg-primary/5"
                  >
                    <FileImage className="size-4" />
                    View Receipt Document
                    <ExternalLink className="size-3.5" />
                  </a>
                )}

                <AlertDialog open={confirmTransferOpen} onOpenChange={setConfirmTransferOpen}>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none"
                    disabled={anyLoading}
                    onClick={() => setConfirmTransferOpen(true)}
                  >
                    <CreditCard className="size-4" />
                    Confirm Payment Received
                  </button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Admission Payment</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark the admission acceptance fee as <strong>PAID</strong> and
                        unlock enrolment. Only confirm if you have verified the bank transfer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={confirmTransferLoading}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleConfirmTransfer("approve")}
                        disabled={confirmTransferLoading}
                      >
                        {confirmTransferLoading ? "Confirming…" : "Yes, Confirm Payment"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Enroll action */}
            <AlertDialog open={enrollOpen} onOpenChange={setEnrollOpen}>
              <button
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-transparent bg-[#1B4332] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1B4332]/90 disabled:pointer-events-none disabled:opacity-50"
                disabled={anyLoading || !acceptancePaid}
                onClick={() => setEnrollOpen(true)}
                title={!acceptancePaid ? "Cannot enrol — acceptance fee not yet paid" : undefined}
              >
                <GraduationCap className="size-4" />
                Enrol Student
              </button>
              {!acceptancePaid && (
                <p className="text-xs text-amber-600">
                  Enrolment is locked until the acceptance fee is paid by the parent.
                </p>
              )}

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Enrolment</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the student as <strong>ENROLLED</strong> and notify the
                    parent/guardian. This action confirms the student&apos;s place at the school.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={enrollLoading}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                    onClick={handleEnroll}
                    disabled={enrollLoading}
                  >
                    {enrollLoading ? "Enrolling…" : "Yes, Enrol Student"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* ── ENROLLED ──────────────────────────────────────────────────── */}
        {currentStatus === "ENROLLED" && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
            <GraduationCap className="mt-0.5 size-5 shrink-0 text-green-700" />
            <div>
              <p className="font-medium text-green-800">Student Enrolled</p>
              <p className="mt-1 text-sm text-green-700">
                This student has been officially enrolled. No further admission actions are required.
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
              <p className="font-medium text-gray-700">Awaiting Payment Evidence</p>
              <p className="mt-1 text-sm text-gray-500">
                The applicant has not yet uploaded payment evidence. The application will enter review automatically once they do.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
