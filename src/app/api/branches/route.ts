import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });

    const orgId = session.user.organizationId;

    // Applicants have no organizationId — query all active branches/cycles so they can apply
    const orgFilter = orgId ? { organizationId: orgId } : {};

    const [branches, cycles] = await Promise.all([
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
    ]);

    return NextResponse.json(ok({ branches, cycles }));
  } catch (error) {
    console.error("[GET_BRANCHES]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
