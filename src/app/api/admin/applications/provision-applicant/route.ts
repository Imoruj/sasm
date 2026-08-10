import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { sendApplicantWelcomeEmail } from "@/lib/email";
import { adminLimiter } from "@/lib/ratelimit";
import { z } from "zod";

const schema = z.object({
  applicantEmail: z.string().email(),
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
});

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#$!";
  const all = upper + lower + digits + special;
  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  // Guarantee at least one of each character class
  const required = [rand(upper), rand(lower), rand(digits), rand(special)];
  const rest = Array.from({ length: 5 }, () => rand(all));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await adminLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(err("FORBIDDEN", "Admin access required"), { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()), { status: 400 });
    }

    const { applicantEmail, firstName, lastName } = parsed.data;
    const orgId = session.user.organizationId ?? "";

    // Load org name for the welcome email
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    const orgName = org?.name ?? "School";

    // Check if user already exists
    const existing = await db.user.findUnique({
      where: { email: applicantEmail },
      select: { id: true, role: true, emailVerified: true },
    });

    if (existing) {
      // Account already exists — return it directly so the wizard can proceed
      return NextResponse.json(ok({ userId: existing.id, created: false }));
    }

    // Derive name from email if not provided
    const emailPrefix = applicantEmail.split("@")[0].replace(/[._-]/g, " ");
    const resolvedFirst = firstName?.trim() || emailPrefix.split(" ")[0] || "Applicant";
    const resolvedLast  = lastName?.trim()  || emailPrefix.split(" ").slice(1).join(" ") || "";

    const plainPassword = generatePassword();
    const passwordHash  = await bcrypt.hash(plainPassword, 12);

    const newUser = await db.user.create({
      data: {
        email: applicantEmail,
        firstName: resolvedFirst,
        lastName: resolvedLast,
        passwordHash,
        role: "APPLICANT",
        emailVerified: true, // admin-created accounts skip OTP verification
        isActive: true,
        mustChangePassword: true,
      },
      select: { id: true },
    });

    // Send welcome email (fire-and-forget — don't block the wizard)
    sendApplicantWelcomeEmail(
      applicantEmail,
      resolvedFirst,
      plainPassword,
      orgName,
    ).catch((e) => console.error("[PROVISION_APPLICANT_EMAIL]", e));

    return NextResponse.json(ok({ userId: newUser.id, created: true }), { status: 201 });
  } catch (error) {
    console.error("[PROVISION_APPLICANT]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
