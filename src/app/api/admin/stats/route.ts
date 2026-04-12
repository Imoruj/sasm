import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { adminLimiter } from "@/lib/ratelimit";

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await adminLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Insufficient permissions"), { status: 403 });
    }

    const orgId = session.user.organizationId ?? "";
    const branchFilter = session.user.branchId ? { branchId: session.user.branchId } : {};
    const base = { organizationId: orgId, ...branchFilter };

    const [total, draft, submitted, underReview, approved, rejected, admitted, enrolled] = await Promise.all([
      db.application.count({ where: base }),
      db.application.count({ where: { ...base, status: "DRAFT" } }),
      db.application.count({ where: { ...base, status: "SUBMITTED" } }),
      db.application.count({ where: { ...base, status: "UNDER_REVIEW" } }),
      db.application.count({ where: { ...base, status: "APPROVED" } }),
      db.application.count({ where: { ...base, status: "REJECTED" } }),
      db.application.count({ where: { ...base, status: "ADMITTED" } }),
      db.application.count({ where: { ...base, status: "ENROLLED" } }),
    ]);

    return NextResponse.json(ok({ total, draft, submitted, underReview, approved, rejected, admitted, enrolled }));
  } catch (error) {
    console.error("[ADMIN_STATS]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
