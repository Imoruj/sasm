"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/layouts/AuthLayout";
import { loginSchema, type LoginInput } from "@/validators/authSchema";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const prefilledEmail = searchParams.get("email") ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefilledEmail },
  });

  const onSubmit = async (data: LoginInput) => {
    setServerError("");
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError("Invalid email or password. Please try again.");
      return;
    }

    // Prefer force-change page when password was reset to default; proxy also enforces this
    try {
      const sessionRes = await fetch("/api/auth/session");
      const sessionJson = (await sessionRes.json()) as {
        user?: { mustChangePassword?: boolean };
      };
      if (sessionJson?.user?.mustChangePassword) {
        router.push("/change-password");
        router.refresh();
        return;
      }
    } catch {
      // Fall through to default redirect; proxy will catch if needed
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <AuthLayout title="Welcome back" description="Sign in to your SAMS account">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" suppressHydrationWarning>
        {registered && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            Account created successfully. Sign in with your email and password to continue.
          </div>
        )}
        {serverError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
          {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-[#1B4332] hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#1B4332] hover:bg-[#2D6A4F]"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-[#1B4332] hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
