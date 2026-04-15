import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Users,
  FileText,
  GraduationCap,
  Settings,
  ExternalLink,
  Palette,
  Calendar,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function OrganizationsPage() {
  const session = await auth();
  const orgId = session!.user.organizationId ?? "";

  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      branches: {
        where: { isActive: true },
        select: { id: true, name: true, code: true, state: true, capacity: true, _count: { select: { applications: true, users: true } } },
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          branches: true,
          users: true,
          applications: true,
          admissionCycles: true,
        },
      },
    },
  });

  if (!org) notFound();

  const activeCycle = await db.admissionCycle.findFirst({
    where: { organizationId: orgId, status: "OPEN" },
    select: { name: true, academicYear: true, startDate: true, endDate: true },
  });

  return (
    <div>
      <PageHeader
        title="Organisation"
        description="Your organisation profile and branch overview"
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Organisation" }]}
        actions={
          <Link href="/super-admin/settings">
            <Button variant="outline" size="sm">
              <Settings className="mr-1.5 h-4 w-4" />
              Edit Settings
            </Button>
          </Link>
        }
      />

      <div className="space-y-6">
        {/* Org identity card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start gap-6">
              {/* Logo / avatar */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-white text-xl font-bold"
                   style={{ backgroundColor: org.primaryColor }}>
                {org.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{org.name}</h2>
                  <Badge variant={org.isActive ? "default" : "secondary"}>
                    {org.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs">{org.subscriptionPlan}</Badge>
                </div>

                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-gray-400" />{org.email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-gray-400" />{org.phone}
                  </span>
                  {org.website && (
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-blue-600 hover:underline"
                    >
                      <Globe className="h-4 w-4" />
                      {org.website.replace(/^https?:\/\//, "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-500">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {org.address}, {org.city ? `${org.city}, ` : ""}{org.lga}, {org.state}
                </div>
              </div>

              {/* Brand colors */}
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="h-5 w-5 rounded border" style={{ backgroundColor: org.primaryColor }} />
                    <span className="font-mono">{org.primaryColor}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded border" style={{ backgroundColor: org.secondaryColor }} />
                    <span className="font-mono">{org.secondaryColor}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Branches", value: org._count.branches, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Total Users", value: org._count.users, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Applications", value: org._count.applications, icon: FileText, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Admission Cycles", value: org._count.admissionCycles, icon: GraduationCap, color: "text-green-600", bg: "bg-green-50" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">{stat.label}</CardTitle>
                  <div className={`rounded-lg p-2 ${stat.bg}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Active cycle banner */}
        {activeCycle && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-900">Active Admission Cycle</p>
                  <p className="text-xs text-green-700">
                    {activeCycle.name} ({activeCycle.academicYear}) ·{" "}
                    {formatDate(activeCycle.startDate)} — {formatDate(activeCycle.endDate)}
                  </p>
                </div>
              </div>
              <Link href="/super-admin/cycles">
                <Button size="sm" variant="outline" className="border-green-300 text-green-800 hover:bg-green-100">
                  Manage Cycles
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Branches list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Active Branches</CardTitle>
            <Link href="/super-admin/branches">
              <Button variant="ghost" size="sm" className="text-sm text-[#1B4332]">
                Manage <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {org.branches.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No active branches</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {["Branch", "Location", "Capacity", "Applications", "Staff"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {org.branches.map((branch) => (
                      <tr key={branch.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{branch.name}</p>
                          <p className="text-xs font-mono text-gray-400">{branch.code}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{branch.state}</td>
                        <td className="px-4 py-3 text-gray-700">{branch.capacity.toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{branch._count.applications}</td>
                        <td className="px-4 py-3 text-gray-600">{branch._count.users}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Edit Organisation Profile", href: "/super-admin/settings", icon: Settings, desc: "Update name, contact, branding" },
            { label: "Manage Staff", href: "/super-admin/staff", icon: Users, desc: "Add or remove admin accounts" },
            { label: "Admission Cycles", href: "/super-admin/cycles", icon: GraduationCap, desc: "Configure academic year cycles" },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="flex items-start gap-3 py-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1B4332]/10 text-[#1B4332]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{link.label}</p>
                      <p className="text-xs text-gray-400">{link.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
