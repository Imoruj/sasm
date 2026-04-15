import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { registerSchema } from "@/validators/authSchema";
import { ok, err } from "@/types/api";
import { sendOtpEmail } from "@/lib/email";
import { normalizeNigerianPhone } from "@/lib/utils";
import { authLimiter } from "@/lib/ratelimit";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success: allowed } = await authLimiter.limit(ip);
    if (!allowed) {
      return NextResponse.json(err("RATE_LIMIT", "Too many requests. Please try again later."), { status: 429 });
    }

    const body = await req.json();
    const validated = registerSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
    }

    const { firstName, lastName, email, phone, password } = validated.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      // If they are a staff member, tell them to log in with their staff credentials
      if (existing.role === "SCHOOL_ADMIN" || existing.role === "SUPER_ADMIN") {
        return NextResponse.json(
          err("STAFF_ACCOUNT", "This email is registered as a staff account. Log in with your staff credentials to access the applicant portal."),
          { status: 409 }
        );
      }
      return NextResponse.json(err("EMAIL_EXISTS", "An account with this email already exists."), { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const normalizedPhone = phone ? normalizeNigerianPhone(phone) : undefined;

    if (normalizedPhone) {
      const phoneExists = await db.user.findUnique({ where: { phone: normalizedPhone } });
      if (phoneExists) {
        return NextResponse.json(err("PHONE_EXISTS", "An account with this phone number already exists."), { status: 409 });
      }
    }

    const user = await db.user.create({
      data: {
        email,
        firstName,
        lastName,
        passwordHash,
        phone: normalizedPhone,
        role: "APPLICANT",
      },
    });

    // Create OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.verificationToken.create({
      data: { email, token: otp, type: "email_verify", expiresAt },
    });

    // Send verification email
    try {
      const org = await db.organization.findFirst({ select: { name: true } });
      await sendOtpEmail(email, otp, firstName, org?.name ?? "SAMS");
    } catch {
      // Don't fail registration if email fails
    }

    return NextResponse.json(ok({ id: user.id, email: user.email }), { status: 201 });
  } catch (error) {
    console.error("[REGISTER]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong. Please try again."), { status: 500 });
  }
}
