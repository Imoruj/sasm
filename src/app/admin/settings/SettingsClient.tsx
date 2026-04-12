"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Banknote, User, Loader2, Save, ImageIcon } from "lucide-react";
import AvatarUpload from "@/components/shared/AvatarUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProfileEditForm from "@/app/dashboard/profile/ProfileEditForm";
import ChangePasswordForm from "@/app/dashboard/profile/ChangePasswordForm";
import { NIGERIAN_STATES, getLGAs } from "@/constants/nigeria";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrgData {
  id: string;
  name: string;
  email: string;
  phone: string;
  website: string | null;
  address: string;
  state: string;
  lga: string;
  city: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
}

interface Cycle {
  id: string;
  name: string;
  academicYear: string;
  status: string;
}

interface FeeRecord {
  id: string;
  paymentType: string;
  amountKobo: number;
  admissionCycleId: string;
}

interface Props {
  org: OrgData;
  cycles: Cycle[];
  fees: FeeRecord[];
  profile: { firstName: string; lastName: string; phone: string; avatarUrl?: string | null };
}

// ─── Org schema ──────────────────────────────────────────────────────────────

const orgSchema = z.object({
  name:           z.string().min(2, "School name is required").max(255),
  email:          z.string().email("Enter a valid email"),
  phone:          z.string().min(7, "Phone is required").max(20),
  website:        z.string().url("Enter a valid URL (https://...)").optional().or(z.literal("")),
  address:        z.string().min(5, "Address is required"),
  state:          z.string().min(2, "State is required"),
  lga:            z.string().min(2, "LGA is required"),
  city:           z.string().optional(),
  primaryColor:   z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex colour"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex colour"),
});

type OrgFormValues = z.infer<typeof orgSchema>;

// ─── Fee helpers ─────────────────────────────────────────────────────────────

const FEE_TYPES = [
  { key: "APPLICATION_FEE", label: "Application Fee" },
  { key: "EXAM_FEE",        label: "Exam Fee" },
  { key: "ADMISSION_FEE",   label: "Admission Fee" },
] as const;

function koboToNaira(kobo: number) {
  return (kobo / 100).toFixed(2);
}

function nairaToKobo(naira: string): number {
  const n = parseFloat(naira.replace(/,/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

// ─── School Information Tab ───────────────────────────────────────────────────

function SchoolInfoTab({ org }: { org: OrgData }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name:           org.name,
      email:          org.email,
      phone:          org.phone,
      website:        org.website ?? "",
      address:        org.address,
      state:          org.state,
      lga:            org.lga,
      city:           org.city ?? "",
      primaryColor:   org.primaryColor,
      secondaryColor: org.secondaryColor,
    },
  });

  const selectedState = watch("state");
  const lgas = getLGAs(selectedState);

  async function onSubmit(data: OrgFormValues) {
    try {
      const res = await fetch("/api/admin/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to save settings");
        return;
      }
      toast.success("School information saved");
      reset(data);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  return (
    <Card>
      <CardContent className="py-6">
        {/* Logo upload — outside the form so it saves independently */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">School Logo</h3>
          <p className="text-sm text-gray-500 mb-3">Shown on admission letters and the admin portal. JPG or PNG, max 5 MB.</p>
          <div className="flex items-center gap-4">
            <AvatarUpload
              size={80}
              shape="square"
              imageFit="contain"
              currentUrl={org.logoUrl}
              fallback={<ImageIcon className="h-8 w-8 text-gray-400" />}
              folder="org-logo"
              saveEndpoint="/api/admin/settings/logo"
              saveField="logoUrl"
            />
            <p className="text-xs text-gray-400 leading-relaxed">
              Click the logo to upload a new image.<br />
              Recommended size: 200 × 200 px or larger.
            </p>
          </div>
        </div>

        <Separator className="mb-6" />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* School Identity */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">School Identity</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">School Name <span className="text-red-500">*</span></Label>
                <Input id="name" {...register("name")} placeholder="e.g. Greenfield Schools" />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                  <Input id="email" type="email" {...register("email")} placeholder="admin@school.edu.ng" />
                  {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                  <Input id="phone" type="tel" {...register("phone")} placeholder="08012345678" />
                  {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" type="url" {...register("website")} placeholder="https://yourschool.edu.ng" />
                {errors.website && <p className="text-sm text-red-500">{errors.website.message}</p>}
              </div>
            </div>
          </div>

          <Separator />

          {/* Address */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Address</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address <span className="text-red-500">*</span></Label>
                <Input id="address" {...register("address")} placeholder="12 School Road, GRA" />
                {errors.address && <p className="text-sm text-red-500">{errors.address.message}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>State <span className="text-red-500">*</span></Label>
                  <Select
                    value={selectedState}
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
                        <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.state && <p className="text-sm text-red-500">{errors.state.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>LGA <span className="text-red-500">*</span></Label>
                  <Select
                    value={watch("lga")}
                    onValueChange={(v) => setValue("lga", v ?? "", { shouldDirty: true })}
                    disabled={!selectedState}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select LGA" />
                    </SelectTrigger>
                    <SelectContent>
                      {lgas.map((lga) => (
                        <SelectItem key={lga} value={lga}>{lga}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.lga && <p className="text-sm text-red-500">{errors.lga.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City / Town</Label>
                  <Input id="city" {...register("city")} placeholder="e.g. Victoria Island" />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Brand Colours */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Brand Colours</h3>
            <p className="text-sm text-gray-500 mb-4">Used on admission letters and receipts.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Colour</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="primaryColor"
                    type="color"
                    {...register("primaryColor")}
                    className="h-9 w-14 cursor-pointer rounded border border-gray-200 p-0.5"
                  />
                  <Input
                    value={watch("primaryColor")}
                    onChange={(e) => setValue("primaryColor", e.target.value, { shouldDirty: true })}
                    placeholder="#1B4332"
                    className="font-mono uppercase"
                    maxLength={7}
                  />
                </div>
                {errors.primaryColor && <p className="text-sm text-red-500">{errors.primaryColor.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Colour</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="secondaryColor"
                    type="color"
                    {...register("secondaryColor")}
                    className="h-9 w-14 cursor-pointer rounded border border-gray-200 p-0.5"
                  />
                  <Input
                    value={watch("secondaryColor")}
                    onChange={(e) => setValue("secondaryColor", e.target.value, { shouldDirty: true })}
                    placeholder="#40916C"
                    className="font-mono uppercase"
                    maxLength={7}
                  />
                </div>
                {errors.secondaryColor && <p className="text-sm text-red-500">{errors.secondaryColor.message}</p>}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting || !isDirty} className="min-w-[140px]">
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="h-4 w-4" /> Save Changes</>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Fee Structure Tab ────────────────────────────────────────────────────────

function FeeStructureTab({ cycles, fees }: { cycles: Cycle[]; fees: FeeRecord[] }) {
  const [selectedCycleId, setSelectedCycleId] = useState<string>(cycles[0]?.id ?? "");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // Populate amounts when cycle changes
  useEffect(() => {
    const cycleId = selectedCycleId;
    const init: Record<string, string> = {};
    for (const ft of FEE_TYPES) {
      const record = fees.find((f) => f.admissionCycleId === cycleId && f.paymentType === ft.key);
      init[ft.key] = record ? koboToNaira(record.amountKobo) : "0.00";
    }
    setAmounts(init);
  }, [selectedCycleId, fees]);

  function handleSave() {
    startTransition(async () => {
      try {
        const feesPayload = FEE_TYPES.map(({ key }) => ({
          paymentType: key,
          amountKobo:  nairaToKobo(amounts[key] ?? "0"),
        }));

        const res = await fetch("/api/admin/settings/fees", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ admissionCycleId: selectedCycleId, fees: feesPayload }),
        });

        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error?.message ?? "Failed to save fees");
          return;
        }
        toast.success("Fee structure saved");
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  if (cycles.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-gray-500">
          No active or draft admission cycles found. Create a cycle first.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Admission Cycle</h3>
          <p className="text-sm text-gray-500 mb-3">Select a cycle to view or update its fee structure.</p>
          <Select value={selectedCycleId} onValueChange={(v) => setSelectedCycleId(v ?? "")}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Select cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} — {c.academicYear}
                  <span className="ml-2 text-xs text-gray-400">({c.status})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Fee Amounts</h3>
          <p className="text-sm text-gray-500 mb-4">Enter amounts in Naira (₦). Set to 0 to waive a fee.</p>
          <div className="space-y-4">
            {FEE_TYPES.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium select-none">₦</span>
                  <Input
                    id={key}
                    type="number"
                    min="0"
                    step="0.01"
                    className="pl-7"
                    value={amounts[key] ?? "0.00"}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Stored as {nairaToKobo(amounts[key] ?? "0").toLocaleString()} kobo
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isPending || !selectedCycleId} className="min-w-[140px]">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4" /> Save Fees</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── My Profile Tab ────────────────────────────────────────────────────────────

function MyProfileTab({ profile }: { profile: Props["profile"] }) {
  const initials = `${profile.firstName.charAt(0).toUpperCase()}${profile.lastName.charAt(0).toUpperCase()}`;
  return (
    <Card>
      <CardContent className="py-6 space-y-6">
        {/* Profile picture */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Profile Picture</h3>
          <p className="text-sm text-gray-500 mb-3">Click your avatar to upload a new photo. JPG or PNG, max 5 MB.</p>
          <AvatarUpload
            size={72}
            shape="circle"
            currentUrl={profile.avatarUrl}
            fallback={initials}
            folder="avatar"
            saveEndpoint="/api/profile/avatar"
            saveField="avatarUrl"
          />
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Personal Information</h3>
          <ProfileEditForm initialData={profile} />
        </div>
        <Separator />
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Change Password</h3>
          <p className="text-sm text-gray-500 mb-6">Choose a strong password you don&apos;t use elsewhere.</p>
          <ChangePasswordForm />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function SettingsClient({ org, cycles, fees, profile }: Props) {
  return (
    <Tabs defaultValue="school" className="space-y-4">
      <TabsList variant="default">
        <TabsTrigger value="school" className="gap-1.5 px-3 py-1.5">
          <Building2 className="h-4 w-4" /> School Info
        </TabsTrigger>
        <TabsTrigger value="fees" className="gap-1.5 px-3 py-1.5">
          <Banknote className="h-4 w-4" /> Fee Structure
        </TabsTrigger>
        <TabsTrigger value="profile" className="gap-1.5 px-3 py-1.5">
          <User className="h-4 w-4" /> My Profile
        </TabsTrigger>
      </TabsList>

      <TabsContent value="school">
        <SchoolInfoTab org={org} />
      </TabsContent>

      <TabsContent value="fees">
        <FeeStructureTab cycles={cycles} fees={fees} />
      </TabsContent>

      <TabsContent value="profile">
        <MyProfileTab profile={profile} />
      </TabsContent>
    </Tabs>
  );
}
