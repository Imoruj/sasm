import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { z } from "zod";
import { adminLimiter } from "@/lib/ratelimit";

const schema = z.object({
  applicantEmail: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await adminLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Insufficient permissions"), { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()), { status: 400 });
    }

    const orgId = session.user.organizationId ?? "";
    if (!orgId) return NextResponse.json(err("NOT_FOUND", "No organization context found"), { status: 404 });

    const applicant = await db.user.findFirst({
      where: { email: parsed.data.applicantEmail, role: "APPLICANT", isActive: true },
      select: { id: true, organizationId: true },
    });
    if (!applicant) {
      return NextResponse.json(err("NOT_FOUND", "Applicant account not found"), { status: 404 });
    }
    if (applicant.organizationId && applicant.organizationId !== orgId) {
      return NextResponse.json(err("FORBIDDEN", "Applicant does not belong to this school"), { status: 403 });
    }

    const app = await db.application.findFirst({
      where: {
        applicantId: applicant.id,
        organizationId: orgId,
        ...(session.user.branchId ? { branchId: session.user.branchId } : {}),
        status: { in: ["DRAFT", "REVISION_REQUIRED"] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, updatedAt: true },
    });

    return NextResponse.json(ok({ applicationId: app?.id ?? null }));
  } catch (error) {
    console.error("[ADMIN_RESUME_APPLICATION]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

