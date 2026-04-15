"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/layouts/AuthLayout";
import { resetPasswordSchema, type ResetPasswordInput } from "@/validators/authSchema";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    setServerError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      setServerError(json.error?.message ?? "Reset failed. Please try again.");
      return;
    }
    router.push("/login?reset=1");
  };

  return (
    <AuthLayout title="Set new password" description="Enter your reset code and choose a new password">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
        {serverError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
        )}

        <input type="hidden" {...register("email")} value={email} />

        <div className="space-y-1.5">
          <Label htmlFor="otp">Reset code</Label>
          <Input id="otp" placeholder="6-digit code" maxLength={6} {...register("otp")} />
          {errors.otp && <p className="text-xs text-red-600">{errors.otp.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" placeholder="Min. 8 characters" {...register("password")} />
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" placeholder="Repeat new password" {...register("confirmPassword")} />
          {errors.confirmPassword && <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>}
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full bg-[#1B4332] hover:bg-[#2D6A4F]">
          {isSubmitting ? "Updating..." : "Set new password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link href="/forgot-password" className="font-medium text-[#1B4332] hover:underline">
          Resend code
        </Link>
      </p>
    </AuthLayout>
  );
}
