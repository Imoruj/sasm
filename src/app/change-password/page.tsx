"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AuthLayout from "@/components/layouts/AuthLayout";
import ChangePasswordForm from "@/app/dashboard/profile/ChangePasswordForm";
import { Button } from "@/components/ui/button";

export default function ForceChangePasswordPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && session?.user && !session.user.mustChangePassword) {
      const role = session.user.role;
      const dest =
        role === "SUPER_ADMIN"
          ? "/super-admin"
          : role === "SCHOOL_ADMIN"
            ? "/admin"
            : "/dashboard";
      router.replace(dest);
    }
  }, [status, session, router]);

  async function handleSuccess() {
    await update();
    const role = session?.user?.role;
    const dest =
      role === "SUPER_ADMIN"
        ? "/super-admin"
        : role === "SCHOOL_ADMIN"
          ? "/admin"
          : "/dashboard";
    router.replace(dest);
    router.refresh();
  }

  if (status === "loading") {
    return (
      <AuthLayout title="Update your password" description="Please wait...">
        <p className="text-center text-sm text-muted-foreground">Loading...</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Change your password"
      description="Your password was reset to a temporary default. Choose a new password before continuing."
    >
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        For your security, you must set a new password before accessing your account.
      </div>
      <ChangePasswordForm
        forced
        submitLabel="Set new password"
        onSuccess={handleSuccess}
      />
      <div className="mt-6 text-center">
        <Button
          type="button"
          variant="ghost"
          className="text-sm text-muted-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out instead
        </Button>
      </div>
    </AuthLayout>
  );
}
