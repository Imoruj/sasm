"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  ExternalLink,
  FileImage,
  FileText,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { cn, formatDate } from "@/lib/utils";
import type { ExamBookingStatus, ExamSessionStatus } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DocumentData {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  isVerified: boolean;
  verificationNote: string | null;
}

interface ExamResultData {
  id: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: string | null;
  scoreBreakdown: Record<string, number> | null | unknown;
  isPassed: boolean;
  isPublished: boolean;
  publishedAt: Date | string | null;
  remarks: string | null;
}

interface PendingAdmissionTransfer {
  paymentId: string;
  receiptUrl: string;
}

interface BookingData {
  id: string;
  status: ExamBookingStatus;
  application: {
    id: string;
    applicationNumber: string;
    studentFirstName: string | null;
    studentLastName: string | null;
    classApplied: string;
    status: string;
    acceptancePaid: boolean;
    allDocsVerified: boolean;
    documentsCount: number;
    documents: DocumentData[];
    pendingAdmissionTransfer: PendingAdmissionTransfer | null;
  };
  result: ExamResultData | null;
}

interface ExamSessionData {
  id: string;
  title: string;
  examDate: Date | string;
  startTime: string;
  endTime: string;
  status: ExamSessionStatus;
  branch: { name: string };
  admissionCycle: { name: string; academicYear: string };
  bookings: BookingData[];
}

interface Props {
  examSessions: ExamSessionData[];
}

// ─── Zod Schema ──────────────────────────────────────────────────────────────
const subjectSchema = z.object({
  subject: z.string().min(1, "Subject name required"),
  score: z.coerce.number().min(0, "Score must be ≥ 0"),
});

const resultFormSchema = z.object({
  subjects: z.array(subjectSchema).min(1, "Add at least one subject"),
  maxScorePerSubject: z.coerce.number().min(1, "Max score per subject must be ≥ 1"),
  isPassed: z.boolean(),
  remarks: z.string().max(1000).optional(),
});

type ResultFormValues = z.infer<typeof resultFormSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SESSION_STATUS_CONFIG: Record<ExamSessionStatus, { label: string; cls: string }> = {
  SCHEDULED: { label: "Scheduled", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", cls: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700 border-red-200" },
};

function gradeColor(pct: number) {
  if (pct >= 75) return "text-green-700 bg-green-50 border-green-200";
  if (pct >= 60) return "text-blue-700 bg-blue-50 border-blue-200";
  if (pct >= 45) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

// ─── DocUnavailable fallback ─────────────────────────────────────────────────
function DocUnavailable({ url, name }: { url: string; name: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center px-8 bg-gray-50 min-h-0">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-red-100">
        <FileText className="size-7 text-red-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700 truncate max-w-xs">{name}</p>
        <p className="mt-1.5 text-sm text-gray-400">
          This file cannot be previewed here. Open it directly in your browser.
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-[#1B4332] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1B4332]/90 transition-colors shadow-sm"
      >
        <ExternalLink className="size-4" /> Open in browser
      </a>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ExamResultsManager({ examSessions }: Props) {
  const router = useRouter();
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    () => new Set(examSessions.length === 1 ? [examSessions[0].id] : []),
  );
  const [entryOpen, setEntryOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [reviewPaymentOpen, setReviewPaymentOpen] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Always derived from the latest examSessions prop so dialog reflects fresh server data after router.refresh()
  const activeBooking = useMemo<BookingData | null>(() => {
    if (!activeBookingId) return null;
    for (const session of examSessions) {
      const found = session.bookings.find((b) => b.id === activeBookingId);
      if (found) return found;
    }
    return null;
  }, [activeBookingId, examSessions]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentActionLoading, setPaymentActionLoading] = useState(false);
  const [reviewDocsOpen, setReviewDocsOpen] = useState(false);
  const [docActionLoading, setDocActionLoading] = useState<string | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [previewDoc, setPreviewDoc] = useState<DocumentData | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  // Reset PDF error state whenever a new document is selected for preview
  useEffect(() => { setPdfError(false); }, [previewDoc?.id]);

  const form = useForm<ResultFormValues>({
    resolver: zodResolver(resultFormSchema),
    defaultValues: {
      subjects: [{ subject: "Mathematics", score: 0 }, { subject: "English", score: 0 }],
      maxScorePerSubject: 100,
      isPassed: false,
      remarks: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "subjects" });
  const watchedSubjects = form.watch("subjects");
  const watchedMax = form.watch("maxScorePerSubject");
  const computedTotal = watchedSubjects.reduce((s, f) => s + (Number(f.score) || 0), 0);
  const computedMax = (watchedMax || 0) * watchedSubjects.length;
  const computedPct = computedMax > 0 ? ((computedTotal / computedMax) * 100).toFixed(1) : "0.0";

  function toggleSession(id: string) {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleEnroll(applicationId: string) {
    setEnrollingId(applicationId);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/enroll`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Failed to enroll student.");
        return;
      }
      toast.success("Student enrolled successfully!");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setEnrollingId(null);
    }
  }

  function openEntryDialog(booking: BookingData, sessionId: string) {
    setActiveBookingId(booking.id);
    setActiveSessionId(sessionId);

    // Pre-populate if existing result
    if (booking.result) {
      const breakdown = booking.result.scoreBreakdown as Record<string, number>;
      const subjects = Object.entries(breakdown).map(([subject, score]) => ({ subject, score }));
      const maxPerSubject = Number(booking.result.maxScore) / Math.max(subjects.length, 1);
      form.reset({
        subjects: subjects.length > 0 ? subjects : [{ subject: "Mathematics", score: 0 }],
        maxScorePerSubject: Math.round(maxPerSubject),
        isPassed: booking.result.isPassed,
        remarks: booking.result.remarks ?? "",
      });
    } else {
      form.reset({
        subjects: [{ subject: "Mathematics", score: 0 }, { subject: "English", score: 0 }],
        maxScorePerSubject: 100,
        isPassed: false,
        remarks: "",
      });
    }
    setEntryOpen(true);
  }

  async function onSubmitResult(values: ResultFormValues) {
    if (!activeBooking || !activeSessionId) return;
    setIsSubmitting(true);
    try {
      const scoreBreakdown: Record<string, number> = {};
      values.subjects.forEach(({ subject, score }) => { scoreBreakdown[subject] = Number(score); });
      const totalScore = values.subjects.reduce((s, f) => s + Number(f.score), 0);
      const maxScore = values.maxScorePerSubject * values.subjects.length;

      const res = await fetch("/api/admin/exam-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examBookingId: activeBooking.id,
          applicationId: activeBooking.application.id,
          scoreBreakdown,
          totalScore,
          maxScore,
          isPassed: values.isPassed,
          remarks: values.remarks,
        }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.error?.message ?? "Failed to save result"); return; }

      toast.success("Result saved successfully");
      setEntryOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openPublishConfirm(booking: BookingData, sessionId: string) {
    setActiveBookingId(booking.id);
    setActiveSessionId(sessionId);
    setPublishConfirmOpen(true);
  }

  async function handlePublish() {
    if (!activeBooking?.result) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/exam-results/${activeBooking.result.id}/publish`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.error?.message ?? "Failed to publish result"); return; }
      toast.success("Result published — applicant has been notified");
      setPublishConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePaymentAction(action: "approve" | "reject") {
    if (!activeBooking) return;
    setPaymentActionLoading(true);
    try {
      const res = await fetch(
        `/api/admin/applications/${activeBooking.application.id}/confirm-admission-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Action failed. Please try again.");
        return;
      }
      toast.success(
        action === "approve"
          ? "Payment confirmed — acceptance fee marked as paid."
          : "Evidence rejected — the applicant can re-upload their receipt.",
      );
      setReviewPaymentOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPaymentActionLoading(false);
    }
  }

  async function handleDocAction(docId: string, action: "approve" | "reject", note?: string) {
    if (!activeBooking) return;
    setDocActionLoading(docId);
    try {
      const res = await fetch(
        `/api/admin/applications/${activeBooking.application.id}/documents/${docId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, note }),
        },
      );
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Action failed. Please try again.");
        return;
      }
      if (json.data?.enrolled) {
        toast.success("All documents verified — student has been admitted!");
        setReviewDocsOpen(false);
      } else {
        toast.success(action === "approve" ? "Document approved." : "Document rejected.");
      }
      setRejectingDocId(null);
      setRejectNote("");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDocActionLoading(null);
    }
  }

  if (examSessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 py-20 text-center">
        <ClipboardList className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">No exam sessions found</p>
        <p className="mt-1 text-xs text-gray-400">Exam sessions will appear here once created.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {examSessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
          const graded = session.bookings.filter((b) => b.result).length;
          const published = session.bookings.filter((b) => b.result?.isPublished).length;
          const total = session.bookings.length;
          const statusCfg = SESSION_STATUS_CONFIG[session.status];

          return (
            <Card key={session.id} className="overflow-hidden">
              {/* Session header — click to expand */}
              <CardHeader
                className="cursor-pointer select-none pb-3"
                onClick={() => toggleSession(session.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold text-gray-900 truncate">
                        {session.title}
                      </CardTitle>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {session.branch.name} · {session.admissionCycle.academicYear} · {formatDate(session.examDate)} · {session.startTime}–{session.endTime}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", statusCfg.cls)}>
                      {statusCfg.label}
                    </span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {graded}/{total} graded · {published} published
                    </span>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <Separator className="mb-4" />

                  {total === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-400">No candidates booked for this session.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                            <th className="pb-2 pr-4 text-left">Candidate</th>
                            <th className="pb-2 pr-4 text-left">App No.</th>
                            <th className="pb-2 pr-4 text-left">Class</th>
                            <th className="pb-2 pr-4 text-center">Score</th>
                            <th className="pb-2 pr-4 text-center">Result</th>
                            <th className="pb-2 pr-4 text-center">Status</th>
                            <th className="pb-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {session.bookings.map((booking) => {
                            const result = booking.result;
                            const pct = result ? Number(result.percentage) : null;
                            const app = booking.application;

                            return (
                              <tr key={booking.id} className="group">
                                <td className="py-3 pr-4 font-medium text-gray-900">
                                  {app.studentFirstName
                                    ? `${app.studentFirstName} ${app.studentLastName ?? ""}`
                                    : "—"}
                                </td>
                                <td className="py-3 pr-4 font-mono text-xs text-gray-500">
                                  {app.applicationNumber}
                                </td>
                                <td className="py-3 pr-4 text-gray-600">{app.classApplied}</td>
                                <td className="py-3 pr-4 text-center tabular-nums">
                                  {result
                                    ? `${Number(result.totalScore).toFixed(0)}/${Number(result.maxScore).toFixed(0)}`
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="py-3 pr-4 text-center">
                                  {result ? (
                                    <span className={cn(
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                                      gradeColor(pct!)
                                    )}>
                                      {pct!.toFixed(1)}% · {result.grade ?? "—"}
                                    </span>
                                  ) : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="py-3 pr-4 text-center">
                                  {result?.isPublished ? (
                                    result.isPassed ? (
                                      app.status === "ENROLLED" ? (
                                        <Badge className="bg-[#1B4332]/10 text-[#1B4332] border-[#1B4332]/20 text-xs">
                                          Admitted
                                        </Badge>
                                      ) : app.acceptancePaid ? (
                                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                                          Docs Pending Review
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                                          Offer Extended
                                        </Badge>
                                      )
                                    ) : (
                                      <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                                        Not Admitted
                                      </Badge>
                                    )
                                  ) : result ? (
                                    <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">
                                      Graded — Unpublished
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">
                                      Not Graded
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {/* Enter / edit result */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => openEntryDialog(booking, session.id)}
                                      disabled={result?.isPublished}
                                      title={result?.isPublished ? "Result published — cannot edit" : result ? "Edit result" : "Enter result"}
                                    >
                                      {result ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                      <span className="ml-1">{result ? "Edit" : "Enter"}</span>
                                    </Button>

                                    {/* Publish */}
                                    {result && !result.isPublished && (
                                      <Button
                                        size="sm"
                                        className="h-7 px-2 text-xs bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                                        onClick={() => openPublishConfirm(booking, session.id)}
                                      >
                                        <Send className="h-3 w-3 mr-1" />
                                        Publish
                                      </Button>
                                    )}

                                    {/* Review payment evidence — shown when receipt uploaded but not yet confirmed */}
                                    {result?.isPublished && result.isPassed && !app.acceptancePaid && app.pendingAdmissionTransfer && (
                                      <Button
                                        size="sm"
                                        className="h-7 px-2 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                        onClick={() => {
                                          setActiveBookingId(booking.id);
                                          setActiveSessionId(session.id);
                                          setReviewPaymentOpen(true);
                                        }}
                                        title="Review payment evidence"
                                      >
                                        <ShieldCheck className="h-3 w-3 mr-1" />
                                        Review
                                      </Button>
                                    )}

                                    {/* Review uploaded documents — shown when fee is paid and docs exist but not all verified */}
                                    {result?.isPublished && result.isPassed && app.acceptancePaid && app.documentsCount > 0 && !app.allDocsVerified && app.status !== "ENROLLED" && (
                                      <Button
                                        size="sm"
                                        className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                        onClick={() => {
                                          setActiveBookingId(booking.id);
                                          setActiveSessionId(session.id);
                                          setRejectingDocId(null);
                                          setRejectNote("");
                                          setReviewDocsOpen(true);
                                        }}
                                        title="Review uploaded documents"
                                      >
                                        <ShieldCheck className="h-3 w-3 mr-1" />
                                        Docs
                                      </Button>
                                    )}

                                    {/* Enroll — shown when fee paid + all docs verified but not yet enrolled */}
                                    {result?.isPublished && result.isPassed && app.acceptancePaid && app.allDocsVerified && app.status !== "ENROLLED" && (
                                      <Button
                                        size="sm"
                                        className="h-7 px-2 text-xs bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                                        disabled={enrollingId === app.id}
                                        onClick={() => handleEnroll(app.id)}
                                        title="Enroll student"
                                      >
                                        {enrollingId === app.id ? (
                                          <><CheckCircle className="h-3 w-3 mr-1 animate-pulse" />Enrolling…</>
                                        ) : (
                                          <><CheckCircle className="h-3 w-3 mr-1" />Enroll</>
                                        )}
                                      </Button>
                                    )}

                                    {/* View application */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => window.open(`/admin/applications/${app.id}`, "_blank")}
                                      title="View full application"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* ─── Result Entry Dialog ─────────────────────────────────────────────── */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeBooking?.result ? "Edit Exam Result" : "Enter Exam Result"}
            </DialogTitle>
            {activeBooking && (
              <p className="text-sm text-gray-500 mt-1">
                {activeBooking.application.studentFirstName
                  ? `${activeBooking.application.studentFirstName} ${activeBooking.application.studentLastName ?? ""}`
                  : activeBooking.application.applicationNumber}
                {" · "}
                {activeBooking.application.classApplied}
              </p>
            )}
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmitResult)} className="space-y-5">
            {/* Max score per subject */}
            <div className="space-y-1.5">
              <Label>Max Score Per Subject <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={1}
                max={1000}
                {...form.register("maxScorePerSubject")}
              />
              {form.formState.errors.maxScorePerSubject && (
                <p className="text-xs text-red-500">{form.formState.errors.maxScorePerSubject.message}</p>
              )}
            </div>

            {/* Subject scores */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Subject Scores <span className="text-red-500">*</span></Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => append({ subject: "", score: 0 })}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Subject
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      placeholder="Subject name"
                      className="flex-1 h-8 text-sm bg-white"
                      {...form.register(`subjects.${index}.subject`)}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={watchedMax || 100}
                      placeholder="Score"
                      className="w-24 h-8 text-sm bg-white text-center"
                      {...form.register(`subjects.${index}.score`)}
                    />
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {form.formState.errors.subjects && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.subjects.message ??
                    form.formState.errors.subjects.root?.message}
                </p>
              )}
            </div>

            {/* Live score summary */}
            <div className={cn(
              "rounded-lg border p-4 text-center",
              gradeColor(Number(computedPct)),
            )}>
              <p className="text-3xl font-bold tabular-nums">{computedPct}%</p>
              <p className="text-sm mt-1 font-medium">
                {computedTotal} / {computedMax} total marks
              </p>
            </div>

            {/* Pass / Fail toggle */}
            <div className="space-y-1.5">
              <Label>Outcome <span className="text-red-500">*</span></Label>
              <div className="flex gap-2">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => form.setValue("isPassed", val)}
                    className={cn(
                      "flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-colors",
                      form.watch("isPassed") === val
                        ? val
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-red-600 bg-red-600 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                    )}
                  >
                    {val ? "PASSED" : "NOT PASSED"}
                  </button>
                ))}
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <Label>Remarks <span className="text-gray-400 text-xs">(optional)</span></Label>
              <Textarea
                {...form.register("remarks")}
                placeholder="Additional comments for this candidate…"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEntryOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
              >
                {isSubmitting ? "Saving…" : "Save Result"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Review Payment Evidence Dialog ─────────────────────────────────── */}
      <Dialog open={reviewPaymentOpen} onOpenChange={setReviewPaymentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Acceptance Fee Payment</DialogTitle>
            {activeBooking && (
              <p className="text-sm text-gray-500 mt-1">
                {activeBooking.application.studentFirstName
                  ? `${activeBooking.application.studentFirstName} ${activeBooking.application.studentLastName ?? ""}`
                  : activeBooking.application.applicationNumber}
                {" · "}{activeBooking.application.applicationNumber}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The parent has uploaded payment evidence for the admission acceptance fee.
              Review the receipt below and either confirm or reject it.
            </p>

            {/* Receipt preview */}
            {activeBooking?.application.pendingAdmissionTransfer?.receiptUrl && (
              <div className="rounded-lg border overflow-hidden">
                {/\.(jpe?g|png|webp)(\?|$)/i.test(
                  activeBooking.application.pendingAdmissionTransfer.receiptUrl,
                ) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeBooking.application.pendingAdmissionTransfer.receiptUrl}
                    alt="Payment receipt"
                    className="w-full max-h-72 object-contain bg-gray-50"
                  />
                ) : (
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileImage className="size-4" />
                      Payment receipt document
                    </div>
                    <a
                      href={activeBooking.application.pendingAdmissionTransfer.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                    >
                      Open
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Guidance note */}
            <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              <strong>If you confirm:</strong> The acceptance fee is marked as paid and the Enrol button unlocks on the application.<br />
              <strong>If you reject:</strong> The receipt is cleared and the parent is able to re-upload a correct one.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setReviewPaymentOpen(false)}
              disabled={paymentActionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
              onClick={() => handlePaymentAction("reject")}
              disabled={paymentActionLoading}
            >
              {paymentActionLoading ? "Processing…" : "Reject Evidence"}
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handlePaymentAction("approve")}
              disabled={paymentActionLoading}
            >
              {paymentActionLoading ? "Processing…" : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Document Review Overlay (fixed, bypasses DialogContent constraints) ── */}
      {reviewDocsOpen && (() => {
        const docs = activeBooking?.application.documents ?? [];
        const approved = docs.filter((d) => d.isVerified).length;
        const rejected = docs.filter((d) => !d.isVerified && !!d.verificationNote).length;
        const pending  = docs.filter((d) => !d.isVerified && !d.verificationNote).length;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
            <div
              className="relative flex flex-col w-full rounded-2xl bg-white shadow-2xl overflow-hidden"
              style={{ maxWidth: 1100, height: "88vh" }}
            >
              {/* ── Header ─────────────────────────────────────────── */}
              <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 shrink-0 bg-white">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#1B4332]/10">
                    <FileText className="size-4 text-[#1B4332]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Document Review</p>
                    {activeBooking && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {activeBooking.application.studentFirstName
                          ? `${activeBooking.application.studentFirstName} ${activeBooking.application.studentLastName ?? ""}`
                          : "—"}
                        {" · "}
                        <span className="font-mono">{activeBooking.application.applicationNumber}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    <CheckCircle className="size-3" /> {approved} approved
                  </span>
                  {rejected > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-600">
                      <XCircle className="size-3" /> {rejected} rejected
                    </span>
                  )}
                  {pending > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                      <Clock className="size-3" /> {pending} pending
                    </span>
                  )}
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                  <button
                    onClick={() => { setReviewDocsOpen(false); setPreviewDoc(null); setRejectingDocId(null); setRejectNote(""); }}
                    className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  >
                    <XCircle className="size-5" />
                  </button>
                </div>
              </div>

              {/* ── Body ───────────────────────────────────────────── */}
              <div className="flex flex-1 overflow-hidden">

                {/* LEFT — Document list */}
                <div className="flex flex-col border-r border-gray-100 bg-gray-50 overflow-y-auto" style={{ width: 320 }}>
                  {/* Progress */}
                  <div className="px-5 py-3 border-b border-gray-100 bg-white shrink-0">
                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                      <span className="font-medium text-gray-700">{docs.length} document{docs.length !== 1 ? "s" : ""}</span>
                      <span>{approved} / {docs.length} verified</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all duration-500"
                        style={{ width: docs.length > 0 ? `${(approved / docs.length) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>

                  {docs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 py-16 text-center px-4">
                      <FileText className="size-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">No documents uploaded yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {docs.map((doc) => {
                        const isApproved   = doc.isVerified;
                        const isRejected   = !doc.isVerified && !!doc.verificationNote;
                        const isLoadingThis = docActionLoading === doc.id;
                        const isRejectingThis = rejectingDocId === doc.id;
                        const isActive     = previewDoc?.id === doc.id;

                        return (
                          <div
                            key={doc.id}
                            style={{ borderLeft: `3px solid ${isActive ? "#1B4332" : "transparent"}` }}
                            className={cn("transition-colors", isActive ? "bg-[#1B4332]/5" : "hover:bg-white")}
                          >
                            {/* Clickable row → loads preview */}
                            <button
                              className="w-full flex items-start gap-3 px-4 py-3 text-left"
                              onClick={() => setPreviewDoc(doc)}
                            >
                              <div className="mt-0.5 shrink-0">
                                {isApproved  ? <CheckCircle className="size-4 text-green-500" />
                                : isRejected ? <XCircle    className="size-4 text-red-400"   />
                                :              <Clock       className="size-4 text-gray-400"  />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-medium text-gray-900">{doc.fileName}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{doc.documentType.replace(/_/g, " ")}</p>
                                <p className="text-xs text-gray-300 mt-0.5">{(doc.fileSize / 1024).toFixed(0)} KB</p>
                                {isRejected && doc.verificationNote && (
                                  <p className="mt-1.5 text-xs rounded bg-red-50 border border-red-100 px-2 py-1 text-red-600">
                                    {doc.verificationNote}
                                  </p>
                                )}
                              </div>
                              <span className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                isApproved ? "bg-green-100 text-green-700"
                                : isRejected ? "bg-red-100 text-red-600"
                                : "bg-gray-100 text-gray-500"
                              )}>
                                {isApproved ? "OK" : isRejected ? "Rejected" : "Pending"}
                              </span>
                            </button>

                            {/* Approve / Reject buttons */}
                            <div className="flex gap-2 px-4 pb-3">
                              {isApproved ? (
                                <span className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-green-50 py-2 text-xs font-medium text-green-600">
                                  <CheckCircle className="size-3" /> Approved
                                </span>
                              ) : (
                                <button
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-green-300 bg-green-50 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
                                  disabled={!!isLoadingThis}
                                  onClick={() => handleDocAction(doc.id, "approve")}
                                >
                                  <CheckCircle className="size-3.5" />
                                  {isLoadingThis ? "…" : "Approve"}
                                </button>
                              )}

                              {!isRejected ? (
                                <button
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                                  disabled={!!isLoadingThis}
                                  onClick={(e) => { e.stopPropagation(); setRejectingDocId(doc.id); setRejectNote(""); }}
                                >
                                  <XCircle className="size-3.5" /> Reject
                                </button>
                              ) : (
                                <button
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setRejectingDocId(doc.id); setRejectNote(doc.verificationNote ?? ""); }}
                                >
                                  <Pencil className="size-3.5" /> Edit Reason
                                </button>
                              )}
                            </div>

                            {/* Inline reject form */}
                            {isRejectingThis && (
                              <div className="mx-4 mb-3 rounded-xl border border-red-200 bg-white p-3 space-y-2">
                                <p className="text-xs font-semibold text-red-700">Rejection reason (required):</p>
                                <textarea
                                  autoFocus
                                  rows={2}
                                  value={rejectNote}
                                  onChange={(e) => setRejectNote(e.target.value)}
                                  placeholder="e.g. Document is blurry, wrong file type…"
                                  className="w-full rounded-lg border border-red-200 px-2.5 py-2 text-xs text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                                    disabled={!rejectNote.trim() || !!isLoadingThis}
                                    onClick={() => handleDocAction(doc.id, "reject", rejectNote)}
                                  >
                                    {isLoadingThis ? "Submitting…" : "Confirm Reject"}
                                  </button>
                                  <button
                                    className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); setRejectingDocId(null); setRejectNote(""); }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RIGHT — Preview pane */}
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-white">
                  {previewDoc ? (
                    <>
                      {/* Preview toolbar */}
                      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="size-4 text-gray-400 shrink-0" />
                          <p className="text-sm font-medium text-gray-800 truncate">{previewDoc.fileName}</p>
                          <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            {previewDoc.mimeType.split("/")[1] ?? "file"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={previewDoc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <ExternalLink className="size-3" /> Open
                          </a>
                          <button
                            onClick={() => setPreviewDoc(null)}
                            className="flex size-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                            title="Close preview"
                          >
                            <XCircle className="size-4" />
                          </button>
                        </div>
                      </div>

                      {/* Viewer */}
                      <div className="flex flex-col flex-1 min-h-0">
                        {/\.(jpe?g|png|webp|gif)(\?|$)/i.test(previewDoc.fileUrl) || previewDoc.mimeType.startsWith("image/") ? (
                          /* ── Image viewer ── */
                          <div className="flex flex-1 items-center justify-center p-8 min-h-0 bg-[#f8f8f8]" style={{ backgroundImage: "radial-gradient(#e0e0e0 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              key={previewDoc.id}
                              src={previewDoc.fileUrl}
                              alt={previewDoc.fileName}
                              className="max-h-full max-w-full rounded-xl object-contain shadow-xl"
                              onError={() => setPdfError(true)}
                            />
                            {pdfError && <DocUnavailable url={previewDoc.fileUrl} name={previewDoc.fileName} />}
                          </div>
                        ) : /\.pdf(\?|$)/i.test(previewDoc.fileUrl) || previewDoc.mimeType === "application/pdf" ? (
                          /* ── PDF viewer ── */
                          pdfError ? (
                            <DocUnavailable url={previewDoc.fileUrl} name={previewDoc.fileName} />
                          ) : (
                            <object
                              key={previewDoc.id}
                              data={previewDoc.fileUrl}
                              type="application/pdf"
                              style={{ flex: 1, width: "100%", minHeight: 0, display: "flex" }}
                              onError={() => setPdfError(true)}
                            >
                              {/* Fallback shown by the browser when <object> can't load */}
                              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 32, background: "#f9fafb" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: 24, background: "#fee2e2" }}>
                                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                                </div>
                                <div style={{ textAlign: "center" }}>
                                  <p style={{ fontWeight: 600, color: "#374151", marginBottom: 6 }}>PDF cannot be previewed</p>
                                  <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>Your browser blocked the embed or the file is inaccessible from this environment.</p>
                                  <a
                                    href={previewDoc.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1B4332", color: "#fff", padding: "10px 24px", borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: "none" }}
                                  >
                                    Open PDF in new tab →
                                  </a>
                                </div>
                              </div>
                            </object>
                          )
                        ) : (
                          /* ── Unsupported format ── */
                          <DocUnavailable url={previewDoc.fileUrl} name={previewDoc.fileName} />
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center px-8 bg-gray-50">
                      <div className="flex size-20 items-center justify-center rounded-3xl bg-gray-200">
                        <Eye className="size-9 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-gray-500">Select a document to preview</p>
                        <p className="mt-1.5 text-sm text-gray-400">Click any document in the list to load it here</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Publish Confirm Dialog ──────────────────────────────────────────── */}
      <AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Result?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeBooking && (
                <>
                  This will publish the result for{" "}
                  <strong>
                    {activeBooking.application.studentFirstName
                      ? `${activeBooking.application.studentFirstName} ${activeBooking.application.studentLastName ?? ""}`
                      : activeBooking.application.applicationNumber}
                  </strong>{" "}
                  and notify the parent/guardian by email. The application status will be
                  updated to{" "}
                  <strong>{activeBooking.result?.isPassed ? "ADMITTED" : "NOT ADMITTED"}</strong>.
                  <br />
                  <br />
                  <span className="text-amber-600 font-medium">
                    This action cannot be undone once published.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublish}
              disabled={isSubmitting}
              className="bg-[#1B4332] text-white hover:bg-[#1B4332]/90"
            >
              {isSubmitting ? "Publishing…" : "Yes, Publish Result"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
