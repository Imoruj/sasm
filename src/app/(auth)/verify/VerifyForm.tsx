"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/layouts/AuthLayout";
import { otpSchema, type OtpInput } from "@/validators/authSchema";

export default function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [serverError, setServerError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (resendCountdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpInput>({
    resolver: zodResolver(otpSchema),
    defaultValues: { email },
  });

  const onSubmit = async (data: OtpInput) => {
    setServerError("");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      setServerError(json.error?.message ?? "Invalid OTP. Please try again.");
      return;
    }
    router.push("/login?verified=1");
  };

  const handleResend = async () => {
    setCanResend(false);
    setResendCountdown(60);
    await fetch("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  };

  return (
    <AuthLayout title="Verify your email" description={`We sent a 6-digit code to ${email}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
        )}

        <input type="hidden" {...register("email")} value={email} />

        <div className="space-y-1.5">
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            placeholder="123456"
            maxLength={6}
            className="text-center text-2xl tracking-widest"
            {...register("otp")}
          />
          {errors.otp && <p className="text-xs text-red-600">{errors.otp.message}</p>}
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full bg-[#1B4332] hover:bg-[#2D6A4F]">
          {isSubmitting ? "Verifying..." : "Verify email"}
        </Button>
      </form>

      <div className="mt-4 text-center text-sm text-gray-500">
        Didn&apos;t receive the code?{" "}
        {canResend ? (
          <button onClick={handleResend} className="font-medium text-[#1B4332] hover:underline">
            Resend code
          </button>
        ) : (
          <span className="text-gray-400">Resend in {resendCountdown}s</span>
        )}
      </div>
    </AuthLayout>
  );
}
