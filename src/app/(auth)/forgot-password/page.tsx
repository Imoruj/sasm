"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/layouts/AuthLayout";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/validators/authSchema";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data: ForgotPasswordInput) => {
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    // Navigate directly to the code entry page — user doesn't need a second click
    router.push(`/reset-password?email=${encodeURIComponent(data.email)}&sent=1`);
  };

  if (submitted) {
    return null; // unreachable — router.push navigates away
  }

  return (
    <AuthLayout title="Forgot password" description="Enter your email to receive a reset code">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
          {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#1B4332] hover:bg-[#2D6A4F]"
        >
          {isSubmitting ? "Sending..." : "Send reset code"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-[#1B4332] hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
