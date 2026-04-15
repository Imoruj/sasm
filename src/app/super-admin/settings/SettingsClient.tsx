"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2, Banknote, Bell, ShieldCheck, Save, Loader2, ImageIcon,
  CalendarDays, Plus, Trash2, Star, CheckCircle, XCircle, Lock, PenLine,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AvatarUpload from "@/components/shared/AvatarUpload";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { NIGERIAN_STATES, getLGAs } from "@/constants/nigeria";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrgData {
  id: string; name: string; email: string; phone: string; website: string | null;
  address: string; state: string; lga: string; city: string | null;
  primaryColor: string; secondaryColor: string; logoUrl: string | null;
  settings: Record<string, unknown> | null;
}

interface Cycle { id: string; name: string; academicYear: string; status: string; isDefault: boolean; startDate?: string | Date | null; endDate?: string | Date | null; }
type FeeType = "APPLICATION_FEE" | "ONLINE_TEST_FEE" | "EXAM_FEE" | "ADMISSION_FEE";
interface FeeRecord { id: string; paymentType: FeeType; amountKobo: number; admissionCycleId: string; }

interface Props { org: OrgData; cycles: Cycle[]; fees: FeeRecord[]; }

// ─── Fee helpers ─────────────────────────────────────────────────────────────

const FEE_TYPES = [
  { key: "APPLICATION_FEE",  label: "Application Fee" },
  { key: "ONLINE_TEST_FEE",  label: "Online Placement Test Surcharge" },
  { key: "EXAM_FEE",         label: "Exam Fee" },
  { key: "ADMISSION_FEE",    label: "Admission Fee" },
] as const;

function koboToNaira(k: number) { return (k / 100).toFixed(2); }
function nairaToKobo(n: string) {
  const v = parseFloat(n.replace(/,/g, ""));
  return isNaN(v) ? 0 : Math.round(v * 100);
}
function getFeeLabel(paymentType: FeeType) {
  return FEE_TYPES.find((fee) => fee.key === paymentType)?.label ?? paymentType;
}
function sortFees(a: FeeRecord, b: FeeRecord) {
  const aIndex = FEE_TYPES.findIndex((fee) => fee.key === a.paymentType);
  const bIndex = FEE_TYPES.findIndex((fee) => fee.key === b.paymentType);
  return aIndex - bIndex;
}

const feeFormSchema = z.object({
  paymentType: z.enum(["APPLICATION_FEE", "ONLINE_TEST_FEE", "EXAM_FEE", "ADMISSION_FEE"]),
  amount: z.string().trim().min(1, "Amount is required").refine(
    (value) => nairaToKobo(value) >= 0,
    "Enter a valid amount",
  ),
});
type FeeForm = z.infer<typeof feeFormSchema>;

// ─── Org schema ──────────────────────────────────────────────────────────────

const orgSchema = z.object({
  name:           z.string().min(2).max(255),
  email:          z.string().email(),
  phone:          z.string().min(7).max(20),
  website:        z.string().url().optional().or(z.literal("")),
  address:        z.string().min(5),
  state:          z.string().min(2),
  lga:            z.string().min(2),
  city:           z.string().optional(),
  primaryColor:   z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
type OrgForm = z.infer<typeof orgSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Tab 1 — Organisation
// ═══════════════════════════════════════════════════════════════════════════

function OrgTab({ org }: { org: OrgData }) {
  const router = useRouter();
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting, isDirty }, reset } =
    useForm<OrgForm>({
      resolver: zodResolver(orgSchema),
      defaultValues: {
        name: org.name, email: org.email, phone: org.phone,
        website: org.website ?? "", address: org.address,
        state: org.state, lga: org.lga, city: org.city ?? "",
        primaryColor: org.primaryColor, secondaryColor: org.secondaryColor,
      },
    });

  const selectedState = watch("state") ?? "";
  const lgas = getLGAs(selectedState);

  async function onSubmit(data: OrgForm) {
    const res = await fetch("/api/admin/settings/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error?.message ?? "Failed to save"); return; }
    toast.success("Organisation details saved");
    reset(data);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">School Logo</CardTitle>
          <CardDescription>Shown on admission letters and the portal. JPG or PNG, max 5 MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <AvatarUpload
            size={80} shape="square" imageFit="contain"
            currentUrl={org.logoUrl}
            fallback={<ImageIcon className="h-8 w-8 text-gray-400" />}
            folder="org-logo" saveEndpoint="/api/admin/settings/logo" saveField="logoUrl"
          />
          <p className="text-xs text-gray-400 leading-relaxed">
            Click the logo to upload a new image.<br />Recommended: 200×200 px or larger.
          </p>
        </CardContent>
      </Card>

      {/* Details form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">School Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>School Name *</Label>
                <Input {...register("name")} placeholder="Greenfield Schools" />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input {...register("website")} placeholder="https://school.edu.ng" />
                {errors.website && <p className="text-xs text-red-500">{errors.website.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" {...register("email")} />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <Input type="tel" {...register("phone")} placeholder="08012345678" />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Street Address *</Label>
              <Input {...register("address")} />
              {errors.address && <p className="text-xs text-red-500">{errors.address.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>State *</Label>
                <Select value={selectedState} onValueChange={(v) => { setValue("state", v ?? "", { shouldDirty: true }); setValue("lga", ""); }}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>{NIGERIAN_STATES.map((s) => <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                {errors.state && <p className="text-xs text-red-500">{errors.state.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>LGA *</Label>
                <Select value={watch("lga") ?? ""} onValueChange={(v) => setValue("lga", v ?? "", { shouldDirty: true })} disabled={!selectedState}>
                  <SelectTrigger><SelectValue placeholder={selectedState ? "Select LGA" : "Select state first"} /></SelectTrigger>
                  <SelectContent>{lgas.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
                {errors.lga && <p className="text-xs text-red-500">{errors.lga.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input {...register("city")} placeholder="e.g. Lagos" />
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Branding Colours</p>
              <div className="flex gap-6">
                <div className="space-y-1.5">
                  <Label>Primary</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" {...register("primaryColor")} className="h-9 w-12 cursor-pointer rounded border border-gray-200 p-1" />
                    <Input className="w-28 font-mono text-sm" {...register("primaryColor")} placeholder="#1B4332" />
                  </div>
                  {errors.primaryColor && <p className="text-xs text-red-500">{errors.primaryColor.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Secondary</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" {...register("secondaryColor")} className="h-9 w-12 cursor-pointer rounded border border-gray-200 p-1" />
                    <Input className="w-28 font-mono text-sm" {...register("secondaryColor")} placeholder="#2D6A4F" />
                  </div>
                  {errors.secondaryColor && <p className="text-xs text-red-500">{errors.secondaryColor.message}</p>}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting || !isDirty} className="bg-[#1B4332] hover:bg-[#1B4332]/90">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 2 — Fees
// ═══════════════════════════════════════════════════════════════════════════

function FeesTab({ cycles, fees: initialFees }: { cycles: Cycle[]; fees: FeeRecord[] }) {
  const router = useRouter();
  const [fees, setFees] = useState<FeeRecord[]>(initialFees);
  const [selectedCycleId, setSelectedCycleId] = useState(
    cycles.find((c) => c.isDefault)?.id ?? cycles[0]?.id ?? ""
  );

  // ── Add fee dialog ─────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const addForm = useForm<FeeForm>({
    resolver: zodResolver(feeFormSchema),
    defaultValues: { paymentType: "APPLICATION_FEE", amount: "" },
  });

  // ── Edit fee dialog ────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeRecord | null>(null);
  const editForm = useForm<FeeForm>({
    resolver: zodResolver(feeFormSchema),
    defaultValues: { paymentType: "APPLICATION_FEE", amount: "" },
  });

  // ── Delete ─────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingFee, setDeletingFee] = useState<FeeRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const cycleFees = fees
    .filter((f) => f.admissionCycleId === selectedCycleId)
    .sort(sortFees);

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);

  // Which fee types are already used in this cycle?
  const usedTypes = new Set(cycleFees.map((f) => f.paymentType));
  const availableTypes = FEE_TYPES.filter(({ key }) => !usedTypes.has(key));

  // ── Handlers ───────────────────────────────────────────────────
  function handleCycleChange(id: string | null) {
    if (id) setSelectedCycleId(id);
  }

  function openEdit(fee: FeeRecord) {
    setEditingFee(fee);
    editForm.reset({ paymentType: fee.paymentType, amount: koboToNaira(fee.amountKobo) });
    setEditOpen(true);
  }

  function openDelete(fee: FeeRecord) {
    setDeletingFee(fee);
    setDeleteOpen(true);
  }

  async function handleAdd(data: FeeForm) {
    setAddLoading(true);
    try {
      const res = await fetch("/api/admin/settings/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admissionCycleId: selectedCycleId,
          paymentType: data.paymentType,
          amountKobo: nairaToKobo(data.amount),
        }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.error?.message ?? "Failed to add fee"); return; }
      toast.success("Fee added");
      setFees((prev) => [...prev, json.data]);
      setAddOpen(false);
      addForm.reset();
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleEdit(data: FeeForm) {
    if (!editingFee) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/settings/fees/${editingFee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountKobo: nairaToKobo(data.amount) }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.error?.message ?? "Failed to update"); return; }
      toast.success("Fee updated");
      setFees((prev) => prev.map((f) => f.id === editingFee.id ? { ...f, amountKobo: nairaToKobo(data.amount) } : f));
      setEditOpen(false);
      setEditingFee(null);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!deletingFee) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/settings/fees/${deletingFee.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) { toast.error(json.error?.message ?? "Failed to delete"); return; }
      toast.success("Fee deleted");
      setFees((prev) => prev.filter((f) => f.id !== deletingFee.id));
      setDeleteOpen(false);
      setDeletingFee(null);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (!cycles.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-400 text-sm">
          No active admission cycles. Create a cycle first to configure fees.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* ── Admission Cycle selector ─────────────────────────── */}
          <div className="space-y-1.5">
            <p className="font-semibold text-gray-900">Admission Cycle</p>
            <p className="text-sm text-gray-500">Select a cycle to view or update its fee structure.</p>
            <Select value={selectedCycleId} onValueChange={handleCycleChange}>
              <SelectTrigger className="w-full max-w-lg">
                <SelectValue placeholder="Select cycle" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.academicYear} ({c.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* ── Fee list ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Fee Amounts</p>
                <p className="text-sm text-gray-500">
                  Amounts in Naira (₦). The Admission Acceptance Fee is charged when a parent accepts an offer.
                </p>
              </div>
              {availableTypes.length > 0 && (
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    addForm.reset({ paymentType: availableTypes[0].key, amount: "" });
                    setAddOpen(true);
                  }}
                >
                  <Plus className="size-4 mr-1" /> Add Fee
                </Button>
              )}
            </div>
          </div>

          {cycleFees.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-gray-400">
              No fees configured for this cycle yet.
            </div>
          ) : (
            <div className="space-y-3">
              {cycleFees.map((fee) => (
                <div
                  key={fee.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">{getFeeLabel(fee.paymentType)}</p>
                    <p className="mt-0.5 text-sm">
                      <span className="font-semibold text-green-700">₦{koboToNaira(fee.amountKobo)}</span>
                      <span className="ml-2 text-xs text-gray-400">({fee.amountKobo.toLocaleString()} kobo)</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openEdit(fee)}>
                      <PenLine className="size-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      onClick={() => openDelete(fee)}
                    >
                      <Trash2 className="size-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add Fee Dialog ──────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Fee</DialogTitle>
            <DialogDescription>
              Add a new fee type to the <strong>{selectedCycle?.name}</strong> cycle.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addForm.handleSubmit(handleAdd)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Fee Type</Label>
              <Select
                value={addForm.watch("paymentType")}
                onValueChange={(v) => addForm.setValue("paymentType", v as FeeType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map(({ key, label }) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₦)</Label>
              <Input
                placeholder="e.g. 5000"
                {...addForm.register("amount")}
              />
              {addForm.formState.errors.amount && (
                <p className="text-xs text-red-500">{addForm.formState.errors.amount.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addLoading} className="bg-[#1B4332] hover:bg-[#1B4332]/90">
                {addLoading ? <><Loader2 className="size-4 animate-spin mr-1" />Adding…</> : "Add Fee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Fee Dialog ─────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Fee</DialogTitle>
            <DialogDescription>
              Update the amount for <strong>{editingFee ? getFeeLabel(editingFee.paymentType) : ""}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Fee Type</Label>
              <Input
                disabled
                value={editingFee ? getFeeLabel(editingFee.paymentType) : ""}
                className="bg-gray-50"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₦)</Label>
              <Input
                placeholder="e.g. 5000"
                {...editForm.register("amount")}
              />
              {editForm.formState.errors.amount && (
                <p className="text-xs text-red-500">{editForm.formState.errors.amount.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={editLoading} className="bg-[#1B4332] hover:bg-[#1B4332]/90">
                {editLoading ? <><Loader2 className="size-4 animate-spin mr-1" />Saving…</> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────── */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Fee"
        description={`Are you sure you want to remove the ${deletingFee ? getFeeLabel(deletingFee.paymentType) : ""} (₦${deletingFee ? koboToNaira(deletingFee.amountKobo) : "0.00"})? This action cannot be undone.`}
        confirmLabel={deleteLoading ? "Deleting…" : "Delete"}
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 3 — Notifications
// ═══════════════════════════════════════════════════════════════════════════

const NOTIFICATION_SETTINGS = [
  { key: "emailOnSubmit",     label: "Application Submitted",   desc: "Send email when an applicant submits an application",     channel: "Email" },
  { key: "emailOnApprove",    label: "Application Approved",    desc: "Send email when an admin approves an application",        channel: "Email" },
  { key: "emailOnReject",     label: "Application Rejected",    desc: "Send email when an admin rejects an application",         channel: "Email" },
  { key: "emailOnRevision",   label: "Revision Requested",      desc: "Send email when admin requests changes to an application",channel: "Email" },
  { key: "emailOnExamBooked", label: "Exam Slot Booked",        desc: "Send email when an exam session is scheduled",           channel: "Email" },
  { key: "smsOnSubmit",       label: "Application Submitted",   desc: "Send SMS when an applicant submits an application",      channel: "SMS" },
  { key: "smsOnApprove",      label: "Application Approved",    desc: "Send SMS when an admin approves an application",         channel: "SMS" },
  { key: "smsOnReject",       label: "Application Rejected",    desc: "Send SMS when an admin rejects an application",          channel: "SMS" },
];

function NotificationsTab({ settings }: { settings: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {
      emailOnSubmit: true, emailOnApprove: true, emailOnReject: true,
      emailOnRevision: true, emailOnExamBooked: true,
      smsOnSubmit: false, smsOnApprove: false, smsOnReject: false,
    };
    NOTIFICATION_SETTINGS.forEach(({ key }) => {
      if (key in settings) defaults[key] = settings[key] as boolean;
    });
    return defaults;
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/super-admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error?.message ?? "Failed to save"); }
    else { toast.success("Notification preferences saved"); }
    setSaving(false);
  }

  const emailItems = NOTIFICATION_SETTINGS.filter((s) => s.channel === "Email");
  const smsItems   = NOTIFICATION_SETTINGS.filter((s) => s.channel === "SMS");

  return (
    <div className="space-y-4">
      {[{ title: "Email Notifications", items: emailItems }, { title: "SMS Notifications (Termii)", items: smsItems }].map(({ title, items }) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map(({ key, label, desc }, i) => (
              <div key={key}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </div>
                  <Switch
                    checked={values[key] ?? false}
                    onCheckedChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
                  />
                </div>
                {i < items.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-[#1B4332] hover:bg-[#1B4332]/90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 4 — Admission Rules + Security
// ═══════════════════════════════════════════════════════════════════════════

function AdmissionSecurityTab({ settings }: { settings: Record<string, unknown> }) {
  const [values, setValues] = useState({
    allowTransferStudents:      (settings.allowTransferStudents      as boolean)  ?? true,
    requirePaymentToSubmit:     (settings.requirePaymentToSubmit     as boolean)  ?? true,
    autoCloseOnCycleEnd:        (settings.autoCloseOnCycleEnd        as boolean)  ?? false,
    maxApplicationsPerApplicant:(settings.maxApplicationsPerApplicant as number)  ?? 1,
    sessionTimeoutMinutes:      (settings.sessionTimeoutMinutes      as number)   ?? 60,
    passwordMinLength:          (settings.passwordMinLength          as number)   ?? 8,
    maxLoginAttempts:           (settings.maxLoginAttempts           as number)   ?? 5,
    lockoutDurationMinutes:     (settings.lockoutDurationMinutes     as number)   ?? 30,
  });
  const [saving, setSaving] = useState(false);

  function setNum(key: string, val: string) {
    const n = parseInt(val);
    if (!isNaN(n)) setValues((p) => ({ ...p, [key]: n }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/super-admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error?.message ?? "Failed to save"); }
    else { toast.success("Settings saved"); }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {/* Admission Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admission Rules</CardTitle>
          <CardDescription>Control how applications are submitted and processed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "allowTransferStudents",  label: "Allow Transfer Students",   desc: "Permit transfer students to apply alongside new students" },
            { key: "requirePaymentToSubmit", label: "Require Payment to Submit", desc: "Application fee must be paid before submission is allowed" },
            { key: "autoCloseOnCycleEnd",   label: "Auto-close on Cycle End",   desc: "Automatically close applications when the admission cycle ends" },
          ].map(({ key, label, desc }, i, arr) => (
            <div key={key}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
                <Switch
                  checked={values[key as keyof typeof values] as boolean}
                  onCheckedChange={(v) => setValues((p) => ({ ...p, [key]: v }))}
                />
              </div>
              {i < arr.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Max Applications per Applicant</p>
              <p className="text-xs text-gray-400 mt-0.5">Maximum number of applications one account can submit per cycle</p>
            </div>
            <Input
              type="number" min={1} max={10} className="w-20 text-center"
              value={values.maxApplicationsPerApplicant}
              onChange={(e) => setNum("maxApplicationsPerApplicant", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security Settings</CardTitle>
          <CardDescription>Configure password policy and session security.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "sessionTimeoutMinutes", label: "Session Timeout",        desc: "Auto-logout after inactivity (minutes)",       min: 15,  max: 1440 },
            { key: "passwordMinLength",     label: "Minimum Password Length", desc: "Minimum number of characters required",        min: 6,   max: 32   },
            { key: "maxLoginAttempts",      label: "Max Login Attempts",     desc: "Failed attempts before account lockout",        min: 3,   max: 20   },
            { key: "lockoutDurationMinutes",label: "Lockout Duration",       desc: "Minutes account stays locked after max failures",min: 5,  max: 1440 },
          ].map(({ key, label, desc, min, max }, i, arr) => (
            <div key={key}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
                <Input
                  type="number" min={min} max={max} className="w-24 text-center"
                  value={values[key as keyof typeof values] as number}
                  onChange={(e) => setNum(key, e.target.value)}
                />
              </div>
              {i < arr.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-[#1B4332] hover:bg-[#1B4332]/90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// Tab — Bank Account Details
// ═══════════════════════════════════════════════════════════════════════════

const bankSchema = z.object({
  bankName:      z.string().min(2, "Bank name required"),
  accountName:   z.string().min(2, "Account name required"),
  accountNumber: z.string().length(10, "Must be exactly 10 digits"),
  sortCode:      z.string().optional(),
});
type BankForm = z.infer<typeof bankSchema>;

function BankDetailsTab({ settings }: { settings: Record<string, unknown> }) {
  const existing = (settings.bankDetails ?? {}) as Partial<BankForm>;
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset } =
    useForm<BankForm>({
      resolver: zodResolver(bankSchema),
      defaultValues: {
        bankName: existing.bankName ?? "",
        accountName: existing.accountName ?? "",
        accountNumber: existing.accountNumber ?? "",
        sortCode: existing.sortCode ?? "",
      },
    });

  async function onSubmit(data: BankForm) {
    const res = await fetch("/api/admin/settings/bank-details", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error?.message ?? "Failed to save"); return; }
    toast.success("Bank details saved");
    reset(data);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Account for Payment Collection</CardTitle>
        <CardDescription>
          These details will be shown to applicants on their payment invoice. Ensure they are accurate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label>Bank Name</Label>
            <Input placeholder="e.g. First Bank of Nigeria" {...register("bankName")} />
            {errors.bankName && <p className="text-xs text-red-500">{errors.bankName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Account Name</Label>
            <Input placeholder="e.g. Trinitate International School" {...register("accountName")} />
            {errors.accountName && <p className="text-xs text-red-500">{errors.accountName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Account Number</Label>
            <Input placeholder="10-digit NUBAN" maxLength={10} {...register("accountNumber")} />
            {errors.accountNumber && <p className="text-xs text-red-500">{errors.accountNumber.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Sort Code <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input placeholder="e.g. 011" {...register("sortCode")} />
          </div>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Bank Details</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 6 — Academic Sessions
// ═══════════════════════════════════════════════════════════════════════════

const cycleSchema = z.object({
  name:         z.string().min(2, "Name required"),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/, "Format: YYYY/YYYY e.g. 2026/2027"),
  startDate:    z.string().min(1, "Start date required"),
  endDate:      z.string().min(1, "End date required"),
  isDefault:    z.boolean().optional(),
});
type CycleForm = z.infer<typeof cycleSchema>;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:    { label: "Draft",    color: "bg-gray-100 text-gray-600" },
  OPEN:     { label: "Open",     color: "bg-green-100 text-green-700" },
  CLOSED:   { label: "Closed",   color: "bg-red-100 text-red-700" },
  ARCHIVED: { label: "Archived", color: "bg-amber-100 text-amber-700" },
};

function AcademicSessionsTab({ initialCycles }: { initialCycles: Cycle[] }) {
  const router = useRouter();
  const [cycles, setCycles] = useState<Cycle[]>(initialCycles);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<CycleForm>({
      resolver: zodResolver(cycleSchema),
      defaultValues: { isDefault: false },
    });

  function toDateInput(d: string | Date | null | undefined) {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().slice(0, 10);
  }

  function startEdit(cycle: Cycle) {
    setEditingId(cycle.id);
    setShowForm(true);
    reset({
      name:         cycle.name,
      academicYear: cycle.academicYear,
      startDate:    toDateInput(cycle.startDate),
      endDate:      toDateInput(cycle.endDate),
      isDefault:    cycle.isDefault,
    });
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    reset({ name: "", academicYear: "", startDate: "", endDate: "", isDefault: false });
  }

  async function onSubmit(data: CycleForm) {
    const url    = editingId ? `/api/admin/settings/cycles/${editingId}` : "/api/admin/settings/cycles";
    const method = editingId ? "PATCH" : "POST";
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json   = await res.json();
    if (!res.ok) { toast.error(json.error?.message ?? "Failed to save"); return; }
    toast.success(editingId ? "Session updated" : "Session created");
    cancelForm();
    router.refresh();
    // Optimistic UI
    if (editingId) {
      setCycles((prev) => prev.map((c) => c.id === editingId ? { ...c, ...json.data } : (data.isDefault ? { ...c, isDefault: false } : c)));
    } else {
      setCycles((prev) => [json.data, ...(data.isDefault ? prev.map((c) => ({ ...c, isDefault: false })) : prev)]);
    }
  }

  async function setStatus(id: string, status: string) {
    setActionLoading(id + status);
    const res  = await fetch(`/api/admin/settings/cycles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error?.message ?? "Failed"); }
    else {
      toast.success(`Session ${status.toLowerCase()}`);
      setCycles((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    }
    setActionLoading(null);
  }

  async function setDefault(id: string) {
    setActionLoading(id + "default");
    const res  = await fetch(`/api/admin/settings/cycles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDefault: true }) });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error?.message ?? "Failed"); }
    else {
      toast.success("Default session updated");
      setCycles((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));
    }
    setActionLoading(null);
  }

  async function deleteCycle(id: string) {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    setActionLoading(id + "del");
    const res  = await fetch(`/api/admin/settings/cycles/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error?.message ?? "Cannot delete"); }
    else { toast.success("Session deleted"); setCycles((prev) => prev.filter((c) => c.id !== id)); }
    setActionLoading(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Academic Sessions</CardTitle>
            <CardDescription className="mt-1">
              Manage admission cycles. The <strong>default</strong> session is used when applicants start a new application.
              <strong> Open</strong> sessions accept applications; <strong>Closed</strong> ones do not.
            </CardDescription>
          </div>
          {!showForm && (
            <Button onClick={() => { setShowForm(true); setEditingId(null); reset({ name: "", academicYear: "", startDate: "", endDate: "", isDefault: false }); }} className="shrink-0">
              <Plus className="size-4 mr-1" /> New Session
            </Button>
          )}
        </CardHeader>

        {/* Create / Edit form */}
        {showForm && (
          <CardContent className="border-t pt-5">
            <p className="mb-4 text-sm font-semibold text-gray-700">{editingId ? "Edit Session" : "Create New Session"}</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Session Name <span className="text-red-500">*</span></Label>
                  <input
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    placeholder="e.g. 2026/2027 Academic Session"
                    {...register("name")}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Academic Year <span className="text-red-500">*</span></Label>
                  <input
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    placeholder="2026/2027"
                    {...register("academicYear")}
                  />
                  {errors.academicYear && <p className="text-xs text-red-500">{errors.academicYear.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Start Date <span className="text-red-500">*</span></Label>
                  <input type="date"
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    {...register("startDate")}
                  />
                  {errors.startDate && <p className="text-xs text-red-500">{errors.startDate.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>End Date <span className="text-red-500">*</span></Label>
                  <input type="date"
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    {...register("endDate")}
                  />
                  {errors.endDate && <p className="text-xs text-red-500">{errors.endDate.message}</p>}
                </div>

                <div className="col-span-2 flex items-center gap-3">
                  <input type="checkbox" id="isDefault" {...register("isDefault")} className="size-4 accent-[#1B4332]" />
                  <Label htmlFor="isDefault" className="cursor-pointer">Set as default session for new applications</Label>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="size-4 animate-spin mr-1" />Saving…</> : <><Save className="size-4 mr-1" />{editingId ? "Update" : "Create"} Session</>}
                </Button>
                <Button type="button" variant="outline" onClick={cancelForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Sessions list */}
      {cycles.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-gray-400">
          No academic sessions yet. Create your first one above.
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map((cycle) => {
            const cfg = STATUS_CONFIG[cycle.status] ?? STATUS_CONFIG.DRAFT;
            const busy = (s: string) => actionLoading === cycle.id + s;
            return (
              <Card key={cycle.id} className={cycle.isDefault ? "border-[#1B4332]/40 ring-1 ring-[#1B4332]/20" : ""}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <CalendarDays className="mt-0.5 size-5 shrink-0 text-gray-400" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{cycle.name}</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                        {cycle.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#1B4332]/10 px-2 py-0.5 text-xs font-medium text-[#1B4332]">
                            <Star className="size-3" />Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {cycle.academicYear}
                        {cycle.startDate && cycle.endDate && (
                          <> · {toDateInput(cycle.startDate)} → {toDateInput(cycle.endDate)}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {/* Set default */}
                    {!cycle.isDefault && (
                      <button
                        type="button"
                        title="Set as default"
                        disabled={!!actionLoading}
                        onClick={() => setDefault(cycle.id)}
                        className="rounded px-2.5 py-1.5 text-xs font-medium text-gray-500 border hover:bg-gray-50 disabled:opacity-50"
                      >
                        {busy("default") ? <Loader2 className="size-3 animate-spin" /> : <Star className="size-3.5" />}
                      </button>
                    )}

                    {/* Open / Close */}
                    {cycle.status === "DRAFT" || cycle.status === "CLOSED" ? (
                      <button type="button" disabled={!!actionLoading} onClick={() => setStatus(cycle.id, "OPEN")}
                        className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 disabled:opacity-50">
                        {busy("OPEN") ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle className="size-3.5" />} Open
                      </button>
                    ) : cycle.status === "OPEN" ? (
                      <button type="button" disabled={!!actionLoading} onClick={() => setStatus(cycle.id, "CLOSED")}
                        className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50">
                        {busy("CLOSED") ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3.5" />} Close
                      </button>
                    ) : null}

                    {/* Edit */}
                    <button type="button" onClick={() => startEdit(cycle)}
                      className="rounded px-2.5 py-1.5 text-xs font-medium text-gray-600 border hover:bg-gray-50">
                      <PenLine className="size-3.5" />
                    </button>

                    {/* Delete */}
                    {cycle.status !== "OPEN" && (
                      <button type="button" disabled={!!actionLoading} onClick={() => deleteCycle(cycle.id)}
                        className="rounded px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50">
                        {busy("del") ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Root export
// ═══════════════════════════════════════════════════════════════════════════

export default function SuperAdminSettingsClient({ org, cycles, fees }: Props) {
  const settings = (org.settings as Record<string, unknown>) ?? {};

  return (
    <Tabs defaultValue="organisation" className="space-y-6">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="organisation" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />Organisation
        </TabsTrigger>
        <TabsTrigger value="sessions" className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />Sessions
        </TabsTrigger>
        <TabsTrigger value="fees" className="flex items-center gap-2">
          <Banknote className="h-4 w-4" />Fees
        </TabsTrigger>
        <TabsTrigger value="bank" className="flex items-center gap-2">
          <Banknote className="h-4 w-4" />Bank Account
        </TabsTrigger>
        <TabsTrigger value="notifications" className="flex items-center gap-2">
          <Bell className="h-4 w-4" />Notifications
        </TabsTrigger>
        <TabsTrigger value="security" className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />Security
        </TabsTrigger>
      </TabsList>

      <TabsContent value="organisation">
        <OrgTab org={org} />
      </TabsContent>

      <TabsContent value="sessions">
        <AcademicSessionsTab initialCycles={cycles} />
      </TabsContent>

      <TabsContent value="fees">
        <FeesTab cycles={cycles} fees={fees} />
      </TabsContent>

      <TabsContent value="bank">
        <BankDetailsTab settings={settings} />
      </TabsContent>

      <TabsContent value="notifications">
        <NotificationsTab settings={settings} />
      </TabsContent>

      <TabsContent value="security">
        <AdmissionSecurityTab settings={settings} />
      </TabsContent>
    </Tabs>
  );
}
