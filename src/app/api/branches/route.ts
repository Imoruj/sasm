import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { resolveSessionOrganizationId } from "@/lib/tenant";
import { applicantLimiter } from "@/lib/ratelimit";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await applicantLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const orgId = await resolveSessionOrganizationId(session.user.id, session.user.organizationId);
    const orgFilter = orgId ? { organizationId: orgId } : {};

    const [branches, cycles, templates] = await Promise.all([
      db.branch.findMany({
        where: { isActive: true, ...orgFilter },
        select: { id: true, name: true, address: true, state: true, city: true },
        orderBy: { name: "asc" },
      }),
      db.admissionCycle.findMany({
        where: { status: { in: ["OPEN", "DRAFT"] }, ...orgFilter },
        select: { id: true, name: true, academicYear: true, status: true },
        orderBy: { createdAt: "desc" },
      }),
      db.formTemplate.findMany({
        where: { status: "PUBLISHED", ...orgFilter },
        select: { branchId: true },
      }),
    ]);

    const branchesWithTemplate = branches.map((b) => ({
      ...b,
      // Only show branch if it has a template explicitly assigned to it
      hasTemplate: templates.some((t) => t.branchId === b.id),
    }));

    return NextResponse.json(ok({ branches: branchesWithTemplate, cycles }));
  } catch (error) {
    console.error("[GET_BRANCHES]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
