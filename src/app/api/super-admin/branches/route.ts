import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

const createBranchSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(20)
    .regex(/^[A-Z0-9_-]+$/i, "Code must be alphanumeric"),
  address: z.string().min(5, "Address is required"),
  state: z.string().min(1, "State is required"),
  lga: z.string().min(1, "LGA is required"),
  city: z.string().max(100).optional().default(""),
  phone: z
    .string()
    .regex(
      /^(\+234|0)[789][01]\d{8}$/,
      "Enter a valid Nigerian phone number"
    ),
  email: z.string().email("Enter a valid email address"),
  capacity: z.number().int().min(1, "Capacity must be at least 1"),
  contactPerson: z
    .string()
    .min(2, "Contact person name is required")
    .max(255),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        err("UNAUTHORIZED", "Authentication required"),
        { status: 401 }
      );
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        err("FORBIDDEN", "Insufficient permissions"),
        { status: 403 }
      );
    }

    const branches = await db.branch.findMany({
      where: { organizationId: session.user.organizationId ?? "" },
      include: {
        _count: {
          select: {
            applications: true,
            users: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      ok({ branches, total: branches.length })
    );
  } catch (error) {
    console.error("[GET_BRANCHES]", error);
    return NextResponse.json(
      err("INTERNAL_ERROR", "Something went wrong."),
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        err("UNAUTHORIZED", "Authentication required"),
        { status: 401 }
      );
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        err("FORBIDDEN", "Insufficient permissions"),
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = createBranchSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    const organizationId = session.user.organizationId ?? "";

    // Check for unique code within organization
    const existing = await db.branch.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: validated.data.code.toUpperCase(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        err(
          "DUPLICATE",
          `A branch with code "${validated.data.code.toUpperCase()}" already exists.`
        ),
        { status: 409 }
      );
    }

    const branch = await db.$transaction(async (tx) => {
      const newBranch = await tx.branch.create({
        data: {
          organizationId,
          name: validated.data.name,
          code: validated.data.code.toUpperCase(),
          address: validated.data.address,
          state: validated.data.state,
          lga: validated.data.lga,
          city: validated.data.city ?? "",
          phone: validated.data.phone,
          email: validated.data.email,
          capacity: validated.data.capacity,
          contactPerson: validated.data.contactPerson,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId,
          action: "BRANCH_CREATED",
          entityType: "Branch",
          entityId: newBranch.id,
          changes: { after: newBranch },
          ipAddress: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
          userAgent: req.headers.get("user-agent") ?? "",
        },
      });

      return newBranch;
    });

    return NextResponse.json(ok(branch), { status: 201 });
  } catch (error) {
    console.error("[CREATE_BRANCH]", error);
    return NextResponse.json(
      err("INTERNAL_ERROR", "Something went wrong."),
      { status: 500 }
    );
  }
}
