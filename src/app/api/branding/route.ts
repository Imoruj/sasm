import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/types/api";

/**
 * GET /api/branding
 * Public endpoint — returns the primary organisation's name and logo.
 * Used by auth pages (login, register, etc.) before a user is authenticated.
 */
export async function GET() {
  const org = await db.organization.findFirst({
    where: { isActive: true },
    select: { name: true, logoUrl: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    ok({ name: org?.name ?? null, logoUrl: org?.logoUrl ?? null }),
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
