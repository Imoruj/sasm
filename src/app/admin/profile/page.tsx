import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Shield, User } from "lucide-react";
import ProfileEditForm from "@/app/dashboard/profile/ProfileEditForm";
import ChangePasswordForm from "@/app/dashboard/profile/ChangePasswordForm";
import AvatarUpload from "@/components/shared/AvatarUpload";

export default async function AdminProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, email: true, phone: true, role: true,
      firstName: true, lastName: true, avatarUrl: true,
      emailVerified: true, twoFactorEnabled: true,
      lastLoginAt: true, createdAt: true,
    },
  });

  if (!user) redirect("/login");

  const ROLE_LABELS: Record<string, string> = {
    SCHOOL_ADMIN: "School Admin",
    SUPER_ADMIN:  "Super Admin",
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="My Profile"
        description="Manage your account information and security settings"
        breadcrumbs={[
          { label: "Admin",   href: "/admin" },
          { label: "Profile" },
        ]}
      />

      {/* Summary card */}
      <Card className="mb-6">
        <CardContent className="py-5">
          <div className="flex items-center gap-4">
            <AvatarUpload
              size={56}
              shape="circle"
              currentUrl={user.avatarUrl}
              fallback={`${user.firstName.charAt(0).toUpperCase()}${user.lastName.charAt(0).toUpperCase()}`}
              folder="avatar"
              saveEndpoint="/api/profile/avatar"
              saveField="avatarUrl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">
                  {user.firstName} {user.lastName}
                </h2>
                <Badge>{ROLE_LABELS[user.role] ?? user.role}</Badge>
                {user.emailVerified && (
                  <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                    Verified
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">{user.email}</p>
              {user.lastLoginAt && (
                <p className="mt-0.5 text-xs text-gray-400">Last login: {formatDateTime(user.lastLoginAt)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList variant="default">
          <TabsTrigger value="personal" className="gap-1.5 px-3 py-1.5">
            <User className="h-4 w-4" /> Personal Info
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 px-3 py-1.5">
            <Shield className="h-4 w-4" /> Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <CardContent className="py-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Account Details</h3>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Email Address</p>
                  <p className="text-sm font-medium text-gray-900">{user.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Email cannot be changed after registration.</p>
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Personal Information</h3>
                <ProfileEditForm
                  initialData={{
                    firstName: user.firstName,
                    lastName:  user.lastName,
                    phone:     user.phone ?? "",
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardContent className="py-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Change Password</h3>
                <p className="text-sm text-gray-500 mb-6">Choose a strong password you don&apos;t use elsewhere.</p>
                <ChangePasswordForm />
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Account Activity</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between py-1">
                    <dt className="text-gray-500">Account created</dt>
                    <dd className="font-medium text-gray-900">{formatDateTime(user.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-gray-500">Last login</dt>
                    <dd className="font-medium text-gray-900">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-gray-500">Email verified</dt>
                    <dd className={user.emailVerified ? "font-medium text-green-700" : "font-medium text-amber-600"}>
                      {user.emailVerified ? "Yes" : "Pending"}
                    </dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-gray-500">Two-factor authentication</dt>
                    <dd className={user.twoFactorEnabled ? "font-medium text-green-700" : "font-medium text-gray-400"}>
                      {user.twoFactorEnabled ? "Enabled" : "Disabled"}
                    </dd>
                  </div>
                </dl>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
