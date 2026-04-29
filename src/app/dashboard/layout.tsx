import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { resolveSessionOrganizationId } from "@/lib/tenant";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  if (!session?.user) return {};

  const orgId = await resolveSessionOrganizationId(session.user.id, session.user.organizationId);
  if (!orgId) return {};

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true, logoUrl: true, updatedAt: true },
  });
  if (!org?.logoUrl) return {};

  return {
    icons: {
      icon: `/api/favicon?v=${org.updatedAt.getTime()}`,
      shortcut: `/api/favicon?v=${org.updatedAt.getTime()}`,
      apple: `/api/favicon?v=${org.updatedAt.getTime()}`,
    },
    title: {
      default: `${org.name} | SAMS`,
      template: `%s | ${org.name}`,
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

  const orgId = await resolveSessionOrganizationId(session.user.id, session.user.organizationId);

  const [unreadCount, user, org] = await Promise.all([
    db.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { avatarUrl: true },
    }),
    orgId
      ? db.organization.findUnique({
          where: { id: orgId },
          select: { name: true, logoUrl: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <DashboardLayout
      role="APPLICANT"
      userName={session.user.name}
      userEmail={session.user.email}
      userAvatar={user?.avatarUrl ?? null}
      unreadCount={unreadCount}
      orgName={org?.name}
      orgLogo={org?.logoUrl ?? null}
    >
      {children}
    </DashboardLayout>
  );
}
