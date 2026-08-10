import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import UsersManager, { type ApplicantUser } from "./UsersManager";
import type { ApplicationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const orgId = session.user.organizationId ?? "";

  const users = await db.user.findMany({
    where: {
      role: "APPLICANT",
      deletedAt: null,
    },
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

  const initialUsers: ApplicantUser[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    avatarUrl: u.avatarUrl,
    emailVerified: u.emailVerified,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    applicationCount: u._count.applications,
    latestApplication: u.applications[0]
      ? {
          id: u.applications[0].id,
          applicationNumber: u.applications[0].applicationNumber,
          status: u.applications[0].status as ApplicationStatus,
          branchName: u.applications[0].branch.name,
        }
      : null,
  }));

  const total = initialUsers.length;
  const active = initialUsers.filter((u) => u.isActive).length;
  const inactive = total - active;
  const withApps = initialUsers.filter((u) => u.applicationCount > 0).length;

  return (
    <div>
      <PageHeader
        title="All User Accounts"
        description={`${total} applicant account${total !== 1 ? "s" : ""} (staff excluded)`}
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Users" },
        ]}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Total Users</p>
            <p className="mt-0.5 text-2xl font-bold text-foreground">{total}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs font-medium text-muted-foreground">With Applications</p>
            <p className="mt-0.5 text-2xl font-bold text-blue-600">{withApps}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Active</p>
            <p className="mt-0.5 text-2xl font-bold text-green-600">{active}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Inactive</p>
            <p className="mt-0.5 text-2xl font-bold text-gray-400">{inactive}</p>
          </CardContent>
        </Card>
      </div>

      <UsersManager initialUsers={initialUsers} total={total} />
    </div>
  );
}
