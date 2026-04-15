import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  FileText,
  ClipboardList,
  TrendingUp,
  Lock,
  CheckCircle2,
  Circle,
  CreditCard,
  UploadCloud,
  GraduationCap,
  ArrowRight,
  XCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function gradeColor(percentage: number) {
  if (percentage >= 75) return "text-green-700 bg-green-50";
  if (percentage >= 60) return "text-blue-700 bg-blue-50";
  if (percentage >= 45) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

type StepStatus = "done" | "current" | "upcoming";

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")
    return <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />;
  if (status === "current")
    return <Circle className="h-5 w-5 text-[#1B4332] shrink-0 fill-[#1B4332]/10" />;
  return <Circle className="h-5 w-5 text-gray-300 shrink-0" />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function ResultsPage() {
  const session = await auth();
  if (!session?.user) notFound();

  const applications = await db.application.findMany({
    where: { applicantId: session.user.id },
    select: {
      id: true,
      applicationNumber: true,
      studentFirstName: true,
      studentLastName: true,
      classApplied: true,
      status: true,
      branch: { select: { name: true } },
      admissionCycle: { select: { name: true } },
      documents: { select: { id: true, documentType: true, isVerified: true } },
      payments: {
        where: { paymentType: "ADMISSION_FEE", status: "PAID" },
        select: { id: true, amountKobo: true, paidAt: true },
        take: 1,
      },
      examBookings: {
        select: {
          id: true,
          status: true,
          examSession: { select: { title: true, examDate: true } },
          result: {
            select: {
              id: true,
              totalScore: true,
              maxScore: true,
              percentage: true,
              grade: true,
              scoreBreakdown: true,
              isPassed: true,
              isPublished: true,
              remarks: true,
              publishedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const appsWithPublishedResults = applications.filter((app) =>
    app.examBookings.some((b) => b.result?.isPublished),
  );
  const appsWithBookings = applications.filter((app) => app.examBookings.length > 0);

  return (
    <div>
      <PageHeader
        title="Exam Results"
        description="Track your entrance examination outcome and next steps"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Results" }]}
      />

      {/* ── No results yet ─────────────────────────────────────────────────── */}
      {appsWithPublishedResults.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            {appsWithBookings.length > 0 ? (
              <>
                <Lock className="mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">Results not yet published</p>
                <p className="mt-1 text-xs text-gray-400 max-w-sm">
                  You have sat an entrance exam. Results will be published once the admissions
                  team has reviewed and approved them. Check back later.
                </p>
              </>
            ) : (
              <>
                <ClipboardList className="mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">No exam results yet</p>
                <p className="mt-1 text-xs text-gray-400 max-w-sm">
                  Once your application is approved and you complete an entrance examination,
                  your results will appear here.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Results list ───────────────────────────────────────────────────── */}
      <div className="space-y-8">
        {appsWithPublishedResults.map((app) =>
          app.examBookings
            .filter((b) => b.result?.isPublished)
            .map((booking) => {
              const result = booking.result!;
              const pct = Number(result.percentage);
              const breakdown = result.scoreBreakdown as Record<string, number> | null;
              const isPassed = result.isPassed;
              const acceptancePaid = app.payments.length > 0;
              const hasDocuments = app.documents.length > 0;

              // Admission workflow step resolution
              // Step 1: Result published ✓ (we're here because it is)
              // Step 2: Accept offer (pay acceptance fee) — only for ADMITTED
              // Step 3: Upload documents
              // Step 4: Await enrolment
              const isAdmitted = app.status === "ADMITTED" || app.status === "ENROLLED";
              const isEnrolled = app.status === "ENROLLED";

              const steps = isPassed
                ? [
                    { label: "Entrance exam result published", status: "done" as StepStatus },
                    {
                      label: "Pay acceptance fee to confirm offer",
                      status: (acceptancePaid ? "done" : "current") as StepStatus,
                    },
                    {
                      label: "Upload required admission documents",
                      status: (
                        !acceptancePaid ? "upcoming" : hasDocuments ? "done" : "current"
                      ) as StepStatus,
                    },
                    {
                      label: "Await enrolment confirmation",
                      status: (
                        isEnrolled ? "done" : acceptancePaid && hasDocuments ? "current" : "upcoming"
                      ) as StepStatus,
                    },
                  ]
                : [];

              return (
                <div key={booking.id} className="space-y-4">
                  {/* ── Result card ──────────────────────────────────────── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base font-semibold">
                            {app.studentFirstName
                              ? `${app.studentFirstName} ${app.studentLastName ?? ""}`
                              : app.applicationNumber}
                          </CardTitle>
                          <p className="mt-0.5 text-sm text-gray-500">
                            {app.branch.name} · {app.classApplied} · {app.admissionCycle.name}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400">
                            Exam: {booking.examSession.title} ·{" "}
                            {formatDate(booking.examSession.examDate)}
                          </p>
                        </div>

                        <Badge
                          className={
                            isPassed
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-red-100 text-red-700 border-red-200"
                          }
                        >
                          {isPassed ? "PASSED" : "NOT PASSED"}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                      {/* Score summary */}
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className={`rounded-xl p-4 text-center ${gradeColor(pct)}`}>
                          <Trophy className="mx-auto mb-1 h-5 w-5" />
                          <p className="text-3xl font-bold tabular-nums">{pct.toFixed(1)}%</p>
                          <p className="text-xs font-medium">Overall Score</p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-4 text-center">
                          <TrendingUp className="mx-auto mb-1 h-5 w-5 text-gray-400" />
                          <p className="text-3xl font-bold tabular-nums text-gray-800">
                            {Number(result.totalScore).toFixed(0)}/
                            {Number(result.maxScore).toFixed(0)}
                          </p>
                          <p className="text-xs font-medium text-gray-500">Total / Max</p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-4 text-center">
                          <FileText className="mx-auto mb-1 h-5 w-5 text-gray-400" />
                          <p className="text-3xl font-bold tabular-nums text-gray-800">
                            {result.grade ?? "—"}
                          </p>
                          <p className="text-xs font-medium text-gray-500">Grade</p>
                        </div>
                      </div>

                      {/* Subject breakdown */}
                      {breakdown && Object.keys(breakdown).length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Subject Breakdown
                          </p>
                          <div className="space-y-2">
                            {Object.entries(breakdown).map(([subject, score]) => {
                              const maxSubjectScore = 100;
                              const subjectPct = Math.min(
                                100,
                                Math.round((score / maxSubjectScore) * 100),
                              );
                              return (
                                <div key={subject} className="flex items-center gap-3">
                                  <span className="w-32 shrink-0 truncate text-sm text-gray-600">
                                    {subject}
                                  </span>
                                  <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-[#1B4332] transition-all"
                                      style={{ width: `${subjectPct}%` }}
                                    />
                                  </div>
                                  <span className="w-10 shrink-0 text-right text-sm font-semibold text-gray-700">
                                    {score}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Remarks */}
                      {result.remarks && (
                        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                          <span className="font-medium">Remarks: </span>
                          {result.remarks}
                        </div>
                      )}

                      {result.publishedAt && (
                        <p className="text-right text-xs text-gray-400">
                          Published {formatDate(result.publishedAt)}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* ── NOT ADMITTED message ──────────────────────────────── */}
                  {!isPassed && (
                    <Card className="border-red-100 bg-red-50">
                      <CardContent className="flex items-start gap-3 py-5">
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                        <div>
                          <p className="text-sm font-semibold text-red-800">
                            Admission offer not extended
                          </p>
                          <p className="mt-1 text-sm text-red-700">
                            Unfortunately, your ward did not meet the admission cut-off for this
                            cycle. We appreciate the effort and encourage you to contact the
                            admissions office for further guidance or future opportunities.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* ── ADMITTED — Admission offer + step tracker ─────────── */}
                  {isPassed && (
                    <>
                      {/* Offer banner */}
                      {isEnrolled ? (
                        <Card className="border-green-200 bg-green-50">
                          <CardContent className="flex items-center gap-3 py-5">
                            <GraduationCap className="h-6 w-6 shrink-0 text-green-700" />
                            <div>
                              <p className="text-sm font-bold text-green-800">
                                Enrolment Confirmed!
                              </p>
                              <p className="mt-0.5 text-sm text-green-700">
                                {app.studentFirstName ?? "Your ward"} has been officially enrolled
                                at {app.branch.name}. Welcome to the school family!
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="border-[#1B4332]/20 bg-[#1B4332]/5">
                          <CardContent className="py-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-[#1B4332]" />
                                <div>
                                  <p className="text-sm font-bold text-[#1B4332]">
                                    Congratulations — Admission Offer Extended!
                                  </p>
                                  <p className="mt-0.5 text-sm text-gray-700">
                                    {app.studentFirstName ?? "Your ward"} has been offered
                                    admission to <strong>{app.branch.name}</strong>. Pay the
                                    acceptance fee and upload required documents to secure this
                                    place.
                                  </p>
                                </div>
                              </div>

                              {/* CTA — go to application detail which has accept flow */}
                              {!acceptancePaid && (
                                <Link href={`/dashboard/applications/${app.id}`} className="shrink-0">
                                  <Button className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white whitespace-nowrap">
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Accept Offer & Pay
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Step tracker */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold">
                            Admission Progress
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ol className="space-y-4">
                            {steps.map((step, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <StepIcon status={step.status} />
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-sm font-medium ${
                                      step.status === "done"
                                        ? "text-green-700 line-through decoration-green-400"
                                        : step.status === "current"
                                        ? "text-[#1B4332]"
                                        : "text-gray-400"
                                    }`}
                                  >
                                    {step.label}
                                  </p>
                                  {/* Inline CTAs for current steps */}
                                  {step.status === "current" && i === 1 && !acceptancePaid && (
                                    <Link href={`/dashboard/applications/${app.id}`}>
                                      <Button
                                        size="sm"
                                        className="mt-2 h-8 bg-[#1B4332] hover:bg-[#1B4332]/90 text-white text-xs"
                                      >
                                        <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                                        Pay Acceptance Fee
                                      </Button>
                                    </Link>
                                  )}
                                  {step.status === "current" && i === 2 && acceptancePaid && (
                                    <Link href={`/dashboard/applications/${app.id}?tab=documents`}>
                                      <Button
                                        size="sm"
                                        className="mt-2 h-8 bg-[#1B4332] hover:bg-[#1B4332]/90 text-white text-xs"
                                      >
                                        <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                                        Upload Documents
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ol>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              );
            }),
        )}
      </div>
    </div>
  );
}
