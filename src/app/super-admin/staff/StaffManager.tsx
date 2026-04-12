"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Plus,
  Search,
  Eye,
  EyeOff,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StaffUser {
  id: string;
  email: string;
  phone: string | null;
  role: "SCHOOL_ADMIN" | "SUPER_ADMIN";
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  organizationId: string | null;
  branchId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  branch: { name: string; code: string } | null;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface StaffManagerProps {
  initialStaff: StaffUser[];
  branches: Branch[];
  total: number;
  currentUserId: string;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const staffFormSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    firstName: z.string().min(1, "First name is required").max(100),
    lastName: z.string().min(1, "Last name is required").max(100),
    phone: z.string().optional(),
    role: z.enum(["SCHOOL_ADMIN", "SUPER_ADMIN"], { required_error: "Role is required" }),
    branchId: z.string().uuid("Select a valid branch").optional(),
    temporaryPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "SCHOOL_ADMIN" && !data.branchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Branch is required for School Admin",
        path: ["branchId"],
      });
    }
  });

type StaffFormValues = z.infer<typeof staffFormSchema>;

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm the password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

// ---------------------------------------------------------------------------
// StaffAvatar helper
// ---------------------------------------------------------------------------

function StaffAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700",
  ];
  const colorIndex = (firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length;
  return (
    <div
      className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${colors[colorIndex]}`}
    >
      {initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role badge
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: "SCHOOL_ADMIN" | "SUPER_ADMIN" }) {
  if (role === "SUPER_ADMIN") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">
        Super Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-medium">
      School Admin
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------

function StatusDot({ isActive }: { isActive: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500" : "bg-gray-300"}`}
      />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function StaffManager({
  initialStaff,
  branches,
  currentUserId,
}: StaffManagerProps) {
  const router = useRouter();

  // Staff list state
  const [staff, setStaff] = useState<StaffUser[]>(initialStaff);

  // Filter state
  const [roleFilter, setRoleFilter] = useState<"ALL" | "SCHOOL_ADMIN" | "SUPER_ADMIN">("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Dialog states
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);

  // Currently selected staff for actions
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [actionTarget, setActionTarget] = useState<StaffUser | null>(null);

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password visibility
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ---------------------------------------------------------------------------
  // Staff form
  // ---------------------------------------------------------------------------

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset: resetStaffForm,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
  });

  const watchedRole = watch("role");

  const openAddDialog = () => {
    setEditingStaff(null);
    resetStaffForm({
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      role: undefined,
      branchId: undefined,
      temporaryPassword: "",
    });
    setShowTempPassword(false);
    setIsStaffDialogOpen(true);
  };

  const openEditDialog = (member: StaffUser) => {
    setEditingStaff(member);
    resetStaffForm({
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone ?? "",
      role: member.role,
      branchId: member.branchId ?? undefined,
      temporaryPassword: undefined,
    });
    setShowTempPassword(false);
    setIsStaffDialogOpen(true);
  };

  const onStaffSubmit = async (data: StaffFormValues) => {
    setIsSubmitting(true);
    try {
      if (editingStaff) {
        // Edit existing staff member
        const payload: Record<string, unknown> = {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || null,
          role: data.role,
          branchId: data.branchId ?? null,
        };

        const res = await fetch(`/api/super-admin/staff/${editingStaff.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message ?? "Failed to update staff member");
          return;
        }
        setStaff((prev) =>
          prev.map((s) => (s.id === editingStaff.id ? { ...s, ...json.data } : s))
        );
        toast.success("Staff member updated successfully");
      } else {
        // Create new staff member
        const res = await fetch("/api/super-admin/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone || undefined,
            role: data.role,
            branchId: data.branchId,
            temporaryPassword: data.temporaryPassword,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message ?? "Failed to create staff member");
          return;
        }
        setStaff((prev) => [json.data, ...prev]);
        toast.success("Staff member created successfully");
      }

      setIsStaffDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Reset password form
  // ---------------------------------------------------------------------------

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    reset: resetPasswordForm,
    formState: { errors: resetErrors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const openResetDialog = (member: StaffUser) => {
    setActionTarget(member);
    resetPasswordForm({ newPassword: "", confirmPassword: "" });
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsResetDialogOpen(true);
  };

  const onResetSubmit = async (data: ResetPasswordValues) => {
    if (!actionTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/staff/${actionTarget.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: data.newPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Failed to reset password");
        return;
      }
      toast.success(`Password reset for ${actionTarget.firstName} ${actionTarget.lastName}`);
      setIsResetDialogOpen(false);
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Deactivate / Activate
  // ---------------------------------------------------------------------------

  const openDeactivateDialog = (member: StaffUser) => {
    setActionTarget(member);
    setIsDeactivateDialogOpen(true);
  };

  const onToggleActive = async () => {
    if (!actionTarget) return;
    setIsSubmitting(true);
    const newIsActive = !actionTarget.isActive;
    try {
      const res = await fetch(`/api/super-admin/staff/${actionTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newIsActive }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Action failed");
        return;
      }
      setStaff((prev) =>
        prev.map((s) =>
          s.id === actionTarget.id ? { ...s, isActive: newIsActive } : s
        )
      );
      toast.success(
        newIsActive
          ? `${actionTarget.firstName} ${actionTarget.lastName} reactivated`
          : `${actionTarget.firstName} ${actionTarget.lastName} deactivated`
      );
      setIsDeactivateDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Filtered staff
  // ---------------------------------------------------------------------------

  const filteredStaff = useMemo(() => {
    return staff.filter((s) => {
      if (roleFilter !== "ALL" && s.role !== roleFilter) return false;
      if (branchFilter !== "ALL" && s.branchId !== branchFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
        if (!fullName.includes(q) && !s.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [staff, roleFilter, branchFilter, search]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <TooltipProvider>
      <Card>
        {/* Filter bar + Add button */}
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Role filter */}
            <Select
              value={roleFilter}
              onValueChange={(val) =>
                setRoleFilter(val as "ALL" | "SCHOOL_ADMIN" | "SUPER_ADMIN")
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="SCHOOL_ADMIN">School Admin</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>

            {/* Branch filter */}
            <Select
              value={branchFilter}
              onValueChange={(val) => setBranchFilter(val ?? "ALL")}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={openAddDialog} className="shrink-0 bg-[#1B4332] hover:bg-[#1B4332]/90">
            <Plus className="h-4 w-4" />
            Add Staff Member
          </Button>
        </div>

        <CardContent className="p-0">
          {filteredStaff.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-sm">No staff members found matching your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[260px]">Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((member) => {
                  const isSelf = member.id === currentUserId;
                  return (
                    <TableRow key={member.id}>
                      {/* Avatar + name/email */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <StaffAvatar
                            firstName={member.firstName}
                            lastName={member.lastName}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {member.firstName} {member.lastName}
                              {isSelf && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  You
                                </Badge>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Role */}
                      <TableCell>
                        <RoleBadge role={member.role} />
                      </TableCell>

                      {/* Branch */}
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {member.branch
                            ? `${member.branch.name} (${member.branch.code})`
                            : member.role === "SUPER_ADMIN"
                            ? "All Branches"
                            : "—"}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusDot isActive={member.isActive} />
                      </TableCell>

                      {/* Last login */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {member.lastLoginAt
                            ? formatDateTime(member.lastLoginAt)
                            : "Never"}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {isSelf ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={<Button variant="ghost" size="icon-sm" disabled aria-label="Cannot modify your own account" />}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              Cannot modify your own account
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Open actions menu"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openEditDialog(member)}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openResetDialog(member)}>
                                <KeyRound className="h-4 w-4" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant={member.isActive ? "destructive" : "default"}
                                onClick={() => openDeactivateDialog(member)}
                              >
                                {member.isActive ? (
                                  <>
                                    <UserX className="h-4 w-4" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4" />
                                    Reactivate
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Add / Edit Staff Dialog                                             */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={isStaffDialogOpen} onOpenChange={setIsStaffDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onStaffSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* First Name */}
              <div className="space-y-1">
                <Label htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  placeholder="e.g. Amara"
                  {...register("firstName")}
                  aria-invalid={!!errors.firstName}
                />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName.message}</p>
                )}
              </div>

              {/* Last Name */}
              <div className="space-y-1">
                <Label htmlFor="lastName">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  placeholder="e.g. Okonkwo"
                  {...register("lastName")}
                  aria-invalid={!!errors.lastName}
                />
                {errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@school.edu.ng"
                {...register("email")}
                disabled={!!editingStaff}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
              {editingStaff && (
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g. 08012345678"
                {...register("phone")}
              />
            </div>

            {/* Role */}
            <div className="space-y-1">
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watchedRole}
                onValueChange={(val) =>
                  setValue("role", val as "SCHOOL_ADMIN" | "SUPER_ADMIN", {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full" aria-invalid={!!errors.role}>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHOOL_ADMIN">School Admin</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-xs text-destructive">{errors.role.message}</p>
              )}
            </div>

            {/* Branch (required for School Admin) */}
            {watchedRole === "SCHOOL_ADMIN" && (
              <div className="space-y-1">
                <Label htmlFor="branchId">
                  Branch <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watch("branchId") ?? ""}
                  onValueChange={(val) =>
                    setValue("branchId", val ?? undefined, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.branchId}>
                    <SelectValue placeholder="Select branch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.branchId && (
                  <p className="text-xs text-destructive">{errors.branchId.message}</p>
                )}
              </div>
            )}

            {/* Temporary Password (only for new staff) */}
            {!editingStaff && (
              <div className="space-y-1">
                <Label htmlFor="temporaryPassword">
                  Temporary Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="temporaryPassword"
                    type={showTempPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    {...register("temporaryPassword")}
                    aria-invalid={!!errors.temporaryPassword}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTempPassword((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showTempPassword ? "Hide password" : "Show password"}
                  >
                    {showTempPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.temporaryPassword && (
                  <p className="text-xs text-destructive">
                    {errors.temporaryPassword.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  The staff member will use this password to log in for the first time.
                </p>
              </div>
            )}

            <DialogFooter showCloseButton>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#1B4332] hover:bg-[#1B4332]/90"
              >
                {isSubmitting
                  ? editingStaff
                    ? "Saving..."
                    : "Creating..."
                  : editingStaff
                  ? "Save Changes"
                  : "Create Staff Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Reset Password Dialog                                               */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>

          {actionTarget && (
            <p className="text-sm text-muted-foreground">
              Reset password for{" "}
              <span className="font-medium text-foreground">
                {actionTarget.firstName} {actionTarget.lastName}
              </span>
              .
            </p>
          )}

          <form onSubmit={handleResetSubmit(onResetSubmit)} className="space-y-4">
            {/* New Password */}
            <div className="space-y-1">
              <Label htmlFor="newPassword">
                New Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  {...registerReset("newPassword")}
                  aria-invalid={!!resetErrors.newPassword}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {resetErrors.newPassword && (
                <p className="text-xs text-destructive">
                  {resetErrors.newPassword.message}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">
                Confirm Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  {...registerReset("confirmPassword")}
                  aria-invalid={!!resetErrors.confirmPassword}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {resetErrors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {resetErrors.confirmPassword.message}
                </p>
              )}
            </div>

            <DialogFooter showCloseButton>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#1B4332] hover:bg-[#1B4332]/90"
              >
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Deactivate / Activate Confirmation Dialog                           */}
      {/* ------------------------------------------------------------------ */}
      <AlertDialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionTarget?.isActive ? "Deactivate Staff Member?" : "Reactivate Staff Member?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionTarget?.isActive ? (
                <>
                  This will prevent{" "}
                  <strong>
                    {actionTarget?.firstName} {actionTarget?.lastName}
                  </strong>{" "}
                  from logging in. You can reactivate them later.
                </>
              ) : (
                <>
                  This will allow{" "}
                  <strong>
                    {actionTarget?.firstName} {actionTarget?.lastName}
                  </strong>{" "}
                  to log in again.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onToggleActive}
              disabled={isSubmitting}
              variant={actionTarget?.isActive ? "destructive" : "default"}
              className={
                actionTarget?.isActive
                  ? undefined
                  : "bg-[#1B4332] hover:bg-[#1B4332]/90"
              }
            >
              {isSubmitting
                ? "Processing..."
                : actionTarget?.isActive
                ? "Deactivate"
                : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
