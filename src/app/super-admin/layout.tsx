import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();

  if (!session?.user?.organizationId) {
    return {};
  }

  const org = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { logoUrl: true, name: true, updatedAt: true },
  });

  if (!org?.logoUrl) {
    return {};
  }

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

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const [org, user] = await Promise.all([
    session.user.organizationId
      ? db.organization.findUnique({
          where: { id: session.user.organizationId },
          select: { name: true, logoUrl: true },
        })
      : Promise.resolve(null),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { avatarUrl: true },
    }),
  ]);

  return (
    <DashboardLayout
      role="SUPER_ADMIN"
      userName={session.user.name}
      userEmail={session.user.email}
      userAvatar={user?.avatarUrl ?? null}
      orgName={org?.name}
      orgLogo={org?.logoUrl}
    >
      {children}
    </DashboardLayout>
  );
}
