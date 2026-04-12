import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_FAVICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#1B4332"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">S</text>
</svg>`;

async function resolveLogoUrl() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  if (session.user.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { logoUrl: true },
    });

    return org?.logoUrl ?? null;
  }

  const recentApplication = await db.application.findFirst({
    where: { applicantId: session.user.id },
    select: {
      organization: {
        select: { logoUrl: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return recentApplication?.organization.logoUrl ?? null;
}

export async function GET() {
  const logoUrl = await resolveLogoUrl();

  if (logoUrl) {
    return NextResponse.redirect(logoUrl, {
      status: 307,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  return new NextResponse(DEFAULT_FAVICON_SVG, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Type": "image/svg+xml",
    },
  });
}
