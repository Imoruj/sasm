import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import PageHeader from "@/components/shared/PageHeader";
import CyclesManager from "./CyclesManager";

export default async function CyclesPage() {
  const session = await auth();
  const orgId = session!.user.organizationId ?? "";

  const cycles = await db.admissionCycle.findMany({
    where: { organizationId: orgId },
    include: {
      _count: { select: { applications: true, examSessions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Admission Cycles"
        description="Manage academic year admission periods"
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Admission Cycles" }]}
      />
      <CyclesManager initialCycles={cycles} />
    </div>
  );
}
