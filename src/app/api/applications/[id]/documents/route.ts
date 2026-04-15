import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { z } from "zod";
import { getUploadPresignedUrl, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/storage";

const requestUploadSchema = z.object({
  documentType: z.enum([
    "PASSPORT_PHOTO",
    "BIRTH_CERTIFICATE",
    "AGE_DECLARATION",
    "REPORT_CARD",
    "TESTIMONIAL",
    "TRANSFER_LETTER",
    "HEALTH_RECORD",
    "IMMUNIZATION_CARD",
    "WAEC_RESULT",
    "NECO_RESULT",
    "OTHER",
  ]),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().refine((v) => ALLOWED_MIME_TYPES.includes(v), {
    message: "File type not allowed. Accepted: PDF, JPG, PNG, DOCX",
  }),
  fileSize: z.number().int().min(1).max(MAX_FILE_SIZE),
});

const confirmUploadSchema = z.object({
  documentType: z.enum([
    "PASSPORT_PHOTO",
    "BIRTH_CERTIFICATE",
    "AGE_DECLARATION",
    "REPORT_CARD",
    "TESTIMONIAL",
    "TRANSFER_LETTER",
    "HEALTH_RECORD",
    "IMMUNIZATION_CARD",
    "WAEC_RESULT",
    "NECO_RESULT",
    "OTHER",
  ]),
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().min(1),
  fileSize: z.number().int().min(1).max(MAX_FILE_SIZE),
  mimeType: z.string(),
});

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/applications/[id]/documents — list documents for this application */
export async function GET(req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const { id } = await params;

    const application = await db.application.findFirst({
      where: { id, applicantId: session.user.id },
      select: { id: true },
    });
    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });

    const documents = await db.applicationDocument.findMany({
      where: { applicationId: id },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json(ok(documents));
  } catch (error) {
    console.error("[DOCUMENTS_GET]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

/**
 * POST /api/applications/[id]/documents
 *
 * Two-phase flow:
 *  1. action = "request-url" → returns a presigned upload URL. Client uploads directly.
 *  2. action = "confirm"     → client confirms upload succeeded; server saves DB record.
 */
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const action = body?.action as string | undefined;

    // Verify the application belongs to this user and is in ADMITTED status
    const application = await db.application.findFirst({
      where: { id, applicantId: session.user.id },
      select: { id: true, status: true, payments: { where: { paymentType: "ADMISSION_FEE", status: "PAID" }, take: 1 } },
    });

    if (!application) return NextResponse.json(err("NOT_FOUND", "Application not found"), { status: 404 });

    if (application.status !== "ADMITTED" && application.status !== "ENROLLED") {
      return NextResponse.json(
        err("INVALID_STATE", "Document uploads are only available for admitted students"),
        { status: 400 },
      );
    }

    // ─── Phase 1: Request presigned URL ──────────────────────────────────────
    if (action === "request-url") {
      const validated = requestUploadSchema.safeParse(body);
      if (!validated.success) {
        return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
      }

      const { documentType, fileName, mimeType } = validated.data;
      const folder = `documents/${id}/${documentType.toLowerCase()}`;

      const { uploadUrl, key, publicUrl } = await getUploadPresignedUrl(folder, fileName, mimeType);

      return NextResponse.json(ok({ uploadUrl, key, publicUrl }));
    }

    // ─── Phase 2: Confirm upload ──────────────────────────────────────────────
    if (action === "confirm") {
      const validated = confirmUploadSchema.safeParse(body);
      if (!validated.success) {
        return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
      }

      const { documentType, fileName, fileUrl, fileSize, mimeType } = validated.data;

      // Replace any existing document of the same type
      const existing = await db.applicationDocument.findFirst({
        where: { applicationId: id, documentType },
      });

      const document = existing
        ? await db.applicationDocument.update({
            where: { id: existing.id },
            data: { fileName, fileUrl, fileSize, mimeType, isVerified: false, verificationNote: null },
          })
        : await db.applicationDocument.create({
            data: { applicationId: id, documentType, fileName, fileUrl, fileSize, mimeType },
          });

      return NextResponse.json(ok(document), { status: existing ? 200 : 201 });
    }

    return NextResponse.json(err("VALIDATION_ERROR", "action must be 'request-url' or 'confirm'"), { status: 400 });
  } catch (error) {
    console.error("[DOCUMENTS_POST]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

/** DELETE /api/applications/[id]/documents?docId=xxx — remove a document */
export async function DELETE(req: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("docId");
    if (!docId) return NextResponse.json(err("VALIDATION_ERROR", "docId is required"), { status: 400 });

    // Verify ownership
    const document = await db.applicationDocument.findFirst({
      where: { id: docId, applicationId: id, application: { applicantId: session.user.id } },
    });
    if (!document) return NextResponse.json(err("NOT_FOUND", "Document not found"), { status: 404 });

    // Don't allow deleting verified documents
    if (document.isVerified) {
      return NextResponse.json(err("FORBIDDEN", "Verified documents cannot be deleted"), { status: 400 });
    }

    await db.applicationDocument.delete({ where: { id: docId } });

    return NextResponse.json(ok({ deleted: true }));
  } catch (error) {
    console.error("[DOCUMENTS_DELETE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
