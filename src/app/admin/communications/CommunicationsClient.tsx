"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Send, Users, Clock, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/utils";
import { APPLICATION_STATUS_CONFIG } from "@/constants/statuses";
import { CLASS_LEVELS, CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import type { ApplicationStatus, ClassLevel } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Log {
  id: string;
  createdAt: Date;
  changes: Record<string, unknown> | null;
  user: { firstName: string; lastName: string };
}

interface Branch {
  id: string;
  name: string;
}

interface Props {
  initialLogs: Log[];
  branches: Branch[];
  isBranchAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  subject: z.string().min(3, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  filterStatus: z.string().optional(),
  filterClass: z.string().optional(),
  filterBranchId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const ALL_STATUSES = Object.keys(APPLICATION_STATUS_CONFIG) as ApplicationStatus[];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CommunicationsClient({ initialLogs, branches, isBranchAdmin }: Props) {
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [showCompose, setShowCompose] = useState(true);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject: "", message: "", filterStatus: "", filterClass: "", filterBranchId: "" },
  });

  const filterStatus = watch("filterStatus");
  const filterClass = watch("filterClass");
  const filterBranchId = watch("filterBranchId");

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await fetch("/api/admin/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: data.subject,
          message: data.message,
          filter: {
            status: data.filterStatus || undefined,
            classApplied: data.filterClass || undefined,
            branchId: data.filterBranchId || undefined,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Failed to send communication.");
        return;
      }
      const sent = json.data.sent as number;
      toast.success(`Message sent to ${sent} applicant${sent !== 1 ? "s" : ""}.`);
      setRecipientCount(sent);
      reset();
      // Refresh logs
      const logsRes = await fetch("/api/admin/communications");
      const logsJson = await logsRes.json();
      if (logsJson.success) setLogs(logsJson.data.logs);
    } catch {
      toast.error("An unexpected error occurred.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Compose */}
      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setShowCompose((v) => !v)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Compose Message</CardTitle>
              <CardDescription className="mt-0.5 text-sm">
                Send an email + in-app notification to applicants
              </CardDescription>
            </div>
            {showCompose ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </CardHeader>

        {showCompose && (
          <>
            <Separator />
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Recipient Filters */}
                <div>
                  <p className="mb-3 text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-gray-400" />
                    Recipients
                    <span className="text-xs text-gray-400 font-normal">(leave blank to message all applicants)</span>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {/* Status filter */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">By Status</Label>
                      <Select value={filterStatus ?? undefined} onValueChange={(v) => setValue("filterStatus", !v || v === "_all" ? "" : v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">All statuses</SelectItem>
                          {ALL_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {APPLICATION_STATUS_CONFIG[s].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Class filter */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">By Class Level</Label>
                      <Select value={filterClass ?? undefined} onValueChange={(v) => setValue("filterClass", !v || v === "_all" ? "" : v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All classes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">All classes</SelectItem>
                          {CLASS_LEVELS.map((cl) => (
                            <SelectItem key={cl} value={cl}>
                              {CLASS_LEVEL_CONFIG[cl as ClassLevel].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Branch filter (only for super admin) */}
                    {!isBranchAdmin && branches.length > 1 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-500">By Branch</Label>
                        <Select value={filterBranchId ?? undefined} onValueChange={(v) => setValue("filterBranchId", !v || v === "_all" ? "" : v)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All branches" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_all">All branches</SelectItem>
                            {branches.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Message fields */}
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    placeholder="e.g. Important: Entrance Exam Schedule"
                    {...register("subject")}
                    aria-invalid={!!errors.subject}
                  />
                  {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">Message *</Label>
                  <textarea
                    id="message"
                    rows={6}
                    placeholder="Type your message here..."
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                    {...register("message")}
                    aria-invalid={!!errors.message}
                  />
                  {errors.message && <p className="text-xs text-destructive">{errors.message.message}</p>}
                  <p className="text-xs text-gray-400">Recipients will receive this via email and as an in-app notification.</p>
                </div>

                {recipientCount !== null && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Last message delivered to {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}.
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#1B4332] hover:bg-[#1B4332]/90"
                  >
                    {isSubmitting ? (
                      "Sending..."
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>

      {/* Sent History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            Sent History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No messages sent yet</p>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const changes = log.changes as { subject?: string; filter?: Record<string, string>; recipientCount?: number } | null;
                return (
                  <div key={log.id} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {changes?.subject ?? "—"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {changes?.filter?.status && (
                            <Badge variant="secondary" className="text-xs">
                              Status: {APPLICATION_STATUS_CONFIG[changes.filter.status as ApplicationStatus]?.label ?? changes.filter.status}
                            </Badge>
                          )}
                          {changes?.filter?.classApplied && (
                            <Badge variant="secondary" className="text-xs">
                              Class: {changes.filter.classApplied}
                            </Badge>
                          )}
                          {changes?.recipientCount !== undefined && (
                            <span className="text-xs text-gray-500">
                              {changes.recipientCount} recipient{changes.recipientCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-gray-500">{formatDateTime(log.createdAt)}</p>
                        <p className="text-xs text-gray-400">
                          {log.user.firstName} {log.user.lastName}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
