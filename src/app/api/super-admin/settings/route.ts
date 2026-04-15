import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { ok, err } from "@/types/api";

const settingsSchema = z.object({
  // Notifications
  emailOnSubmit:     z.boolean().optional(),
  emailOnApprove:    z.boolean().optional(),
  emailOnReject:     z.boolean().optional(),
  emailOnRevision:   z.boolean().optional(),
  emailOnExamBooked: z.boolean().optional(),
  smsOnSubmit:       z.boolean().optional(),
  smsOnApprove:      z.boolean().optional(),
  smsOnReject:       z.boolean().optional(),
  // Admission rules
  allowTransferStudents: z.boolean().optional(),
  requirePaymentToSubmit: z.boolean().optional(),
  autoCloseOnCycleEnd: z.boolean().optional(),
  maxApplicationsPerApplicant: z.number().int().min(1).max(10).optional(),
  // Security
  sessionTimeoutMinutes: z.number().int().min(15).max(1440).optional(),
  passwordMinLength: z.number().int().min(6).max(32).optional(),
  maxLoginAttempts: z.number().int().min(3).max(20).optional(),
  lockoutDurationMinutes: z.number().int().min(5).max(1440).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json(err("UNAUTHORIZED", "Unauthorized"), { status: 401 });
  }

  const orgId = session.user.organizationId ?? "";
  const [org, cycles, fees, rawSettings] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true, name: true, email: true, phone: true, website: true,
        address: true, state: true, lga: true, city: true,
        primaryColor: true, secondaryColor: true, logoUrl: true,
      },
    }),
    db.admissionCycle.findMany({
      where: { organizationId: orgId, status: { in: ["OPEN", "DRAFT"] } },
      select: { id: true, name: true, academicYear: true, status: true, isDefault: true },
      orderBy: { createdAt: "desc" },
    }),
    db.feeStructure.findMany({
      where: { organizationId: orgId, branchId: null, classLevel: null, isActive: true },
      select: { id: true, paymentType: true, amountKobo: true, admissionCycleId: true },
    }),
    db.$queryRaw<{ settings: unknown }[]>`
      SELECT settings FROM organizations WHERE id = ${orgId}::uuid LIMIT 1
    `,
  ]);

  if (!org) return NextResponse.json(err("NOT_FOUND", "Organisation not found"), { status: 404 });

  const settings = (rawSettings[0]?.settings as Record<string, unknown>) ?? {};
  return NextResponse.json(ok({ org: { ...org, settings }, cycles, fees }));
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json(err("UNAUTHORIZED", "Unauthorized"), { status: 401 });
  }

  const orgId = session.user.organizationId ?? "";
  const body = await req.json().catch(() => ({}));
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()),
      { status: 422 }
    );
  }

  // Merge with existing settings (raw query — Prisma client may not know the field yet)
  const rawExisting = await db.$queryRaw<{ settings: unknown }[]>`
    SELECT settings FROM organizations WHERE id = ${orgId}::uuid LIMIT 1
  `;
  const currentSettings = (rawExisting[0]?.settings as Record<string, unknown>) ?? {};
  const merged = { ...currentSettings, ...parsed.data };

  await db.$executeRaw`
    UPDATE organizations SET settings = ${JSON.stringify(merged)}::jsonb WHERE id = ${orgId}::uuid
  `;

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      organizationId: orgId,
      action: "SETTINGS_UPDATED",
      entityType: "Organization",
      entityId: orgId,
      changes: { before: JSON.parse(JSON.stringify(currentSettings)), after: JSON.parse(JSON.stringify(merged)) },
      ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
      userAgent: req.headers.get("user-agent") ?? "",
    },
  });

  return NextResponse.json(ok({ updated: true }));
}
