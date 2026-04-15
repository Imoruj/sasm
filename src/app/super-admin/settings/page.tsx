import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import PageHeader from "@/components/shared/PageHeader";
import SuperAdminSettingsClient from "./SettingsClient";

export default async function SuperAdminSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/login");

  const orgId = session.user.organizationId ?? "";

  const [org, cycles, fees, rawSettings] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true, name: true, email: true, phone: true, website: true,
        address: true, state: true, lga: true, city: true,
        primaryColor: true, secondaryColor: true, logoUrl: true,
      },
    }),
    db.admissionCycle.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, academicYear: true, status: true, isDefault: true, startDate: true, endDate: true },
      orderBy: { createdAt: "desc" },
    }),
    db.feeStructure.findMany({
      where: { organizationId: orgId, branchId: null, classLevel: null, isActive: true },
      select: { id: true, paymentType: true, amountKobo: true, admissionCycleId: true },
    }),
    db.$queryRaw<{ settings: unknown }[]>`
      SELECT settings FROM organizations WHERE id = ${orgId}::uuid LIMIT 1
    `,
  ]);

  if (!org) redirect("/super-admin");

  const settings = (rawSettings[0]?.settings as Record<string, unknown>) ?? {};

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="App Settings"
        description="Configure your organisation, fees, notifications, and security"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "App Settings" },
        ]}
      />
      <SuperAdminSettingsClient
        org={{ ...org, settings }}
        cycles={cycles}
        fees={fees}
      />
    </div>
  );
}
