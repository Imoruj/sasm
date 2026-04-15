import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();

  if (!session?.user) {
    return {};
  }

  const [directOrg, recentApplication] = await Promise.all([
    session.user.organizationId
      ? db.organization.findUnique({
          where: { id: session.user.organizationId },
          select: { name: true, logoUrl: true, updatedAt: true },
        })
      : Promise.resolve(null),
    db.application.findFirst({
      where: { applicantId: session.user.id },
      select: {
        organization: {
          select: { name: true, logoUrl: true, updatedAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const branding = directOrg ?? recentApplication?.organization ?? null;
  if (!branding?.logoUrl) {
    return {};
  }

  return {
    icons: {
      icon: `/api/favicon?v=${branding.updatedAt.getTime()}`,
      shortcut: `/api/favicon?v=${branding.updatedAt.getTime()}`,
      apple: `/api/favicon?v=${branding.updatedAt.getTime()}`,
    },
    title: {
      default: `${branding.name} | SAMS`,
      template: `%s | ${branding.name}`,
    },
  };
}

export default async function ApplicantLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Staff members may access sub-pages of the applicant portal (e.g. /dashboard/applications)
  // but hitting the root /dashboard itself redirects them to their own portal (handled in proxy).
  // Block any truly unknown roles.
  if (!["APPLICANT", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/login");
  }

  const [unreadCount, user, directOrg, recentApplication] = await Promise.all([
    db.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { avatarUrl: true },
    }),
    session.user.organizationId
      ? db.organization.findUnique({
          where: { id: session.user.organizationId },
          select: { name: true, logoUrl: true, updatedAt: true },
        })
      : Promise.resolve(null),
    db.application.findFirst({
      where: { applicantId: session.user.id },
      select: {
        organization: {
          select: { name: true, logoUrl: true, updatedAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const branding = directOrg ?? recentApplication?.organization ?? null;

  return (
    <DashboardLayout
      role="APPLICANT"
      userName={session.user.name}
      userEmail={session.user.email}
      userAvatar={user?.avatarUrl ?? null}
      unreadCount={unreadCount}
      orgName={branding?.name ?? "SAMS"}
      orgLogo={branding?.logoUrl ?? null}
    >
      {children}
    </DashboardLayout>
  );
}
