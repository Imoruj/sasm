"use client";

import { useState, useRef } from "react";
import { Copy, Check, Upload, FileImage, AlertTriangle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode?: string;
}

interface InvoiceClientProps {
  applicationId: string;
  applicationNumber: string;
  applicationFeeKobo: number;
  onlineTestFeeKobo: number;
  isOnlinePlacementTest: boolean;
  bankDetails: BankDetails | null;
  existingEvidenceUrl: string | null;
  orgName: string;
}

function formatNaira(kobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(kobo / 100);
}

export default function InvoiceClient({
  applicationId,
  applicationNumber,
  applicationFeeKobo,
  onlineTestFeeKobo,
  isOnlinePlacementTest,
  bankDetails,
  existingEvidenceUrl,
  orgName,
}: InvoiceClientProps) {
  const onlineSurcharge = isOnlinePlacementTest ? onlineTestFeeKobo : 0;
  const totalFeeKobo = applicationFeeKobo + onlineSurcharge;
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(existingEvidenceUrl);
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
      setUploadError("File must be under 5MB.");
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      // Upload file to storage
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("folder", `payment-evidence/${applicationId}`);

      const uploadRes = await fetch("/api/uploads", { method: "POST", body: uploadFormData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { data: uploadData } = await uploadRes.json();
      const publicUrl = uploadData.publicUrl as string;

      // Save URL to application
      const patchRes = await fetch(`/api/applications/${applicationId}/payment-evidence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceUrl: publicUrl }),
      });
      if (!patchRes.ok) throw new Error("Failed to save evidence");

      setEvidenceUrl(publicUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const isImage = evidenceUrl && /\.(jpe?g|png|webp)(\?|$)/i.test(evidenceUrl);

  return (
    <div className="space-y-6">
      {/* Critical warning */}
      <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" />
        <div className="space-y-1">
          <p className="font-semibold text-red-800">Payment Required</p>
          <p className="text-sm text-red-700">
            Your application will <strong>not be processed</strong> until payment is confirmed by{" "}
            {orgName}. Upload your payment evidence below after making the transfer.
          </p>
        </div>
      </div>

      {/* Invoice card */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Payment Invoice</CardTitle>
            <span className="text-sm text-muted-foreground">{orgName}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Application number */}
          <div className="rounded-md bg-muted/50 px-4 py-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payment Narration (quote this reference)
            </p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-bold">{applicationNumber}</span>
              <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 gap-1.5 text-xs">
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
              You <strong>must</strong> include this number as your payment description/narration so we can identify your payment.
            </p>
          </div>

          {/* Fee breakdown */}
          <div>
            <p className="mb-2 text-sm font-medium">Fee Breakdown</p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Application Fee</td>
                  <td className="py-2 text-right font-medium">
                    {applicationFeeKobo > 0 ? formatNaira(applicationFeeKobo) : "No fee set"}
                  </td>
                </tr>
                {isOnlinePlacementTest && onlineSurcharge > 0 && (
                  <tr className="border-b">
                    <td className="py-2 text-muted-foreground">Online Placement Test Fee</td>
                    <td className="py-2 text-right font-medium">{formatNaira(onlineSurcharge)}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-2 font-semibold">Total Due</td>
                  <td className="py-2 text-right font-bold text-lg">
                    {totalFeeKobo > 0 ? formatNaira(totalFeeKobo) : "₦0.00"}
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
              Bank account details have not been configured yet. Contact the school directly for payment information.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence upload */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Upload Payment Evidence</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {evidenceUrl ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3">
                <Check className="size-4 text-green-600" />
                <p className="text-sm font-medium text-green-800">Payment evidence uploaded successfully.</p>
              </div>
              {isImage ? (
                <div className="overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={evidenceUrl} alt="Payment evidence" className="max-h-64 w-full object-contain" />
                </div>
              ) : (
                <a
                  href={evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 underline"
                >
                  <FileImage className="size-4" />
                  View uploaded document
                </a>
              )}
              <p className="text-xs text-muted-foreground">
                Need to replace it? Upload a new file below.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              After making the bank transfer, upload a screenshot or photo of your payment receipt or transaction confirmation.
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
            variant={evidenceUrl ? "outline" : "default"}
            className="gap-2"
          >
            <Upload className="size-4" />
            {uploading ? "Uploading…" : evidenceUrl ? "Replace Evidence" : "Upload Payment Evidence"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Accepted: JPG, PNG, WEBP, PDF · Max 5MB
          </p>
        </CardContent>
      </Card>

      {evidenceUrl && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <strong>What happens next?</strong> The school admin will review your payment evidence and confirm receipt. You will receive an email once your application has been successfully submitted.
        </div>
      )}
    </div>
  );
}
