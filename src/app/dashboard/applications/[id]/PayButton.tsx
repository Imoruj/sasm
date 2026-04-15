"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaymentType = "APPLICATION_FEE" | "EXAM_FEE" | "ADMISSION_FEE" | "ONLINE_TEST_FEE";

interface Props {
  applicationId: string;
  paymentType?: PaymentType;
}

export default function PayButton({ applicationId, paymentType = "APPLICATION_FEE" }: Props) {
  if (paymentType === "ADMISSION_FEE") {
    return (
      <Button className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white" asChild>
        <Link href={`/dashboard/applications/${applicationId}/admission-invoice`}>
          <FileText className="size-4" />
          View Acceptance Fee Invoice
        </Link>
      </Button>
    );
  }

  // APPLICATION_FEE and all others → existing invoice page
  return (
    <Button variant="outline" asChild>
      <Link href={`/dashboard/applications/${applicationId}/invoice`}>
        <FileText className="size-4" />
        View Invoice &amp; Pay
      </Link>
    </Button>
  );
}
