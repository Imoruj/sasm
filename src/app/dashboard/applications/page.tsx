import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ApplicationsTable from "./ApplicationsTable";

export default async function ApplicationsPage() {
  const session = await auth();

  const applications = await db.application.findMany({
    where: { applicantId: session!.user.id },
    include: {
      branch: { select: { name: true } },
      admissionCycle: { select: { academicYear: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="My Applications"
        description="Track all your school applications"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Applications" }]}
        actions={
          <Button className="bg-[#1B4332] hover:bg-[#2D6A4F]" asChild>
            <Link href="/dashboard/applications/new">
              <Plus className="mr-2 h-4 w-4" /> New Application
            </Link>
          </Button>
        }
      />

      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              icon={FileText}
              title="No applications yet"
              description="Create your first application to get the process started."
              action={
                <Button className="bg-[#1B4332] hover:bg-[#2D6A4F]" asChild>
                  <Link href="/dashboard/applications/new">Start application</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <ApplicationsTable applications={applications} />
      )}
    </div>
  );
}
