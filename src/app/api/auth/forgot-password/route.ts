import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/validators/authSchema";
import { ok, err } from "@/types/api";
import { sendPasswordResetEmail } from "@/lib/email";
import { authLimiter } from "@/lib/ratelimit";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success: allowed } = await authLimiter.limit(ip);
    if (!allowed) {
      return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });
    }

    const body = await req.json();
    const validated = forgotPasswordSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid email"), { status: 400 });
    }

    const { email } = validated.data;
    const user = await db.user.findUnique({ where: { email }, select: { id: true, firstName: true } });

    // Always return success to prevent email enumeration
    if (!user) return NextResponse.json(ok({ sent: true }));

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.verificationToken.create({
      data: { email, token: otp, type: "password_reset", expiresAt },
    });

    try {
      const org = await db.organization.findFirst({ select: { name: true } });
      await sendPasswordResetEmail(email, otp, user.firstName, org?.name ?? "SAMS");
    } catch {
      // Don't fail silently in prod - but don't expose error to client
    }

    return NextResponse.json(ok({ sent: true }));
  } catch (error) {
    console.error("[FORGOT_PASSWORD]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
