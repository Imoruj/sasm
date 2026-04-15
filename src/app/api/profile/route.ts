import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";
import { applicantLimiter } from "@/lib/ratelimit";

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, "Invalid Nigerian phone number")
    .optional()
    .or(z.literal("")),
  guardianTitle: z.string().max(20).optional(),
  occupation: z.string().max(255).optional(),
  employer: z.string().max(255).optional(),
  residentialAddress: z.string().max(500).optional(),
  state: z.string().max(50).optional(),
  lga: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  secondaryPhone: z.string().max(20).optional().or(z.literal("")),
  emergencyContactName: z.string().max(255).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
  emergencyContactRelation: z.string().max(50).optional(),
});

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await applicantLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        emailVerified: true,
        phoneVerified: true,
        twoFactorEnabled: true,
        organizationId: true,
        branchId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        applicantProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(err("NOT_FOUND", "User not found"), { status: 404 });
    }

    return NextResponse.json(ok({ user }));
  } catch (error) {
    console.error("[GET_PROFILE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await applicantLimiter.limit(ip);
    if (!success) return NextResponse.json(err("RATE_LIMIT", "Too many requests."), { status: 429 });

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const body = await req.json();
    const validated = updateProfileSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid input", validated.error.flatten()),
        { status: 400 }
      );
    }

    const {
      firstName,
      lastName,
      phone,
      guardianTitle,
      occupation,
      employer,
      residentialAddress,
      state,
      lga,
      city,
      secondaryPhone,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
    } = validated.data;

    // Build the user update data
    const userUpdateData: Record<string, unknown> = {};
    if (firstName !== undefined) userUpdateData.firstName = firstName;
    if (lastName !== undefined) userUpdateData.lastName = lastName;
    if (phone !== undefined) userUpdateData.phone = phone === "" ? null : phone;

    // Fetch current user for audit log
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        organizationId: true,
        role: true,
        applicantProfile: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json(err("NOT_FOUND", "User not found"), { status: 404 });
    }

    // Update user record
    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: userUpdateData,
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        emailVerified: true,
        phoneVerified: true,
        twoFactorEnabled: true,
        organizationId: true,
        branchId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        applicantProfile: true,
      },
    });

    // For APPLICANT role, upsert the applicant profile
    if (currentUser.role === "APPLICANT") {
      const profileData: Record<string, unknown> = {};
      if (guardianTitle !== undefined) profileData.guardianTitle = guardianTitle;
      if (occupation !== undefined) profileData.occupation = occupation;
      if (employer !== undefined) profileData.employer = employer;
      if (residentialAddress !== undefined) profileData.residentialAddress = residentialAddress;
      if (state !== undefined) profileData.state = state;
      if (lga !== undefined) profileData.lga = lga;
      if (city !== undefined) profileData.city = city;
      if (secondaryPhone !== undefined)
        profileData.secondaryPhone = secondaryPhone === "" ? null : secondaryPhone;
      if (emergencyContactName !== undefined)
        profileData.emergencyContactName = emergencyContactName;
      if (emergencyContactPhone !== undefined)
        profileData.emergencyContactPhone = emergencyContactPhone;
      if (emergencyContactRelation !== undefined)
        profileData.emergencyContactRelation = emergencyContactRelation;

      if (Object.keys(profileData).length > 0) {
        await db.applicantProfile.upsert({
          where: { userId: session.user.id },
          update: profileData,
          create: {
            userId: session.user.id,
            ...profileData,
          },
        });
      }
    }

    // Write audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: currentUser.organizationId ?? undefined,
        action: "PROFILE_UPDATED",
        entityType: "User",
        entityId: session.user.id,
        changes: {
          before: {
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            phone: currentUser.phone,
          },
          after: {
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            phone: updatedUser.phone,
          },
        },
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    });

    return NextResponse.json(ok({ user: updatedUser }));
  } catch (error) {
    console.error("[PATCH_PROFILE]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
