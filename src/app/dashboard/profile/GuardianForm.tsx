"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NIGERIAN_STATES } from "@/constants/nigeria";

const GUARDIAN_TITLES = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Prof", "Chief", "Engr", "Barr", "Rev"];

const guardianFormSchema = z.object({
  guardianTitle: z.string().max(20).optional(),
  occupation: z.string().max(255).optional(),
  employer: z.string().max(255).optional(),
  residentialAddress: z.string().max(500).optional(),
  state: z.string().max(50).optional(),
  lga: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  secondaryPhone: z.string().max(20).optional().or(z.literal("")),
  emergencyContactName: z.string().max(255).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
  emergencyContactRelation: z.string().max(50).optional(),
});

type GuardianFormValues = z.infer<typeof guardianFormSchema>;

interface GuardianFormProps {
  initialData: GuardianFormValues;
}

export default function GuardianForm({ initialData }: GuardianFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<GuardianFormValues>({
    resolver: zodResolver(guardianFormSchema),
    defaultValues: initialData,
  });

  const watchedState = watch("state");
  const selectedStateLgas =
    NIGERIAN_STATES.find((s) => s.name === watchedState)?.lgas ?? [];

  async function onSubmit(data: GuardianFormValues) {
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to save guardian details");
        return;
      }

      toast.success("Guardian details saved successfully");
      const profile = json.data.user?.applicantProfile;
      if (profile) {
        reset({
          guardianTitle: profile.guardianTitle ?? "",
          occupation: profile.occupation ?? "",
          employer: profile.employer ?? "",
          residentialAddress: profile.residentialAddress ?? "",
          state: profile.state ?? "",
          lga: profile.lga ?? "",
          city: profile.city ?? "",
          secondaryPhone: profile.secondaryPhone ?? "",
          emergencyContactName: profile.emergencyContactName ?? "",
          emergencyContactPhone: profile.emergencyContactPhone ?? "",
          emergencyContactRelation: profile.emergencyContactRelation ?? "",
        });
      }
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Guardian info */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Guardian / Parent Information
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="guardianTitle">Title</Label>
            <Select
              value={watch("guardianTitle") ?? ""}
              onValueChange={(v) => setValue("guardianTitle", v ?? "", { shouldDirty: true })}
            >
              <SelectTrigger id="guardianTitle">
                <SelectValue placeholder="Select title" />
              </SelectTrigger>
              <SelectContent>
                {GUARDIAN_TITLES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input
              id="occupation"
              placeholder="e.g. Civil Engineer"
              {...register("occupation")}
            />
            {errors.occupation && (
              <p className="text-sm text-red-500">{errors.occupation.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="employer">Employer / Organisation</Label>
            <Input
              id="employer"
              placeholder="e.g. Lagos State Government"
              {...register("employer")}
            />
            {errors.employer && (
              <p className="text-sm text-red-500">{errors.employer.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Residential Address
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="residentialAddress">Street Address</Label>
            <Input
              id="residentialAddress"
              placeholder="e.g. 12 Adesola Street, Victoria Island"
              {...register("residentialAddress")}
            />
            {errors.residentialAddress && (
              <p className="text-sm text-red-500">{errors.residentialAddress.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>State</Label>
              <Select
                value={watch("state") ?? ""}
                onValueChange={(v) => {
                  setValue("state", v ?? "", { shouldDirty: true });
                  setValue("lga", "", { shouldDirty: true });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {NIGERIAN_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.state && (
                <p className="text-sm text-red-500">{errors.state.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>LGA</Label>
              <Select
                value={watch("lga") ?? ""}
                onValueChange={(v) => setValue("lga", v ?? "", { shouldDirty: true })}
                disabled={!watchedState}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={watchedState ? "Select LGA" : "Select state first"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {selectedStateLgas.map((lga) => (
                    <SelectItem key={lga} value={lga}>
                      {lga}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.lga && (
                <p className="text-sm text-red-500">{errors.lga.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City / Town</Label>
              <Input id="city" placeholder="e.g. Lagos" {...register("city")} />
              {errors.city && (
                <p className="text-sm text-red-500">{errors.city.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Additional Contact
        </p>
        <div className="space-y-2">
          <Label htmlFor="secondaryPhone">Secondary Phone Number</Label>
          <Input
            id="secondaryPhone"
            type="tel"
            placeholder="e.g. 08087654321"
            {...register("secondaryPhone")}
          />
          {errors.secondaryPhone && (
            <p className="text-sm text-red-500">{errors.secondaryPhone.message}</p>
          )}
        </div>
      </div>

      {/* Emergency contact */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Emergency Contact
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emergencyContactName">Full Name</Label>
            <Input
              id="emergencyContactName"
              placeholder="e.g. Chioma Okafor"
              {...register("emergencyContactName")}
            />
            {errors.emergencyContactName && (
              <p className="text-sm text-red-500">{errors.emergencyContactName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyContactRelation">Relationship</Label>
            <Input
              id="emergencyContactRelation"
              placeholder="e.g. Spouse, Sibling, Uncle"
              {...register("emergencyContactRelation")}
            />
            {errors.emergencyContactRelation && (
              <p className="text-sm text-red-500">
                {errors.emergencyContactRelation.message}
              </p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="emergencyContactPhone">Phone Number</Label>
            <Input
              id="emergencyContactPhone"
              type="tel"
              placeholder="e.g. 07011223344"
              {...register("emergencyContactPhone")}
            />
            {errors.emergencyContactPhone && (
              <p className="text-sm text-red-500">
                {errors.emergencyContactPhone.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="min-w-[140px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Details
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
