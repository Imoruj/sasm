import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { getUploadPresignedUrl } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — returns a presigned URL for uploading payment evidence */
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const { id } = await params;

    const application = await db.application.findFirst({
      where: { id, applicantId: session.user.id },
      select: { id: true, applicationNumber: true },
    });
    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });

    const result = await getUploadPresignedUrl(
      `payment-evidence/${application.id}`,
      "evidence.jpg",
      "image/jpeg",
    );

    return NextResponse.json(ok({ uploadUrl: result.uploadUrl, publicUrl: result.publicUrl }));
  } catch (error) {
    console.error("[GET_PAYMENT_EVIDENCE_URL]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}

/** PATCH — save the uploaded evidence URL to the application */
export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const { id } = await params;
    const { evidenceUrl } = await req.json();

    if (!evidenceUrl || typeof evidenceUrl !== "string") {
      return NextResponse.json(err("VALIDATION_ERROR", "evidenceUrl is required"), { status: 400 });
    }

    const application = await db.application.findFirst({
      where: {
        id,
        applicantId: session.user.id,
        status: { in: ["DRAFT", "REVISION_REQUIRED", "UNDER_REVIEW"] },
      },
      select: { id: true, status: true },
    });
    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });

    // Saving evidence automatically moves the application into review queue
    await db.application.update({
      where: { id },
      data: {
        paymentEvidenceUrl: evidenceUrl,
        status: "UNDER_REVIEW",
        paymentStatus: "PENDING",
        submittedAt: new Date(),
      },
    });

    return NextResponse.json(ok({ message: "Payment evidence saved" }));
  } catch (error) {
    console.error("[PATCH_PAYMENT_EVIDENCE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
