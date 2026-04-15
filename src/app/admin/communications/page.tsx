import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import PageHeader from "@/components/shared/PageHeader";
import CommunicationsClient from "./CommunicationsClient";

export default async function CommunicationsPage() {
  const session = await auth();
  const orgId = session!.user.organizationId ?? "";
  const branchId = session!.user.branchId ?? null;

  const [logsRaw, branches] = await Promise.all([
    db.auditLog.findMany({
      where: {
        organizationId: orgId,
        action: "COMMUNICATION_SENT",
      },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.branch.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Serialize dates for the client component
  const logs = logsRaw.map((log) => ({
    ...log,
    changes: log.changes as Record<string, unknown> | null,
  }));

  return (
    <div>
      <PageHeader
        title="Communications"
        description="Send announcements and updates to applicants"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Communications" }]}
      />
      <CommunicationsClient
        initialLogs={logs}
        branches={branches}
        isBranchAdmin={!!branchId}
      />
    </div>
  );
}
