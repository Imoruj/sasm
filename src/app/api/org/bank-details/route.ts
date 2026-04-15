import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { resolveSessionOrganizationId } from "@/lib/tenant";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const orgId = await resolveSessionOrganizationId(session.user.id, session.user.organizationId);
    if (!orgId) return NextResponse.json(err("NOT_FOUND", "Organization not found"), { status: 404 });

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    const settings = (org?.settings ?? {}) as Record<string, unknown>;
    const bankDetails = (settings.bankDetails ?? null) as {
      bankName: string;
      accountName: string;
      accountNumber: string;
      sortCode?: string;
    } | null;

    if (!bankDetails) {
      return NextResponse.json(ok(null));
    }

    return NextResponse.json(ok(bankDetails));
  } catch (error) {
    console.error("[GET_BANK_DETAILS]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
