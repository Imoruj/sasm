"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  GraduationCap,
  FileText,
  CalendarDays,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CycleStatus = "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";

interface Cycle {
  id: string;
  name: string;
  academicYear: string;
  startDate: Date;
  endDate: Date;
  status: CycleStatus;
  isDefault: boolean;
  createdAt: Date;
  _count: { applications: number; examSessions: number };
}

interface Props {
  initialCycles: Cycle[];
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const cycleSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(255),
  academicYear: z.string().regex(/^\d{4}\/\d{4}$/, "Format: YYYY/YYYY (e.g. 2026/2027)"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  isDefault: z.boolean().default(false),
});
type CycleFormValues = z.infer<typeof cycleSchema>;

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<CycleStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT:    { label: "Draft",    variant: "secondary" },
  OPEN:     { label: "Open",     variant: "default" },
  CLOSED:   { label: "Closed",   variant: "outline" },
  ARCHIVED: { label: "Archived", variant: "destructive" },
};

const NEXT_STATUS: Partial<Record<CycleStatus, CycleStatus>> = {
  DRAFT:  "OPEN",
  OPEN:   "CLOSED",
  CLOSED: "ARCHIVED",
};

const NEXT_STATUS_LABEL: Partial<Record<CycleStatus, string>> = {
  DRAFT:  "Open for Applications",
  OPEN:   "Close Applications",
  CLOSED: "Archive",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CyclesManager({ initialCycles }: Props) {
  const router = useRouter();
  const [cycles, setCycles] = useState<Cycle[]>(initialCycles);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<Cycle | null>(null);
  const [deleteCycle, setDeleteCycle] = useState<Cycle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createForm = useForm<CycleFormValues>({
    resolver: zodResolver(cycleSchema),
    defaultValues: { name: "", academicYear: "", startDate: "", endDate: "", isDefault: false },
  });

  const editForm = useForm<CycleFormValues>({ resolver: zodResolver(cycleSchema) });

  // ── Create ──────────────────────────────────────────────────────────────
  const handleCreate = async (data: CycleFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/super-admin/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Failed to create cycle.");
        return;
      }
      toast.success("Admission cycle created.");
      setCreateOpen(false);
      createForm.reset();
      router.refresh();
      setCycles((prev) => [{ ...json.data, _count: { applications: 0, examSessions: 0 } }, ...prev]);
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Edit / Status change ─────────────────────────────────────────────────
  const patchCycle = async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/settings/cycles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  const handleEdit = async (data: CycleFormValues) => {
    if (!editCycle) return;
    setIsSubmitting(true);
    try {
      const json = await patchCycle(editCycle.id, data);
      if (!json.success) { toast.error(json.error?.message ?? "Failed to update cycle."); return; }
      toast.success("Cycle updated.");
      setEditCycle(null);
      router.refresh();
      setCycles((prev) => prev.map((c) => c.id === editCycle.id ? { ...c, ...json.data } : c));
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (cycle: Cycle, next: CycleStatus) => {
    setIsSubmitting(true);
    try {
      const json = await patchCycle(cycle.id, { status: next });
      if (!json.success) { toast.error(json.error?.message ?? "Failed to update status."); return; }
      toast.success(`Cycle status updated to "${STATUS_CONFIG[next].label}".`);
      router.refresh();
      setCycles((prev) => prev.map((c) => c.id === cycle.id ? { ...c, status: next } : c));
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (cycle: Cycle) => {
    setIsSubmitting(true);
    try {
      const json = await patchCycle(cycle.id, { isDefault: true });
      if (!json.success) { toast.error(json.error?.message ?? "Failed to set default."); return; }
      toast.success(`"${cycle.name}" is now the default cycle.`);
      router.refresh();
      setCycles((prev) => prev.map((c) => ({ ...c, isDefault: c.id === cycle.id })));
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteCycle) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/settings/cycles/${deleteCycle.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) { toast.error(json.error?.message ?? "Failed to delete cycle."); return; }
      toast.success("Cycle deleted.");
      setDeleteCycle(null);
      router.refresh();
      setCycles((prev) => prev.filter((c) => c.id !== deleteCycle.id));
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (cycle: Cycle) => {
    editForm.reset({
      name: cycle.name,
      academicYear: cycle.academicYear,
      startDate: new Date(cycle.startDate).toISOString().split("T")[0],
      endDate: new Date(cycle.endDate).toISOString().split("T")[0],
      isDefault: cycle.isDefault,
    });
    setEditCycle(cycle);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Admission Cycles</h2>
          <p className="text-sm text-gray-500">{cycles.length} cycle{cycles.length !== 1 ? "s" : ""} total</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <Button className="bg-[#1B4332] hover:bg-[#1B4332]/90" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Cycle
          </Button>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Admission Cycle</DialogTitle>
            </DialogHeader>
            <Separator />
            <form onSubmit={createForm.handleSubmit(handleCreate)}>
              <CycleFormFields form={createForm} />
              <DialogFooter showCloseButton className="mt-4">
                <Button type="submit" disabled={isSubmitting} className="bg-[#1B4332] hover:bg-[#1B4332]/90">
                  {isSubmitting ? "Creating..." : "Create Cycle"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {cycles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No admission cycles yet</p>
            <p className="mt-1 text-xs text-gray-400">Create your first admission cycle to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cycles.map((cycle) => {
            const statusCfg = STATUS_CONFIG[cycle.status];
            const nextStatus = NEXT_STATUS[cycle.status];
            return (
              <Card key={cycle.id} className={cycle.isDefault ? "ring-2 ring-[#1B4332]/30" : ""}>
                <CardContent className="flex flex-wrap items-center gap-4 py-4">
                  {/* Icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1B4332]/10 text-[#1B4332]">
                    <GraduationCap className="h-5 w-5" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{cycle.name}</p>
                      <Badge variant={statusCfg.variant} className="text-xs">{statusCfg.label}</Badge>
                      {cycle.isDefault && (
                        <Badge variant="outline" className="text-xs text-[#1B4332] border-[#1B4332]/40">
                          <Star className="mr-1 h-2.5 w-2.5" />Default
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="font-mono">{cycle.academicYear}</span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(cycle.startDate)} — {formatDate(cycle.endDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {cycle._count.applications} application{cycle._count.applications !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {nextStatus && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => handleStatusChange(cycle, nextStatus)}
                        className="text-xs"
                      >
                        {NEXT_STATUS_LABEL[cycle.status]}
                      </Button>
                    )}

                    {!cycle.isDefault && cycle.status !== "ARCHIVED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => handleSetDefault(cycle)}
                        title="Set as default"
                        className="text-xs text-gray-500"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(cycle)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete cycle"
                            onClick={() => setDeleteCycle(cycle)}
                          />
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Admission Cycle</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete <strong>{cycle.name}</strong>?
                            {cycle._count.applications > 0 && (
                              <span className="mt-2 block rounded bg-red-50 p-2 text-xs text-red-700 font-medium">
                                This cycle has {cycle._count.applications} application(s). Deletion will be blocked.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeleteCycle(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                            {isSubmitting ? "Deleting..." : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editCycle} onOpenChange={(open) => { if (!open) setEditCycle(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Cycle — {editCycle?.name}</DialogTitle>
          </DialogHeader>
          <Separator />
          <form onSubmit={editForm.handleSubmit(handleEdit)}>
            <CycleFormFields form={editForm} />
            <DialogFooter showCloseButton className="mt-4">
              <Button type="submit" disabled={isSubmitting} className="bg-[#1B4332] hover:bg-[#1B4332]/90">
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable form fields
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CycleFormFields({ form }: { form: any }) {
  const { register, watch, setValue, formState: { errors } } = form;
  const isDefault = watch("isDefault");

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="name">Cycle Name *</Label>
        <Input id="name" placeholder="e.g. 2026/2027 Academic Session" {...register("name")} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="academicYear">Academic Year *</Label>
        <Input id="academicYear" placeholder="e.g. 2026/2027" {...register("academicYear")} aria-invalid={!!errors.academicYear} />
        {errors.academicYear && <p className="text-xs text-destructive">{errors.academicYear.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start Date *</Label>
          <Input id="startDate" type="date" {...register("startDate")} aria-invalid={!!errors.startDate} />
          {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">End Date *</Label>
          <Input id="endDate" type="date" {...register("endDate")} aria-invalid={!!errors.endDate} />
          {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border p-3">
        <Switch
          id="isDefault"
          checked={!!isDefault}
          onCheckedChange={(v) => setValue("isDefault", v)}
        />
        <div>
          <Label htmlFor="isDefault" className="text-sm font-medium cursor-pointer">Set as default cycle</Label>
          <p className="text-xs text-gray-400">New applications will use this cycle by default</p>
        </div>
      </div>
    </div>
  );
}
