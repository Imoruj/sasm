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
  PowerOff,
  Trash2,
  MapPin,
  Users,
  FileText,
  Phone,
  Mail,
  Building2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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

import { NIGERIAN_STATES, getLGAs } from "@/constants/nigeria";

const branchFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(20)
    .regex(/^[A-Z0-9_-]+$/i, "Code must be alphanumeric (letters, numbers, _ -)"),
  address: z.string().min(5, "Address is required"),
  state: z.string().min(1, "State is required"),
  lga: z.string().min(1, "LGA is required"),
  city: z.string().max(100).optional(),
  phone: z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number"),
  email: z.string().email("Enter a valid email address"),
  capacity: z
    .number({ invalid_type_error: "Capacity must be a number" })
    .int()
    .min(1, "Capacity must be at least 1"),
  contactPerson: z
    .string()
    .min(2, "Contact person name is required")
    .max(255),
});

type BranchFormValues = z.infer<typeof branchFormSchema>;

interface BranchWithCounts {
  id: string;
  name: string;
  code: string;
  address: string;
  state: string;
  lga: string;
  city: string;
  phone: string;
  email: string;
  capacity: number;
  contactPerson: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    applications: number;
    users: number;
  };
}

interface BranchesManagerProps {
  initialBranches: BranchWithCounts[];
}

function BranchFormFields({
  register,
  errors,
  watch,
  setValue,
  isEditing,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: any;
  isEditing: boolean;
}) {
  const selectedState = watch("state");
  const lgas = selectedState ? getLGAs(selectedState) : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Branch Name *</Label>
          <Input
            id="name"
            placeholder="e.g. Victoria Island Campus"
            {...register("name")}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="code">Branch Code *</Label>
          <Input
            id="code"
            placeholder="e.g. VI"
            className="uppercase"
            {...register("code")}
            aria-invalid={!!errors.code}
            disabled={isEditing}
          />
          {errors.code && (
            <p className="text-xs text-destructive">{errors.code.message}</p>
          )}
          {isEditing && (
            <p className="text-xs text-muted-foreground">Code cannot be changed after creation.</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Address *</Label>
        <Input
          id="address"
          placeholder="e.g. 12 Adeola Odeku Street"
          {...register("address")}
          aria-invalid={!!errors.address}
        />
        {errors.address && (
          <p className="text-xs text-destructive">{errors.address.message}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>State *</Label>
          <Select
            value={selectedState}
            onValueChange={(val) => {
              setValue("state", val, { shouldValidate: true });
              setValue("lga", "", { shouldValidate: false });
            }}
          >
            <SelectTrigger className="w-full" aria-invalid={!!errors.state}>
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
            <p className="text-xs text-destructive">{errors.state.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>LGA *</Label>
          <Select
            value={watch("lga")}
            onValueChange={(val) => setValue("lga", val, { shouldValidate: true })}
            disabled={!selectedState}
          >
            <SelectTrigger className="w-full" aria-invalid={!!errors.lga}>
              <SelectValue placeholder={selectedState ? "Select LGA" : "Select state first"} />
            </SelectTrigger>
            <SelectContent>
              {lgas.map((lga) => (
                <SelectItem key={lga} value={lga}>
                  {lga}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.lga && (
            <p className="text-xs text-destructive">{errors.lga.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            placeholder="e.g. Lagos"
            {...register("city")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="e.g. 08012345678"
            {...register("phone")}
            aria-invalid={!!errors.phone}
          />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="e.g. vi@school.edu.ng"
            {...register("email")}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="capacity">Capacity *</Label>
          <Input
            id="capacity"
            type="number"
            min={1}
            placeholder="e.g. 300"
            {...register("capacity", { valueAsNumber: true })}
            aria-invalid={!!errors.capacity}
          />
          {errors.capacity && (
            <p className="text-xs text-destructive">{errors.capacity.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contactPerson">Contact Person *</Label>
          <Input
            id="contactPerson"
            placeholder="e.g. Mr. John Doe"
            {...register("contactPerson")}
            aria-invalid={!!errors.contactPerson}
          />
          {errors.contactPerson && (
            <p className="text-xs text-destructive">
              {errors.contactPerson.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BranchesManager({ initialBranches }: BranchesManagerProps) {
  const router = useRouter();
  const [branches, setBranches] = useState<BranchWithCounts[]>(initialBranches);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<BranchWithCounts | null>(null);
  const [deactivateBranch, setDeactivateBranch] = useState<BranchWithCounts | null>(null);
  const [deleteBranch, setDeleteBranch] = useState<BranchWithCounts | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createForm = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      name: "",
      code: "",
      address: "",
      state: "",
      lga: "",
      city: "",
      phone: "",
      email: "",
      capacity: undefined,
      contactPerson: "",
    },
  });

  const editForm = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
  });

  const handleCreate = async (data: BranchFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/super-admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Failed to create branch.");
        return;
      }
      toast.success(`Branch "${data.name}" created successfully.`);
      setCreateOpen(false);
      createForm.reset();
      router.refresh();
      // Optimistic update
      setBranches((prev) => [
        { ...json.data, _count: { applications: 0, users: 0 } },
        ...prev,
      ]);
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (data: BranchFormValues) => {
    if (!editBranch) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/branches/${editBranch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Failed to update branch.");
        return;
      }
      toast.success(`Branch "${data.name}" updated successfully.`);
      setEditBranch(null);
      router.refresh();
      setBranches((prev) =>
        prev.map((b) =>
          b.id === editBranch.id
            ? { ...b, ...json.data }
            : b
        )
      );
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateBranch) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/branches/${deactivateBranch.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Failed to deactivate branch.");
        return;
      }
      toast.success(`Branch "${deactivateBranch.name}" has been deactivated.`);
      setDeactivateBranch(null);
      router.refresh();
      setBranches((prev) =>
        prev.map((b) =>
          b.id === deactivateBranch.id ? { ...b, isActive: false } : b
        )
      );
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteBranch) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/super-admin/branches/${deleteBranch.id}?permanent=true`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Failed to delete branch.");
        return;
      }
      toast.success(`Branch "${deleteBranch.name}" has been permanently deleted.`);
      setDeleteBranch(null);
      router.refresh();
      setBranches((prev) => prev.filter((b) => b.id !== deleteBranch.id));
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (branch: BranchWithCounts) => {
    editForm.reset({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      state: branch.state,
      lga: branch.lga,
      city: branch.city ?? "",
      phone: branch.phone,
      email: branch.email,
      capacity: branch.capacity,
      contactPerson: branch.contactPerson,
    });
    setEditBranch(branch);
  };

  return (
    <div className="space-y-4">
      {/* Table Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">All Branches</h2>
          <p className="text-sm text-gray-500">{branches.length} branch{branches.length !== 1 ? "es" : ""} total</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <Button className="bg-[#1B4332] hover:bg-[#1B4332]/90" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add New Branch
            </Button>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Branch</DialogTitle>
            </DialogHeader>
            <Separator />
            <form onSubmit={createForm.handleSubmit(handleCreate)}>
              <div className="py-2">
                <BranchFormFields
                  register={createForm.register}
                  errors={createForm.formState.errors}
                  watch={createForm.watch}
                  setValue={createForm.setValue}
                  isEditing={false}
                />
              </div>
              <DialogFooter showCloseButton>
                <Button type="submit" disabled={isSubmitting} className="bg-[#1B4332] hover:bg-[#1B4332]/90">
                  {isSubmitting ? "Creating..." : "Create Branch"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Branches Table */}
      <Card>
        {branches.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No branches yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Click &quot;Add New Branch&quot; to create your first branch.
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Capacity
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Applications
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1B4332]/10 text-[#1B4332]">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{branch.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{branch.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <div>
                          <p className="text-gray-700">{branch.state}, {branch.lga}</p>
                          {branch.city && (
                            <p className="text-xs text-gray-400">{branch.city}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Phone className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs">{branch.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Mail className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs">{branch.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Users className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs">{branch.contactPerson}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="font-medium text-gray-900">
                        {branch.capacity.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {branch._count.applications}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge variant={branch.isActive ? "default" : "secondary"}>
                        {branch.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(branch)}
                          title="Edit branch"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {branch.isActive && (
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={<Button variant="ghost" size="icon-sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" title="Deactivate branch" onClick={() => setDeactivateBranch(branch)} />}
                            >
                              <PowerOff className="h-4 w-4" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deactivate Branch</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to deactivate{" "}
                                  <strong>{branch.name}</strong>? This branch will no
                                  longer accept new applications. This action can be
                                  reversed by editing the branch.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setDeactivateBranch(null)}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={handleDeactivate}
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? "Deactivating..." : "Deactivate"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger
                            render={<Button variant="ghost" size="icon-sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" title="Delete branch" onClick={() => setDeleteBranch(branch)} />}
                          >
                            <Trash2 className="h-4 w-4" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Branch Permanently</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will <strong>permanently delete</strong>{" "}
                                <strong>{branch.name}</strong> and all associated data.
                                This action <strong>cannot be undone</strong>.
                                {branch._count.applications > 0 && (
                                  <span className="mt-2 block rounded-md bg-red-50 p-2 text-red-700 text-xs font-medium">
                                    This branch has {branch._count.applications} application(s). Deletion will be blocked — deactivate it instead.
                                  </span>
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setDeleteBranch(null)}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? "Deleting..." : "Delete Permanently"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={!!editBranch}
        onOpenChange={(open) => {
          if (!open) setEditBranch(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Branch — {editBranch?.name}</DialogTitle>
          </DialogHeader>
          <Separator />
          <form onSubmit={editForm.handleSubmit(handleEdit)}>
            <div className="py-2">
              <BranchFormFields
                register={editForm.register}
                errors={editForm.formState.errors}
                watch={editForm.watch}
                setValue={editForm.setValue}
                isEditing={true}
              />
            </div>
            <DialogFooter showCloseButton>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#1B4332] hover:bg-[#1B4332]/90"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Card view for mobile breakpoint
export function BranchCard({ branch }: { branch: BranchWithCounts }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{branch.name}</CardTitle>
          <Badge variant={branch.isActive ? "default" : "secondary"}>
            {branch.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-xs font-mono text-muted-foreground">{branch.code}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-gray-400" />
          {branch.state}, {branch.lga}
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 text-gray-400" />
          {branch.phone}
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-gray-400" />
          {branch._count.applications} applications
        </div>
      </CardContent>
    </Card>
  );
}
