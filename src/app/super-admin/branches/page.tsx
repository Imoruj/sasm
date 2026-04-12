import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import BranchesManager from "./BranchesManager";

export const metadata = {
  title: "Branches | SAMS Super Admin",
};

export default async function BranchesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const branches = await db.branch.findMany({
    where: { organizationId: session.user.organizationId ?? "" },
    include: {
      _count: {
        select: {
          applications: true,
          users: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalBranches = branches.length;
  const activeBranches = branches.filter((b) => b.isActive).length;
  const inactiveBranches = totalBranches - activeBranches;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Manage all school branches within your organization."
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Branches" },
        ]}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1B4332]/10">
              <Building2 className="h-5 w-5 text-[#1B4332]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalBranches}</p>
              <p className="text-sm text-gray-500">Total Branches</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeBranches}</p>
              <p className="text-sm text-gray-500">Active Branches</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{inactiveBranches}</p>
              <p className="text-sm text-gray-500">Inactive Branches</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <BranchesManager initialBranches={branches} />
    </div>
  );
}
