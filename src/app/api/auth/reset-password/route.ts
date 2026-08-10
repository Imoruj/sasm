import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { resetPasswordSchema } from "@/validators/authSchema";
import { ok, err } from "@/types/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = resetPasswordSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()), { status: 400 });
    }

    const { email, otp, password } = validated.data;

    const token = await db.verificationToken.findFirst({
      where: { email, token: otp, type: "password_reset", expiresAt: { gt: new Date() }, usedAt: null },
    });

    if (!token) {
      return NextResponse.json(err("INVALID_OTP", "Invalid or expired reset code."), { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await Promise.all([
      db.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      db.user.update({
        where: { email },
        data: { passwordHash, mustChangePassword: false },
      }),
    ]);

    return NextResponse.json(ok({ reset: true }));
  } catch (error) {
    console.error("[RESET_PASSWORD]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
