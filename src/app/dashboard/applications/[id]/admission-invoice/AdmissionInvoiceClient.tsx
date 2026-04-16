"use client";

import { useState, useRef } from "react";
import {
  Copy,
  Check,
  Upload,
  FileImage,
  AlertTriangle,
  Building2,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode?: string;
}

interface PendingBankTransfer {
  id: string;
  receiptUrl: string | null;
}

interface Props {
  applicationId: string;
  applicationNumber: string;
  studentName: string;
  branchName: string;
  admissionFeeKobo: number;
  bankDetails: BankDetails | null;
  orgName: string;
  pendingBankTransfer: PendingBankTransfer | null;
}

function formatNaira(kobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(kobo / 100);
}

export default function AdmissionInvoiceClient({
  applicationId,
  applicationNumber,
  studentName,
  branchName,
  admissionFeeKobo,
  bankDetails,
  orgName,
  pendingBankTransfer,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(
    pendingBankTransfer?.receiptUrl ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleCopy() {
    navigator.clipboard.writeText(applicationNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Only JPG, PNG, WEBP, or PDF files are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File must be under 5 MB.");
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      // Step 1: Upload file to storage
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("folder", `admission-evidence/${applicationId}`);

      const uploadRes = await fetch("/api/uploads", { method: "POST", body: uploadFormData });
      if (!uploadRes.ok) throw new Error("Upload failed. Please try again.");
      const { data: uploadData } = await uploadRes.json();
      const publicUrl = uploadData.publicUrl as string;

      // Step 2: Save receipt URL → create/update Payment record
      const saveRes = await fetch(
        `/api/applications/${applicationId}/admission-evidence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiptUrl: publicUrl,
            contentType: file.type,
          }),
        },
      );
      if (!saveRes.ok) {
        const j = await saveRes.json();
        throw new Error(j.error?.message ?? "Failed to save receipt");
      }

      setReceiptUrl(publicUrl);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  const isImage = receiptUrl && /\.(jpe?g|png|webp)(\?|$)/i.test(receiptUrl);

  return (
    <div className="space-y-6">
      {/* Admission offer notice */}
      <div className="flex gap-3 rounded-lg border border-[#1B4332]/20 bg-[#1B4332]/5 p-4">
        <GraduationCap className="mt-0.5 size-5 shrink-0 text-[#1B4332]" />
        <div className="space-y-1">
          <p className="font-semibold text-[#1B4332]">Admission Offer — Payment Required</p>
          <p className="text-sm text-gray-700">
            {studentName ? (
              <>
                <strong>{studentName}</strong> has been offered admission to{" "}
                <strong>{branchName}</strong>.{" "}
              </>
            ) : (
              <>Your child has been offered admission to <strong>{branchName}</strong>. </>
            )}
            Pay the acceptance fee into the school&apos;s account below, then upload
            your payment receipt. The school will confirm receipt and complete enrolment.
          </p>
        </div>
      </div>

      {/* Payment required warning */}
      <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-800">Acceptance Fee Must Be Paid</p>
          <p className="text-sm text-amber-700">
            Your child&apos;s place <strong>will not be confirmed</strong> until this payment
            is verified by {orgName}. Upload your payment evidence below after making the transfer.
          </p>
        </div>
      </div>

      {/* Invoice card */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Acceptance Fee Invoice</CardTitle>
            <span className="text-sm text-muted-foreground">{orgName}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Payment reference */}
          <div className="rounded-md bg-muted/50 px-4 py-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payment Narration (quote this reference)
            </p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-bold">{applicationNumber}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-7 gap-1.5 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="size-3" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3" /> Copy
                  </>
                )}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              You <strong>must</strong> include this reference as your payment narration
              so the school can identify your transfer.
            </p>
          </div>

          {/* Fee breakdown */}
          <div>
            <p className="mb-2 text-sm font-medium">Fee Breakdown</p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Admission Acceptance Fee</td>
                  <td className="py-2 text-right font-medium">
                    {admissionFeeKobo > 0 ? formatNaira(admissionFeeKobo) : "Contact school"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold">Total Due</td>
                  <td className="py-2 text-right font-bold text-lg">
                    {admissionFeeKobo > 0 ? formatNaira(admissionFeeKobo) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bank details */}
          {bankDetails ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Bank Transfer Details</p>
              </div>
              <div className="rounded-md border divide-y text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Bank Name</span>
                  <span className="font-medium">{bankDetails.bankName}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Account Name</span>
                  <span className="font-medium">{bankDetails.accountName}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Account Number</span>
                  <span className="font-mono font-bold">{bankDetails.accountNumber}</span>
                </div>
                {bankDetails.sortCode && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Sort Code</span>
                    <span className="font-medium">{bankDetails.sortCode}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Bank account details have not been configured yet. Contact {orgName} directly
              for payment information.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence upload card */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Upload Payment Receipt</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {receiptUrl ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3">
                <Check className="size-4 text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-800">
                  Payment receipt uploaded — awaiting school confirmation.
                </p>
              </div>
              {isImage ? (
                <div className="overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptUrl}
                    alt="Payment receipt"
                    className="max-h-64 w-full object-contain"
                  />
                </div>
              ) : (
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 underline"
                >
                  <FileImage className="size-4" />
                  View uploaded receipt
                </a>
              )}
              <p className="text-xs text-muted-foreground">
                Need to replace it? Upload a new file below.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              After making the bank transfer, upload a screenshot or photo of your payment
              receipt or transaction confirmation so the school can verify your payment.
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          {uploadError && (
            <p className="text-sm text-red-600">{uploadError}</p>
          )}

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            variant={receiptUrl ? "outline" : "default"}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="size-4" />
                {receiptUrl ? "Replace Receipt" : "Upload Payment Receipt"}
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            Accepted: JPG, PNG, WEBP, PDF · Max 5 MB
          </p>
        </CardContent>
      </Card>

      {receiptUrl && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <strong>What happens next?</strong> {orgName} will review your payment receipt and
          confirm the acceptance fee. Once confirmed, your child&apos;s enrolment will be
          completed and you will be notified.
        </div>
      )}
    </div>
  );
}
