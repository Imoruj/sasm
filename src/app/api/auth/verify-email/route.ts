import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { otpSchema } from "@/validators/authSchema";
import { ok, err } from "@/types/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = otpSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input"), { status: 400 });
    }

    const { email, otp } = validated.data;

    const token = await db.verificationToken.findFirst({
      where: {
        email,
        token: otp,
        type: "email_verify",
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });

    if (!token) {
      return NextResponse.json(err("INVALID_OTP", "Invalid or expired verification code."), { status: 400 });
    }

    await Promise.all([
      db.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      db.user.update({ where: { email }, data: { emailVerified: true } }),
    ]);

    return NextResponse.json(ok({ verified: true }));
  } catch (error) {
    console.error("[VERIFY_EMAIL]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
