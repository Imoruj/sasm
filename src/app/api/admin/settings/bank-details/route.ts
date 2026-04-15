import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { ok, err } from "@/types/api";

const bankSchema = z.object({
  bankName:      z.string().min(2),
  accountName:   z.string().min(2),
  accountNumber: z.string().min(10).max(10),
  sortCode:      z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(err("FORBIDDEN", "Super admin access required"), { status: 403 });
    }

    const body = await req.json();
    const parsed = bankSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(err("VALIDATION_ERROR", "Invalid input", parsed.error.flatten()), { status: 400 });
    }

    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId ?? "" },
      select: { settings: true },
    });

    const currentSettings = (org?.settings ?? {}) as Record<string, unknown>;
    const newSettings = { ...currentSettings, bankDetails: parsed.data };

    await db.organization.update({
      where: { id: session.user.organizationId ?? "" },
      data: { settings: newSettings },
    });

    return NextResponse.json(ok(parsed.data));
  } catch (error) {
    console.error("[PATCH_BANK_DETAILS]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong"), { status: 500 });
  }
}
