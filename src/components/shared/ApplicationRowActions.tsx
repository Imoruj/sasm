"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import type { ApplicationStatus } from "@prisma/client";

interface ApplicationRowActionsProps {
  id: string;
  applicationNumber: string;
  status: ApplicationStatus;
  viewHref: string;
  deleteEndpoint: string;
}

export default function ApplicationRowActions({
  id,
  applicationNumber,
  status,
  viewHref,
  deleteEndpoint,
}: ApplicationRowActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = status === "DRAFT";

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`${deleteEndpoint}/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Delete failed");
      }
      toast.success(`Application ${applicationNumber} deleted`);
      setConfirmOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors outline-none"
          aria-label="Row actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => router.push(viewHref)}
            className="cursor-pointer gap-2"
          >
            <Eye className="h-4 w-4" />
            View details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => { if (canDelete) setConfirmOpen(true); }}
            disabled={!canDelete}
            className="cursor-pointer gap-2 text-red-600 focus:text-red-600"
            variant="destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${applicationNumber}?`}
        description="This will permanently delete this draft application. This action cannot be undone."
        confirmLabel="Delete application"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
