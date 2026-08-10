"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Eye,
  Pencil,
  KeyRound,
  Trash2,
  Search,
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
import { DEFAULT_APPLICANT_PASSWORD } from "@/constants/staff";
import StatusBadge from "@/components/shared/StatusBadge";
import type { ApplicationStatus } from "@prisma/client";

export interface ApplicantUser {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  applicationCount: number;
  latestApplication: {
    id: string;
    applicationNumber: string;
    status: ApplicationStatus;
    branchName: string;
  } | null;
}

interface UsersManagerProps {
  initialUsers: ApplicantUser[];
  total: number;
}

const editSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

function UserAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
  ];
  const colorIndex = (firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length;
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${colors[colorIndex]}`}
    >
      {initials}
    </div>
  );
}

function StatusDot({ isActive }: { isActive: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500" : "bg-gray-300"}`} />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default function UsersManager({ initialUsers }: UsersManagerProps) {
  const router = useRouter();
  const [users, setUsers] = useState<ApplicantUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [viewing, setViewing] = useState<ApplicantUser | null>(null);
  const [editing, setEditing] = useState<ApplicantUser | null>(null);
  const [actionTarget, setActionTarget] = useState<ApplicantUser | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isToggleOpen, setIsToggleOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
  });

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === "ACTIVE" && !u.isActive) return false;
      if (statusFilter === "INACTIVE" && u.isActive) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = `${u.firstName} ${u.lastName}`.toLowerCase();
        if (
          !name.includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !(u.phone ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [users, search, statusFilter]);

  const openView = (user: ApplicantUser) => {
    setViewing(user);
    setIsViewOpen(true);
  };

  const openEdit = (user: ApplicantUser) => {
    setEditing(user);
    resetForm({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? "",
    });
    setIsEditOpen(true);
  };

  const onEditSubmit = async (data: EditFormValues) => {
    if (!editing) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Failed to update user");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editing.id
            ? {
                ...u,
                firstName: json.data.firstName,
                lastName: json.data.lastName,
                phone: json.data.phone,
                updatedAt: json.data.updatedAt
                  ? new Date(json.data.updatedAt).toISOString()
                  : u.updatedAt,
              }
            : u,
        ),
      );
      toast.success("User account updated");
      setIsEditOpen(false);
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPassword = async () => {
    if (!actionTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/users/${actionTarget.id}/reset-password`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Failed to reset password");
        return;
      }
      const pw = json.data?.defaultPassword ?? DEFAULT_APPLICANT_PASSWORD;
      toast.success(
        `Password for ${actionTarget.firstName} ${actionTarget.lastName} reset to default (${pw}).`,
        { duration: 8000 },
      );
      setIsResetOpen(false);
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onToggleActive = async () => {
    if (!actionTarget) return;
    setIsSubmitting(true);
    const newIsActive = !actionTarget.isActive;
    try {
      const res = await fetch(`/api/super-admin/users/${actionTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newIsActive }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Action failed");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === actionTarget.id ? { ...u, isActive: newIsActive } : u)),
      );
      toast.success(
        newIsActive
          ? `${actionTarget.firstName} ${actionTarget.lastName} reactivated`
          : `${actionTarget.firstName} ${actionTarget.lastName} deactivated`,
      );
      setIsToggleOpen(false);
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!actionTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/users/${actionTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Failed to delete user");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== actionTarget.id));
      toast.success(`${actionTarget.firstName} ${actionTarget.lastName} deleted`);
      setIsDeleteOpen(false);
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <Card>
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-50 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-1.5">
              {(
                [
                  { key: "ALL", label: "All" },
                  { key: "ACTIVE", label: "Active" },
                  { key: "INACTIVE", label: "Inactive" },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === f.key
                      ? "bg-[#1B4332] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-sm">No user accounts found matching your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-65">User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead>Latest Status</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar firstName={user.firstName} lastName={user.lastName} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{user.phone ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {user.applicationCount}
                      </Badge>
                      {user.latestApplication && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {user.latestApplication.branchName}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.latestApplication ? (
                        <StatusBadge status={user.latestApplication.status} size="sm" />
                      ) : (
                        <span className="text-xs text-muted-foreground">No applications</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusDot isActive={user.isActive} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="View account"
                                onClick={() => openView(user)}
                              />
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent side="top">View</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Edit account"
                                onClick={() => openEdit(user)}
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
                                onClick={() => {
                                  setActionTarget(user);
                                  setIsResetOpen(true);
                                }}
                              />
                            }
                          >
                            <KeyRound className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent side="top">Reset password to default</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={user.isActive ? "Deactivate" : "Reactivate"}
                                onClick={() => {
                                  setActionTarget(user);
                                  setIsToggleOpen(true);
                                }}
                              />
                            }
                          >
                            {user.isActive ? (
                              <UserX className="h-4 w-4 text-amber-600" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-green-600" />
                            )}
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {user.isActive ? "Deactivate" : "Reactivate"}
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Delete account"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setActionTarget(user);
                                  setIsDeleteOpen(true);
                                }}
                              />
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent side="top">Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>View User Account</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <UserAvatar firstName={viewing.firstName} lastName={viewing.lastName} />
                <div>
                  <p className="text-base font-semibold">
                    {viewing.firstName} {viewing.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{viewing.email}</p>
                </div>
              </div>
              <div className="rounded-lg border bg-gray-50 p-4">
                <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2.5 text-sm">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      Applicant
                    </span>
                  </dd>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium">{viewing.phone ?? "—"}</dd>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <StatusDot isActive={viewing.isActive} />
                  </dd>
                  <dt className="text-muted-foreground">Email verified</dt>
                  <dd className="font-medium">{viewing.emailVerified ? "Yes" : "No"}</dd>
                  <dt className="text-muted-foreground">Applications</dt>
                  <dd className="font-medium">{viewing.applicationCount}</dd>
                  {viewing.latestApplication && (
                    <>
                      <dt className="text-muted-foreground">Latest app</dt>
                      <dd className="font-mono text-xs">
                        {viewing.latestApplication.applicationNumber}
                      </dd>
                      <dt className="text-muted-foreground">Branch</dt>
                      <dd className="font-medium">{viewing.latestApplication.branchName}</dd>
                      <dt className="text-muted-foreground">App status</dt>
                      <dd>
                        <StatusBadge status={viewing.latestApplication.status} size="sm" />
                      </dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Last login</dt>
                  <dd className="font-medium">
                    {viewing.lastLoginAt ? formatDateTime(viewing.lastLoginAt) : "Never"}
                  </dd>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="font-medium">{formatDateTime(viewing.createdAt)}</dd>
                </dl>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsViewOpen(false);
                    openEdit(viewing);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                  onClick={() => {
                    setIsViewOpen(false);
                    setActionTarget(viewing);
                    setIsResetOpen(true);
                  }}
                >
                  <KeyRound className="h-4 w-4" />
                  Reset Password
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input id="firstName" {...register("firstName")} aria-invalid={!!errors.firstName} />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input id="lastName" {...register("lastName")} aria-invalid={!!errors.lastName} />
                {errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={editing?.email ?? ""} disabled />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" placeholder="e.g. 08012345678" {...register("phone")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#1B4332] hover:bg-[#1B4332]/90"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <AlertDialog open={isResetOpen} onOpenChange={setIsResetOpen}>
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
                  to{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    {DEFAULT_APPLICANT_PASSWORD}
                  </code>
                  . They will be emailed the new credentials.
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
                void onResetPassword();
              }}
              className="bg-[#1B4332] hover:bg-[#1B4332]/90"
            >
              {isSubmitting ? "Resetting..." : "Reset to Default"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle active */}
      <AlertDialog open={isToggleOpen} onOpenChange={setIsToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionTarget?.isActive ? "Deactivate User?" : "Reactivate User?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionTarget?.isActive ? (
                <>
                  This will prevent{" "}
                  <strong>
                    {actionTarget.firstName} {actionTarget.lastName}
                  </strong>{" "}
                  from logging in.
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
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault();
                void onToggleActive();
              }}
              className={
                actionTarget?.isActive
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-[#1B4332] hover:bg-[#1B4332]/90"
              }
            >
              {isSubmitting
                ? "Saving..."
                : actionTarget?.isActive
                  ? "Deactivate"
                  : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account?</AlertDialogTitle>
            <AlertDialogDescription>
              {actionTarget && (
                <>
                  This will permanently remove{" "}
                  <strong>
                    {actionTarget.firstName} {actionTarget.lastName}
                  </strong>
                  {actionTarget.applicationCount > 0
                    ? " (their applications will be preserved; the account will be soft-deleted)."
                    : ". This cannot be undone."}
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
                void onDelete();
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
