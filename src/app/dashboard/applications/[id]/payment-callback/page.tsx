"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function PaymentCallbackContent({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!reference) {
      setStatus("failed");
      setMessage("No payment reference found.");
      return;
    }

    fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
        } else {
          setStatus("failed");
          setMessage(data.error?.message ?? "Payment could not be verified.");
        }
      })
      .catch(() => {
        setStatus("failed");
        setMessage("Network error. Please contact support.");
      });
  }, [reference]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      {status === "verifying" && (
        <>
          <Loader2 className="size-12 animate-spin text-[#1B4332]" />
          <p className="text-lg font-medium text-gray-700">Verifying your payment…</p>
          <p className="text-sm text-gray-500">Please wait, do not close this page.</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle className="size-16 text-green-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Successful!</h1>
            <p className="mt-2 text-gray-500">Your application fee has been received.</p>
          </div>
          <Button onClick={() => router.push(`/dashboard/applications/${applicationId}`)}>
            Back to Application
          </Button>
        </>
      )}

      {status === "failed" && (
        <>
          <XCircle className="size-16 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Failed</h1>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/applications/${applicationId}`)}
          >
            Return to Application
          </Button>
        </>
      )}
    </div>
  );
}

export default function PaymentCallbackPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#1B4332]" />
      </div>
    }>
      <PaymentCallbackContent applicationId={params.id} />
    </Suspense>
  );
}
