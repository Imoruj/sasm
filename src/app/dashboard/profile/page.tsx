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
import ProfileEditForm from "./ProfileEditForm";
import ChangePasswordForm from "./ChangePasswordForm";
import AvatarUpload from "@/components/shared/AvatarUpload";

const ROLE_LABELS: Record<string, string> = {
  APPLICANT: "Applicant",
  SCHOOL_ADMIN: "School Admin",
  SUPER_ADMIN: "Super Admin",
};

const ROLE_BADGE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  APPLICANT: "secondary",
  SCHOOL_ADMIN: "default",
  SUPER_ADMIN: "default",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      emailVerified: true,
      phoneVerified: true,
      twoFactorEnabled: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="My Profile"
        description="Manage your account information and security settings."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Profile" },
        ]}
      />

      {/* Profile summary card */}
      <Card className="mb-6">
        <CardContent className="py-5">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <AvatarUpload
              size={64}
              shape="circle"
              currentUrl={user.avatarUrl}
              fallback={`${user.firstName.charAt(0).toUpperCase()}${user.lastName.charAt(0).toUpperCase()}`}
              folder="avatar"
              saveEndpoint="/api/profile/avatar"
              saveField="avatarUrl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 truncate">
                  {user.firstName} {user.lastName}
                </h2>
                <Badge variant={ROLE_BADGE_VARIANTS[user.role] ?? "outline"}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </Badge>
                {user.emailVerified && (
                  <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                    Verified
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">{user.email}</p>
              {user.lastLoginAt && (
                <p className="mt-0.5 text-xs text-gray-400">
                  Last login: {formatDateTime(user.lastLoginAt)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList
          variant="default"
          className="h-auto w-full sm:w-auto"
        >
          <TabsTrigger value="personal" className="gap-1.5 px-3 py-1.5">
            <User className="h-4 w-4" />
            Personal Info
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 px-3 py-1.5">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Personal Info Tab */}
        <TabsContent value="personal">
          <Card>
            <CardContent className="py-6 space-y-6">
              {/* Read-only email */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Account Details</h3>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                    Email Address
                  </p>
                  <p className="text-sm font-medium text-gray-900">{user.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Email address cannot be changed after registration.
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Personal Information</h3>
                <ProfileEditForm
                  initialData={{
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone ?? "",
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardContent className="py-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Change Password</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Choose a strong password that you don&apos;t use elsewhere.
                </p>
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
                    <dd>
                      {user.emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                          Yes
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">Pending</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between py-1">
                    <dt className="text-gray-500">Two-factor authentication</dt>
                    <dd>
                      {user.twoFactorEnabled ? (
                        <span className="text-green-700 font-medium">Enabled</span>
                      ) : (
                        <span className="text-gray-400 font-medium">Disabled</span>
                      )}
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
