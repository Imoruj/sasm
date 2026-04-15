import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { ok, err } from "@/types/api";
import { adminLimiter } from "@/lib/ratelimit";

const orgSchema = z.object({
  name:           z.string().min(2).max(255),
  email:          z.string().email(),
  phone:          z.string().min(7).max(20),
  website:        z.string().url().optional().or(z.literal("")),
  address:        z.string().min(5),
  state:          z.string().min(2),
  lga:            z.string().min(2),
  city:           z.string().optional(),
  primaryColor:   z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex colour"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex colour"),
});

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await adminLimiter.limit(ip);
  if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

  const session = await auth();
  if (!session?.user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json(err("UNAUTHORIZED", "Unauthorized"), { status: 401 });
  }
  if (!session.user.organizationId) {
    return NextResponse.json(err("NOT_FOUND", "No organisation linked to this account"), { status: 404 });
  }

  const org = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      id: true, name: true, email: true, phone: true, website: true,
      address: true, state: true, lga: true, city: true,
      primaryColor: true, secondaryColor: true, logoUrl: true,
      subscriptionPlan: true, createdAt: true,
    },
  });

  if (!org) return NextResponse.json(err("NOT_FOUND", "Organisation not found"), { status: 404 });
  return NextResponse.json(ok(org));
}

export async function PATCH(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await adminLimiter.limit(ip);
  if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

  const session = await auth();
  if (!session?.user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json(err("UNAUTHORIZED", "Unauthorized"), { status: 401 });
  }
  if (!session.user.organizationId) {
    return NextResponse.json(err("NOT_FOUND", "No organisation linked"), { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = orgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()),
      { status: 422 },
    );
  }

  const updated = await db.organization.update({
    where: { id: session.user.organizationId },
    data: {
      ...parsed.data,
      website: parsed.data.website || null,
      city:    parsed.data.city    || null,
    },
    select: {
      id: true, name: true, email: true, phone: true, website: true,
      address: true, state: true, lga: true, city: true,
      primaryColor: true, secondaryColor: true, logoUrl: true,
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      userId:         session.user.id,
      organizationId: session.user.organizationId,
      action:         "UPDATE_ORGANISATION_SETTINGS",
      entityType:     "Organization",
      entityId:       updated.id,
      changes:        { after: parsed.data },
      ipAddress:      ip,
      userAgent:      req.headers.get("user-agent") ?? "",
    },
  }).catch(() => {});

  return NextResponse.json(ok(updated));
}
