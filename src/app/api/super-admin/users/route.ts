import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, err } from "@/types/api";

/** Applicants linked to this org via applications (or organizationId if set). */
function applicantOrgWhere(orgId: string) {
  return {
    role: "APPLICANT" as const,
    deletedAt: null,
    OR: [
      { organizationId: orgId },
      { applications: { some: { organizationId: orgId } } },
    ],
  };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(err("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(err("FORBIDDEN", "Super admin access required"), { status: 403 });
    }

    const orgId = session.user.organizationId ?? "";
    const where = applicantOrgWhere(orgId);

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        emailVerified: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            applications: { where: { organizationId: orgId } },
          },
        },
        applications: {
          where: { organizationId: orgId },
          select: {
            id: true,
            applicationNumber: true,
            status: true,
            branch: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      ok({
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          phone: u.phone,
          firstName: u.firstName,
          lastName: u.lastName,
          avatarUrl: u.avatarUrl,
          emailVerified: u.emailVerified,
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          applicationCount: u._count.applications,
          latestApplication: u.applications[0]
            ? {
                id: u.applications[0].id,
                applicationNumber: u.applications[0].applicationNumber,
                status: u.applications[0].status,
                branchName: u.applications[0].branch.name,
              }
            : null,
        })),
        total: users.length,
      }),
    );
  } catch (error) {
    console.error("[GET_USERS]", error);
    return NextResponse.json(err("INTERNAL_ERROR", "Something went wrong."), { status: 500 });
  }
}
