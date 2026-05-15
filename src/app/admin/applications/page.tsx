import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ApplicationStatus } from "@prisma/client";
import Link from "next/link";
import { FilePlus2, RefreshCw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import ApplicationsListClient from "./ApplicationsListClient";

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const limit = 20;

  const where = {
    organizationId: session!.user.organizationId ?? "",
    ...(session!.user.branchId ? { branchId: session!.user.branchId } : {}),
    ...(params.status ? { status: params.status as ApplicationStatus } : {}),
    ...(params.search
      ? {
          OR: [
            { applicationNumber: { contains: params.search, mode: "insensitive" as const } },
            { studentFirstName:  { contains: params.search, mode: "insensitive" as const } },
            { studentLastName:   { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [applications, total] = await Promise.all([
    db.application.findMany({
      where,
      include: {
        branch:    { select: { name: true } },
        applicant: { select: { email: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.application.count({ where }),
  ]);

  const statuses: ApplicationStatus[] = [
    "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVISION_REQUIRED",
  ];

  return (
    <div>
      <PageHeader
        title="Applications"
        description={`${total} total application${total !== 1 ? "s" : ""}`}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Applications" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/applications/start?mode=resume">
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Resume Application
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/applications/start?mode=new">
                <FilePlus2 className="h-4 w-4 mr-1.5" />
                New Application
              </Link>
            </Button>
          </div>
        }
      />

      <Suspense>
        <ApplicationsListClient
          applications={applications}
          total={total}
          statuses={statuses}
          currentStatus={params.status}
          currentSearch={params.search}
          page={page}
          limit={limit}
        />
      </Suspense>
    </div>
  );
}
