"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
type DocumentType =
  | "PASSPORT_PHOTO"
  | "BIRTH_CERTIFICATE"
  | "AGE_DECLARATION"
  | "REPORT_CARD"
  | "TESTIMONIAL"
  | "TRANSFER_LETTER"
  | "HEALTH_RECORD"
  | "IMMUNIZATION_CARD"
  | "OTHER";

interface ExistingDocument {
  id: string;
  documentType: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  isVerified: boolean;
}

interface RequiredDoc {
  type: DocumentType;
  label: string;
  description: string;
  required: boolean;
}

interface Props {
  applicationId: string;
  existingDocuments: ExistingDocument[];
}

// ─── Required documents definition ───────────────────────────────────────────
const REQUIRED_DOCUMENTS: RequiredDoc[] = [
  {
    type: "PASSPORT_PHOTO",
    label: "Passport Photograph",
    description: "Recent passport-size colour photo (white background). JPG or PNG.",
    required: true,
  },
  {
    type: "BIRTH_CERTIFICATE",
    label: "Birth Certificate",
    description: "Certified copy of birth certificate or age declaration.",
    required: true,
  },
  {
    type: "REPORT_CARD",
    label: "Previous School Report Card",
    description: "Most recent end-of-term report card from previous school.",
    required: true,
  },
  {
    type: "TESTIMONIAL",
    label: "School Testimonial / Transfer Letter",
    description: "Official testimonial or transfer letter from previous school.",
    required: false,
  },
  {
    type: "IMMUNIZATION_CARD",
    label: "Immunization / Health Record",
    description: "Up-to-date immunization card or health record.",
    required: false,
  },
];

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Individual document row ──────────────────────────────────────────────────
function DocumentRow({
  doc,
  existing,
  applicationId,
  onUploaded,
  onDeleted,
}: {
  doc: RequiredDoc;
  existing: ExistingDocument | undefined;
  applicationId: string;
  onUploaded: (docType: DocumentType, result: ExistingDocument) => void;
  onDeleted: (docId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error("File type not allowed. Use PDF, JPG, PNG, or DOCX.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large. Maximum size is 5 MB.");
      return;
    }

    setUploading(true);
    try {
      // Phase 1 — upload file to storage
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("folder", `documents/${applicationId}/${doc.type.toLowerCase()}`);

      const uploadRes = await fetch("/api/uploads", {
        method: "POST",
        body: uploadFormData,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.success) {
        toast.error(uploadJson.error?.message ?? "Upload failed. Please try again.");
        return;
      }

      const { publicUrl } = uploadJson.data as { key: string; publicUrl: string };

      // Phase 2 — confirm with server
      const confirmRes = await fetch(`/api/applications/${applicationId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          documentType: doc.type,
          fileName: file.name,
          fileUrl: publicUrl,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });
      const confirmJson = await confirmRes.json();
      if (!confirmJson.success) {
        toast.error(confirmJson.error?.message ?? "Failed to save document");
        return;
      }

      toast.success(`${doc.label} uploaded successfully`);
      onUploaded(doc.type, confirmJson.data as ExistingDocument);
    } catch {
      toast.error("Upload failed. Please check your connection.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(docId: string) {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/applications/${applicationId}/documents?docId=${docId}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Failed to remove document");
        return;
      }
      toast.success("Document removed");
      onDeleted(docId);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        existing?.isVerified
          ? "border-green-200 bg-green-50"
          : existing
          ? "border-blue-200 bg-blue-50/40"
          : dragOver
          ? "border-[#1B4332] bg-[#1B4332]/5"
          : "border-gray-200 bg-white",
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Doc info */}
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            existing?.isVerified
              ? "bg-green-100"
              : existing
              ? "bg-blue-100"
              : "bg-gray-100",
          )}>
            {existing?.isVerified ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <FileText className="h-4 w-4 text-gray-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              {doc.label}
              {doc.required && (
                <span className="text-red-500 text-xs font-normal">(required)</span>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
            {existing && (
              <p className="mt-1.5 text-xs text-gray-600 flex items-center gap-1.5">
                <span className="font-medium truncate max-w-[200px]">{existing.fileName}</span>
                <span className="text-gray-400">· {formatBytes(existing.fileSize)}</span>
                {existing.isVerified ? (
                  <span className="inline-flex items-center gap-0.5 text-green-700 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </span>
                ) : (
                  <span className="text-amber-600 font-medium">Pending review</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!existing?.isVerified && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <Button
                size="sm"
                variant={existing ? "outline" : "default"}
                className={cn(
                  "h-8 text-xs",
                  !existing && "bg-[#1B4332] hover:bg-[#1B4332]/90 text-white",
                )}
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">
                  {uploading ? "Uploading…" : existing ? "Replace" : "Upload"}
                </span>
              </Button>

              {existing && !existing.isVerified && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 border-red-200 text-red-600 hover:bg-red-50"
                  disabled={deleting}
                  onClick={() => handleDelete(existing.id)}
                >
                  {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DocumentUploadSection({ applicationId, existingDocuments }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [docs, setDocs] = useState<ExistingDocument[]>(existingDocuments);

  const requiredCount = REQUIRED_DOCUMENTS.filter((d) => d.required).length;
  const requiredUploaded = REQUIRED_DOCUMENTS.filter((d) => d.required).filter((d) =>
    docs.some((ex) => ex.documentType === d.type),
  ).length;
  const allRequiredDone = requiredUploaded === requiredCount;

  function handleUploaded(docType: DocumentType, result: ExistingDocument) {
    setDocs((prev) => {
      const without = prev.filter((d) => d.documentType !== docType);
      return [...without, result];
    });
    startTransition(() => router.refresh());
  }

  function handleDeleted(docId: string) {
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Required documents:{" "}
          <span className={cn("font-semibold", allRequiredDone ? "text-green-700" : "text-[#1B4332]")}>
            {requiredUploaded} / {requiredCount} uploaded
          </span>
        </p>
        {allRequiredDone && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All required docs uploaded
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-[#1B4332] transition-all"
          style={{ width: `${(requiredUploaded / requiredCount) * 100}%` }}
        />
      </div>

      {/* Info notice */}
      {!allRequiredDone && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Please upload all required documents to complete your admission process. Accepted
            formats: <strong>PDF, JPG, PNG, DOCX</strong>. Max file size: <strong>5 MB</strong>.
            You can drag &amp; drop files onto each slot.
          </p>
        </div>
      )}

      {/* Document slots */}
      <div className="space-y-3">
        {REQUIRED_DOCUMENTS.map((doc) => (
          <DocumentRow
            key={doc.type}
            doc={doc}
            existing={docs.find((d) => d.documentType === doc.type) as ExistingDocument | undefined}
            applicationId={applicationId}
            onUploaded={handleUploaded}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
    </div>
  );
}
