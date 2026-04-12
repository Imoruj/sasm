import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import PageHeader from "@/components/shared/PageHeader";
import SettingsClient from "./SettingsClient";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user || !["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/login");
  }
  if (!session.user.organizationId) redirect("/admin");

  const orgId = session.user.organizationId;

  const [org, cycles, fees, user] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true, name: true, email: true, phone: true, website: true,
        address: true, state: true, lga: true, city: true,
        primaryColor: true, secondaryColor: true, logoUrl: true,
      },
    }),
    db.admissionCycle.findMany({
      where: { organizationId: orgId, status: { in: ["OPEN", "DRAFT"] } },
      select: { id: true, name: true, academicYear: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
    db.feeStructure.findMany({
      where: { organizationId: orgId, branchId: null, classLevel: null, isActive: true },
      select: { id: true, paymentType: true, amountKobo: true, admissionCycleId: true },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true, phone: true, avatarUrl: true },
    }),
  ]);

  if (!org) redirect("/admin");

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Settings"
        description="Manage your school details, fee structure, and account"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Settings" },
        ]}
      />
      <SettingsClient
        org={org}
        cycles={cycles}
        fees={fees}
        profile={{
          firstName: user?.firstName ?? "",
          lastName:  user?.lastName  ?? "",
          phone:     user?.phone     ?? "",
          avatarUrl: user?.avatarUrl ?? null,
        }}
      />
    </div>
  );
}
