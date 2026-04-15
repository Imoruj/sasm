"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, XCircle, Clock, ExternalLink,
  ShieldCheck, AlertTriangle, UserCheck, Loader2,
} from "lucide-react";

export interface DocumentData {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  isVerified: boolean;
  verificationNote: string | null;
}

interface Props {
  applicationId: string;
  documents: DocumentData[];
  acceptancePaid: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function docStatus(doc: DocumentData): "approved" | "rejected" | "pending" {
  if (doc.isVerified) return "approved";
  if (doc.verificationNote) return "rejected";
  return "pending";
}

export default function DocumentReviewCard({ applicationId, documents, acceptancePaid }: Props) {
  const router = useRouter();

  // Per-document state: which doc is showing the reject note form
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (documents.length === 0) return null;

  const allVerified = documents.every((d) => d.isVerified);
  const pendingCount = documents.filter((d) => docStatus(d) === "pending").length;
  const rejectedCount = documents.filter((d) => docStatus(d) === "rejected").length;
  const approvedCount = documents.filter((d) => docStatus(d) === "approved").length;

  async function handleEnroll() {
    setEnrolling(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/enroll`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to enroll student.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleAction(docId: string, action: "approve" | "reject", note?: string) {
    setLoadingDocId(docId);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/applications/${applicationId}/documents/${docId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, note }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to update document status.");
        return;
      }
      setRejectingDocId(null);
      setRejectNote("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingDocId(null);
    }
  }

  return (
    <Card className="border-2 border-amber-200">
      <CardHeader className="border-b pb-3 bg-amber-50 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-amber-600" />
          Document Verification
          <span className="ml-auto flex items-center gap-1.5 text-xs font-normal text-gray-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-700">
              <CheckCircle className="size-3" /> {approvedCount}
            </span>
            {rejectedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                <XCircle className="size-3" /> {rejectedCount}
              </span>
            )}
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                <Clock className="size-3" /> {pendingCount}
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {!acceptancePaid && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
            <p className="text-xs text-amber-700">
              Admission acceptance fee not yet confirmed. Student will be enrolled once all documents are approved and the fee is paid.
            </p>
          </div>
        )}

        {allVerified && acceptancePaid && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle className="size-4 shrink-0 text-green-500" />
              <p className="text-xs text-green-700 font-medium">
                All documents verified and fee confirmed — ready to enroll.
              </p>
            </div>
            <Button
              size="sm"
              className="h-7 shrink-0 gap-1.5 bg-[#1B4332] hover:bg-[#1B4332]/90 text-white text-xs px-3"
              disabled={enrolling}
              onClick={handleEnroll}
            >
              {enrolling ? (
                <><Loader2 className="size-3 animate-spin" /> Enrolling…</>
              ) : (
                <><UserCheck className="size-3" /> Enroll Student</>
              )}
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {documents.map((doc) => {
            const status = docStatus(doc);
            const isLoadingThis = loadingDocId === doc.id;
            const isRejectingThis = rejectingDocId === doc.id;

            return (
              <div key={doc.id} className="py-3 space-y-2">
                {/* Document row */}
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div className="mt-0.5 shrink-0">
                    {status === "approved" && <CheckCircle className="size-4 text-green-500" />}
                    {status === "rejected" && <XCircle className="size-4 text-red-500" />}
                    {status === "pending" && <Clock className="size-4 text-gray-400" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{doc.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {doc.documentType.replace(/_/g, " ")} · {formatFileSize(doc.fileSize)}
                    </p>
                    {status === "rejected" && doc.verificationNote && (
                      <p className="mt-1 text-xs rounded bg-red-50 px-2 py-1 text-red-700">
                        Rejected: {doc.verificationNote}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <ExternalLink className="size-3" /> View
                    </a>

                    {status !== "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs border-green-300 text-green-700 hover:bg-green-50"
                        disabled={isLoadingThis}
                        onClick={() => handleAction(doc.id, "approve")}
                      >
                        <CheckCircle className="size-3 mr-1" />
                        {isLoadingThis ? "..." : "Approve"}
                      </Button>
                    )}

                    {status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs border-red-300 text-red-700 hover:bg-red-50"
                        disabled={isLoadingThis}
                        onClick={() => {
                          setRejectingDocId(doc.id);
                          setRejectNote("");
                        }}
                      >
                        <XCircle className="size-3 mr-1" />
                        Reject
                      </Button>
                    )}
                  </div>
                </div>

                {/* Inline reject form */}
                {isRejectingThis && (
                  <div className="ml-7 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-xs font-medium text-red-700">Reason for rejection (required):</p>
                    <textarea
                      rows={2}
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="e.g. Document is blurry / incorrect document type"
                      className="w-full rounded border border-red-200 bg-white px-2 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
                        disabled={!rejectNote.trim() || isLoadingThis}
                        onClick={() => handleAction(doc.id, "reject", rejectNote)}
                      >
                        {isLoadingThis ? "Submitting..." : "Confirm Reject"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => { setRejectingDocId(null); setRejectNote(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {pendingCount > 0 && (
          <p className="text-xs text-gray-400 text-center pt-1">
            {pendingCount} document{pendingCount !== 1 ? "s" : ""} pending review
          </p>
        )}
      </CardContent>
    </Card>
  );
}
