"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
  ShieldCheck,
  Trash2,
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
  Select,
  SelectTrigger,
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/utils";
import { getDefaultStaffPassword } from "@/constants/staff";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StaffPermissions = {
  applications?: boolean;
  forms?: boolean;
  exams?: boolean;
  communications?: boolean;
  reports?: boolean;
  settings?: boolean;
};

export const PERMISSION_DEFS = [
  { key: "applications",  label: "Applications",   desc: "View and manage applicant submissions" },
  { key: "forms",         label: "Form Builder",   desc: "Create and edit admission form templates" },
  { key: "exams",         label: "Exams",          desc: "Schedule and manage placement test sessions" },
  { key: "communications",label: "Communications", desc: "Send emails and SMS to applicants" },
  { key: "reports",       label: "Reports",        desc: "View analytics and generate reports" },
  { key: "settings",      label: "Settings",       desc: "Manage school settings and fee structures" },
] as const;

export type PermissionKey = typeof PERMISSION_DEFS[number]["key"];

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
  permissions: StaffPermissions;
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
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Currently selected staff for actions
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [viewingStaff, setViewingStaff] = useState<StaffUser | null>(null);
  const [actionTarget, setActionTarget] = useState<StaffUser | null>(null);

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password visibility
  const [showTempPassword, setShowTempPassword] = useState(false);

  // Permissions state (for School Admin)
  const defaultPermissions: StaffPermissions = {
    applications: true, forms: false, exams: false,
    communications: false, reports: false, settings: false,
  };
  const [permissions, setPermissions] = useState<StaffPermissions>(defaultPermissions);

  // Wizard step state
  const [wizardStep, setWizardStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Stable step list: fixed when the dialog opens, not recomputed on every render.
  // This prevents the step count from shrinking mid-wizard if watchedRole is briefly undefined.
  const [stableStepIds, setStableStepIds] = useState<WizardStepId[]>(["basic", "role", "password"]);

  // ---------------------------------------------------------------------------
  // Staff form
  // ---------------------------------------------------------------------------

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    reset: resetStaffForm,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
  });

  const watchedRole = watch("role");

  const buildStepIds = (role: "SCHOOL_ADMIN" | "SUPER_ADMIN" | undefined, isEdit: boolean): WizardStepId[] => {
    const ids: WizardStepId[] = ["basic", "role"];
    if (role === "SCHOOL_ADMIN") ids.push("permissions");
    if (!isEdit) ids.push("password");
    return ids;
  };

  const openAddDialog = () => {
    setEditingStaff(null);
    resetStaffForm({ email: "", firstName: "", lastName: "", phone: "", role: undefined, branchId: undefined, temporaryPassword: "" });
    setPermissions(defaultPermissions);
    setShowTempPassword(false);
    setWizardStep(0);
    setSubmitError(null);
    // New staff: role unknown yet — start with basic steps, will expand when role chosen
    setStableStepIds(["basic", "role", "password"]);
    setIsStaffDialogOpen(true);
  };

  const openEditDialog = (member: StaffUser) => {
    setEditingStaff(member);
    resetStaffForm({ email: member.email, firstName: member.firstName, lastName: member.lastName, phone: member.phone ?? "", role: member.role, branchId: member.branchId ?? undefined, temporaryPassword: undefined });
    setPermissions(member.permissions ?? defaultPermissions);
    setShowTempPassword(false);
    setWizardStep(0);
    setSubmitError(null);
    // Fix steps at open time based on known role — prevents mid-wizard shrinkage
    setStableStepIds(buildStepIds(member.role, true));
    setIsStaffDialogOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Wizard step logic
  // ---------------------------------------------------------------------------

  type WizardStepId = "basic" | "role" | "permissions" | "password";

  const currentStepId = stableStepIds[wizardStep] ?? "basic";
  const isLastStep = wizardStep === stableStepIds.length - 1;

  const WIZARD_STEP_LABELS: Record<WizardStepId, string> = {
    basic: "Basic Info",
    role: "Role & Branch",
    permissions: "Feature Access",
    password: "Set Password",
  };

  const STEP_VALIDATION_FIELDS: Record<WizardStepId, (keyof StaffFormValues)[]> = {
    basic: ["firstName", "lastName", "email"],
    role: ["role", "branchId"],
    permissions: [],
    password: ["temporaryPassword"],
  };

  const handleWizardNext = async () => {
    const fields = STEP_VALIDATION_FIELDS[currentStepId];
    const valid = fields.length > 0 ? await trigger(fields) : true;
    if (!valid) return;
    setSubmitError(null);
    setWizardStep((s) => s + 1);
  };

  const handleWizardBack = () => {
    setWizardStep((s) => Math.max(0, s - 1));
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
          permissions: data.role === "SCHOOL_ADMIN" ? permissions : {},
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
        setSubmitError(null);
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
            permissions: data.role === "SCHOOL_ADMIN" ? permissions : {},
          }),
        });
        const json = await res.json();
        if (!json.success) {
          const msg = json.error?.message ?? "Failed to create staff member";
          setSubmitError(msg);
          // If email conflict, go back to Basic Info step so they can fix the email
          if (res.status === 409) setWizardStep(0);
          return;
        }
        setStaff((prev) => [json.data, ...prev]);
        if (json.data.emailSent) {
          toast.success("Staff member created — welcome email sent.");
        } else {
          toast.success("Staff member created.");
          toast.warning(
            `Welcome email could not be sent: ${json.data.emailError ?? "Unknown error"}. Share credentials manually.`,
            { duration: 8000 },
          );
        }
      }

      setIsStaffDialogOpen(false);
      router.refresh();
    } catch {
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // View account
  // ---------------------------------------------------------------------------

  const openViewDialog = (member: StaffUser) => {
    setViewingStaff(member);
    setIsViewDialogOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Reset password to default
  // ---------------------------------------------------------------------------

  const openResetDialog = (member: StaffUser) => {
    setActionTarget(member);
    setIsResetDialogOpen(true);
  };

  const onResetToDefault = async () => {
    if (!actionTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/staff/${actionTarget.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useDefault: true }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Failed to reset password");
        return;
      }
      const defaultPw =
        json.data?.defaultPassword ??
        getDefaultStaffPassword(actionTarget.role);
      toast.success(
        `Password for ${actionTarget.firstName} ${actionTarget.lastName} reset to default (${defaultPw}). They’ve been emailed the new credentials.`,
        { duration: 8000 },
      );
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
  // Delete staff
  // ---------------------------------------------------------------------------

  const openDeleteDialog = (member: StaffUser) => {
    setActionTarget(member);
    setIsDeleteDialogOpen(true);
  };

  const onDeleteStaff = async () => {
    if (!actionTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/staff/${actionTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Failed to delete staff member");
        return;
      }
      setStaff((prev) => prev.filter((s) => s.id !== actionTarget.id));
      toast.success(`${actionTarget.firstName} ${actionTarget.lastName} has been permanently deleted`);
      setIsDeleteDialogOpen(false);
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
                <span>
                  {roleFilter === "ALL" ? "All Roles" : roleFilter === "SCHOOL_ADMIN" ? "School Admin" : "Super Admin"}
                </span>
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
                <span>
                  {branchFilter === "ALL" ? "All Branches" : (branches.find((b) => b.id === branchFilter)?.name ?? "All Branches")}
                </span>
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
                  <TableHead>Access</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-[160px] text-right">Actions</TableHead>
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

                      {/* Access / Permissions */}
                      <TableCell>
                        {member.role === "SUPER_ADMIN" ? (
                          <span className="text-xs text-muted-foreground">Full access</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {PERMISSION_DEFS.filter(({ key }) => member.permissions?.[key as PermissionKey]).map(({ key, label }) => (
                              <span key={key} className="inline-flex items-center rounded-full bg-[#1B4332]/10 text-[#1B4332] px-2 py-0.5 text-[10px] font-medium">
                                {label}
                              </span>
                            ))}
                            {!PERMISSION_DEFS.some(({ key }) => member.permissions?.[key as PermissionKey]) && (
                              <span className="text-xs text-muted-foreground">No access</span>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* Last login */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {member.lastLoginAt
                            ? formatDateTime(member.lastLoginAt)
                            : "Never"}
                        </span>
                      </TableCell>

                      {/* Actions: View / Edit / Reset / Delete */}
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="View account"
                                  onClick={() => openViewDialog(member)}
                                />
                              }
                            >
                              <Eye className="h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent side="top">View</TooltipContent>
                          </Tooltip>

                          {isSelf ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    disabled
                                    aria-label="Cannot modify your own account"
                                  />
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Cannot modify your own account
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="Edit account"
                                      onClick={() => openEditDialog(member)}
                                    />
                                  }
                                >
                                  <Pencil className="h-4 w-4" />
                                </TooltipTrigger>
                                <TooltipContent side="top">Edit</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="Reset password to default"
                                      onClick={() => openResetDialog(member)}
                                    />
                                  }
                                >
                                  <KeyRound className="h-4 w-4" />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  Reset password to default
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={
                                        member.isActive ? "Deactivate account" : "Reactivate account"
                                      }
                                      onClick={() => openDeactivateDialog(member)}
                                    />
                                  }
                                >
                                  {member.isActive ? (
                                    <UserX className="h-4 w-4 text-amber-600" />
                                  ) : (
                                    <UserCheck className="h-4 w-4 text-green-600" />
                                  )}
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  {member.isActive ? "Deactivate" : "Reactivate"}
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label="Delete account"
                                      onClick={() => openDeleteDialog(member)}
                                      className="text-destructive hover:text-destructive"
                                    />
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </TooltipTrigger>
                                <TooltipContent side="top">Delete</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                        </div>
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
      {/* Add / Edit Staff Dialog — Wizard                                   */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={isStaffDialogOpen}
        onOpenChange={(open, details) => {
          // Only allow closing via the X button (closePress), not backdrop or Escape
          if (!open && details.reason !== "close-press") return;
          setIsStaffDialogOpen(open);
        }}
        disablePointerDismissal
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-0 mb-2">
            {stableStepIds.map((stepId, idx) => (
              <div key={stepId} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                      idx < wizardStep
                        ? "bg-[#1B4332] border-[#1B4332] text-white"
                        : idx === wizardStep
                        ? "border-[#1B4332] text-[#1B4332] bg-white"
                        : "border-gray-200 text-gray-400 bg-white"
                    }`}
                  >
                    {idx < wizardStep ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className={`mt-1 text-[10px] font-medium whitespace-nowrap ${idx === wizardStep ? "text-[#1B4332]" : "text-gray-400"}`}>
                    {WIZARD_STEP_LABELS[stepId]}
                  </span>
                </div>
                {idx < stableStepIds.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 mt-[-14px] transition-colors ${idx < wizardStep ? "bg-[#1B4332]" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>

          <Separator className="mb-4" />

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Step 0 — Basic Info */}
            {currentStepId === "basic" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                    <Input id="firstName" placeholder="e.g. Amara" {...register("firstName")} aria-invalid={!!errors.firstName} />
                    {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                    <Input id="lastName" placeholder="e.g. Okonkwo" {...register("lastName")} aria-invalid={!!errors.lastName} />
                    {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                  <Input id="email" type="email" placeholder="admin@school.edu.ng" {...register("email")} disabled={!!editingStaff} aria-invalid={!!errors.email} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  {editingStaff && <p className="text-xs text-muted-foreground">Email cannot be changed</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input id="phone" type="tel" placeholder="e.g. 08012345678" {...register("phone")} />
                </div>
              </div>
            )}

            {/* Step 1 — Role & Branch */}
            {currentStepId === "role" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Role <span className="text-destructive">*</span></Label>
                  <Select
                    value={watchedRole ?? ""}
                    onValueChange={(val) => {
                      const role = val as "SCHOOL_ADMIN" | "SUPER_ADMIN";
                      setValue("role", role, { shouldValidate: true });
                      // Rebuild stable step list immediately when role changes
                      setStableStepIds(buildStepIds(role, !!editingStaff));
                    }}
                  >
                    <SelectTrigger className="w-full" aria-invalid={!!errors.role}>
                      <span className={watchedRole ? "text-foreground" : "text-muted-foreground"}>
                        {watchedRole === "SCHOOL_ADMIN" ? "School Admin" : watchedRole === "SUPER_ADMIN" ? "Super Admin" : "Select role..."}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHOOL_ADMIN">School Admin</SelectItem>
                      <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
                </div>

                {watchedRole === "SUPER_ADMIN" && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                    <div className="flex gap-2">
                      <ShieldCheck className="h-4 w-4 text-[#1B4332] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[#1B4332]">Super Admin — Full Access</p>
                        <p className="text-xs text-green-700 mt-0.5">This role has unrestricted access to all branches and features.</p>
                      </div>
                    </div>
                  </div>
                )}

                {watchedRole === "SCHOOL_ADMIN" && (
                  <div className="space-y-1">
                    <Label>Branch <span className="text-destructive">*</span></Label>
                    <Select
                      value={watch("branchId") ?? ""}
                      onValueChange={(val) => setValue("branchId", val ?? undefined, { shouldValidate: true })}
                    >
                      <SelectTrigger className="w-full" aria-invalid={!!errors.branchId}>
                        <span className={watch("branchId") ? "text-foreground" : "text-muted-foreground"}>
                          {branches.find((b) => b.id === watch("branchId"))?.name ?? "Select branch..."}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.branchId && <p className="text-xs text-destructive">{errors.branchId.message}</p>}
                    <p className="text-xs text-muted-foreground">School Admins can only manage applications for their assigned branch.</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 — Feature Access (SCHOOL_ADMIN only) */}
            {currentStepId === "permissions" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-4 w-4 text-[#1B4332]" />
                  <span className="text-sm font-semibold">Feature Access</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose which sections of the admin portal this user can access.
                </p>
                <div className="rounded-lg border divide-y">
                  {PERMISSION_DEFS.map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-3 px-3 py-3">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <Switch
                        checked={!!permissions[key as PermissionKey]}
                        onCheckedChange={(v) => setPermissions((prev) => ({ ...prev, [key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 — Set Password (new staff only) */}
            {currentStepId === "password" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="temporaryPassword">Temporary Password <span className="text-destructive">*</span></Label>
                    <button
                      type="button"
                      onClick={() => {
                        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
                        const generated =
                          Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("") + "A1!";
                        setValue("temporaryPassword", generated, { shouldValidate: true });
                        setShowTempPassword(true);
                      }}
                      className="text-xs font-medium text-[#1B4332] hover:underline"
                    >
                      Auto-generate
                    </button>
                  </div>
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
                      {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.temporaryPassword && <p className="text-xs text-destructive">{errors.temporaryPassword.message}</p>}
                  <p className="text-xs text-muted-foreground">The staff member will use this to log in for the first time.</p>
                </div>

                {/* Summary card */}
                <div className="rounded-lg bg-gray-50 border p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{watch("firstName")} {watch("lastName")}</span>
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-medium truncate">{watch("email")}</span>
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium">{watchedRole === "SUPER_ADMIN" ? "Super Admin" : "School Admin"}</span>
                    {watchedRole === "SCHOOL_ADMIN" && watch("branchId") && (
                      <>
                        <span className="text-muted-foreground">Branch</span>
                        <span className="font-medium">{branches.find((b) => b.id === watch("branchId"))?.name ?? "—"}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Inline error banner */}
            {submitError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {/* Navigation footer */}
            <div className={`flex mt-4 ${wizardStep > 0 ? "justify-between" : "justify-end"}`}>
              {wizardStep > 0 && (
                <Button type="button" variant="outline" onClick={handleWizardBack} disabled={isSubmitting}>
                  Back
                </Button>
              )}
              {isLastStep ? (
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSubmit(onStaffSubmit)()}
                  className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                >
                  {isSubmitting ? (editingStaff ? "Saving..." : "Creating...") : (editingStaff ? "Save Changes" : "Create Staff Member")}
                </Button>
              ) : (
                <Button type="button" onClick={handleWizardNext} className="bg-[#1B4332] hover:bg-[#1B4332]/90">
                  Next
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* View Account Dialog                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>View User Account</DialogTitle>
          </DialogHeader>

          {viewingStaff && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <StaffAvatar
                  firstName={viewingStaff.firstName}
                  lastName={viewingStaff.lastName}
                />
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {viewingStaff.firstName} {viewingStaff.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{viewingStaff.email}</p>
                </div>
              </div>

              <div className="rounded-lg border bg-gray-50 p-4">
                <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-sm">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd><RoleBadge role={viewingStaff.role} /></dd>

                  <dt className="text-muted-foreground">Branch</dt>
                  <dd className="font-medium">
                    {viewingStaff.branch
                      ? `${viewingStaff.branch.name} (${viewingStaff.branch.code})`
                      : viewingStaff.role === "SUPER_ADMIN"
                        ? "All Branches"
                        : "—"}
                  </dd>

                  <dt className="text-muted-foreground">Status</dt>
                  <dd><StatusDot isActive={viewingStaff.isActive} /></dd>

                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium">{viewingStaff.phone ?? "—"}</dd>

                  <dt className="text-muted-foreground">Email verified</dt>
                  <dd className="font-medium">{viewingStaff.emailVerified ? "Yes" : "No"}</dd>

                  <dt className="text-muted-foreground">Last login</dt>
                  <dd className="font-medium">
                    {viewingStaff.lastLoginAt
                      ? formatDateTime(viewingStaff.lastLoginAt)
                      : "Never"}
                  </dd>

                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="font-medium">{formatDateTime(viewingStaff.createdAt)}</dd>

                  <dt className="text-muted-foreground">Access</dt>
                  <dd>
                    {viewingStaff.role === "SUPER_ADMIN" ? (
                      <span className="text-sm">Full access</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {PERMISSION_DEFS.filter(
                          ({ key }) => viewingStaff.permissions?.[key as PermissionKey],
                        ).map(({ key, label }) => (
                          <span
                            key={key}
                            className="inline-flex items-center rounded-full bg-[#1B4332]/10 text-[#1B4332] px-2 py-0.5 text-[10px] font-medium"
                          >
                            {label}
                          </span>
                        ))}
                        {!PERMISSION_DEFS.some(
                          ({ key }) => viewingStaff.permissions?.[key as PermissionKey],
                        ) && (
                          <span className="text-xs text-muted-foreground">No access</span>
                        )}
                      </div>
                    )}
                  </dd>
                </dl>
              </div>

              {viewingStaff.id !== currentUserId && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      openEditDialog(viewingStaff);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      openResetDialog(viewingStaff);
                    }}
                  >
                    <KeyRound className="h-4 w-4" />
                    Reset Password
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Reset Password to Default Confirmation                              */}
      {/* ------------------------------------------------------------------ */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password to Default?</AlertDialogTitle>
            <AlertDialogDescription>
              {actionTarget && (
                <>
                  This will reset the password for{" "}
                  <strong>
                    {actionTarget.firstName} {actionTarget.lastName}
                  </strong>{" "}
                  to the default{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                    {getDefaultStaffPassword(actionTarget.role)}
                  </code>
                  . They will receive an email with the new credentials, and any
                  account lockout will be cleared.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault();
                void onResetToDefault();
              }}
              className="bg-[#1B4332] hover:bg-[#1B4332]/90"
            >
              {isSubmitting ? "Resetting..." : "Reset to Default"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      {/* ------------------------------------------------------------------ */}
      {/* Delete Staff Confirmation Dialog                                    */}
      {/* ------------------------------------------------------------------ */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Permanently Delete Staff Member?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>
                {actionTarget?.firstName} {actionTarget?.lastName}
              </strong>{" "}
              ({actionTarget?.email}) and all their associated data.
            </AlertDialogDescription>
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mt-2">
              <strong>This action cannot be undone.</strong> The user will lose all access and their account cannot be recovered.
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteStaff}
              disabled={isSubmitting}
              variant="destructive"
            >
              {isSubmitting ? "Deleting..." : "Yes, Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
