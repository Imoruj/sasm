"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

interface ChangePasswordFormProps {
  /** When true, copy emphasizes forced reset after default password. */
  forced?: boolean;
  submitLabel?: string;
  onSuccess?: () => void | Promise<void>;
}

export default function ChangePasswordForm({
  forced = false,
  submitLabel = "Change Password",
  onSuccess,
}: ChangePasswordFormProps = {}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = watch("newPassword");

  // Password strength indicator
  const getPasswordStrength = (
    pwd: string
  ): { level: number; label: string; color: string } => {
    if (!pwd) return { level: 0, label: "", color: "" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { level: 1, label: "Weak", color: "bg-red-500" };
    if (score <= 4) return { level: 2, label: "Fair", color: "bg-amber-500" };
    if (score <= 5) return { level: 3, label: "Good", color: "bg-blue-500" };
    return { level: 4, label: "Strong", color: "bg-green-600" };
  };

  const strength = getPasswordStrength(newPassword);

  async function onSubmit(data: ChangePasswordFormValues) {
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const message =
          json.error?.code === "INVALID_PASSWORD"
            ? "Current password is incorrect"
            : json.error?.code === "SAME_PASSWORD"
              ? "New password must be different from your current password"
              : json.error?.code === "DEFAULT_PASSWORD"
                ? "Choose a password that is not the system default"
              : json.error?.message ?? "Failed to change password";
        toast.error(message);
        return;
      }

      toast.success(
        forced
          ? "Password updated. Redirecting you to your account..."
          : "Password changed successfully. Please log in again if prompted.",
      );
      reset();
      await onSuccess?.();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">
          {forced ? "Temporary password" : "Current Password"}{" "}
          <span className="text-red-500">*</span>
        </Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          placeholder={
            forced ? "Enter the temporary/default password" : "Enter your current password"
          }
          {...register("currentPassword")}
          className={
            errors.currentPassword ? "border-red-400 focus-visible:ring-red-400" : ""
          }
        />
        {errors.currentPassword && (
          <p className="text-sm text-red-500">{errors.currentPassword.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">
          New Password <span className="text-red-500">*</span>
        </Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          {...register("newPassword")}
          className={
            errors.newPassword ? "border-red-400 focus-visible:ring-red-400" : ""
          }
        />
        {errors.newPassword && (
          <p className="text-sm text-red-500">{errors.newPassword.message}</p>
        )}

        {/* Password strength meter */}
        {newPassword && (
          <div className="space-y-1.5 pt-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    strength.level >= level ? strength.color : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <p
              className={`text-xs font-medium ${
                strength.level === 1
                  ? "text-red-600"
                  : strength.level === 2
                    ? "text-amber-600"
                    : strength.level === 3
                      ? "text-blue-600"
                      : "text-green-700"
              }`}
            >
              Password strength: {strength.label}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">
          Confirm New Password <span className="text-red-500">*</span>
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          {...register("confirmPassword")}
          className={
            errors.confirmPassword ? "border-red-400 focus-visible:ring-red-400" : ""
          }
        />
        {errors.confirmPassword && (
          <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Password requirements hint */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-600">Password requirements:</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li className={newPassword.length >= 8 ? "text-green-700" : ""}>
            At least 8 characters
          </li>
          <li className={/[A-Z]/.test(newPassword) ? "text-green-700" : ""}>
            At least one uppercase letter (A–Z)
          </li>
          <li className={/[a-z]/.test(newPassword) ? "text-green-700" : ""}>
            At least one lowercase letter (a–z)
          </li>
          <li className={/\d/.test(newPassword) ? "text-green-700" : ""}>
            At least one number (0–9)
          </li>
        </ul>
      </div>

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={isSubmitting} className="min-w-[160px]">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Changing...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
