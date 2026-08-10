import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { normalizeStaffPermissions } from "@/lib/staffAccess";
import StaffManager from "./StaffManager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const orgId = session.user.organizationId ?? "";

  const [staff, branches] = await Promise.all([
    db.user.findMany({
      where: {
        organizationId: orgId,
        role: { in: ["SCHOOL_ADMIN", "SUPER_ADMIN"] },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        emailVerified: true,
        organizationId: true,
        branchId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        permissions: true,
        branch: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.branch.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalStaff = staff.length;
  const schoolAdmins = staff.filter((s) => s.role === "SCHOOL_ADMIN").length;
  const superAdmins = staff.filter((s) => s.role === "SUPER_ADMIN").length;
  const activeStaff = staff.filter((s) => s.isActive).length;
  const inactiveStaff = staff.filter((s) => !s.isActive).length;

  return (
    <div>
      <PageHeader
        title="Staff Management"
        description={`${totalStaff} staff account${totalStaff !== 1 ? "s" : ""} across all branches`}
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Staff" },
        ]}
      />

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Total Staff</p>
            <p className="mt-0.5 text-2xl font-bold text-foreground">{totalStaff}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs font-medium text-muted-foreground">School Admins</p>
            <p className="mt-0.5 text-2xl font-bold text-blue-600">{schoolAdmins}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Super Admins</p>
            <p className="mt-0.5 text-2xl font-bold text-[#1B4332]">{superAdmins}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Active / Inactive</p>
            <p className="mt-0.5 text-2xl font-bold text-foreground">
              <span className="text-green-600">{activeStaff}</span>
              <span className="text-muted-foreground text-base"> / </span>
              <span className="text-gray-400">{inactiveStaff}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <StaffManager
        initialStaff={staff.map((s) => ({
          ...s,
          role: s.role as "SCHOOL_ADMIN" | "SUPER_ADMIN",
          lastLoginAt: s.lastLoginAt ? s.lastLoginAt.toISOString() : null,
          createdAt: s.createdAt.toISOString(),
          permissions: normalizeStaffPermissions(s.permissions),
        }))}
        branches={branches}
        total={totalStaff}
        currentUserId={session.user.id}
      />
    </div>
  );
}
