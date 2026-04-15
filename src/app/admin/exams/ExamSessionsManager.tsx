"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  MapPin,
  Monitor,
  Users,
  Plus,
  Pencil,
  XCircle,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDate } from "@/lib/utils";
import { CLASS_LEVELS, CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import type { ExamSessionWithCounts } from "./page";
import type { ClassLevel } from "@prisma/client";

const formSchema = z.object({
  admissionCycleId: z.string().uuid("Please select an admission cycle"),
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  examDates: z.array(z.string().min(1)).min(1, "At least one exam date is required"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  durationMinutes: z.coerce.number().int().min(30).max(480),
  mode: z.enum(["ONLINE", "ON_CAMPUS"]),
  venue: z.string().optional(),
  onlineLink: z.string().url().optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1),
  classLevels: z.array(z.enum(["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"])).min(1, "Select at least one class level"),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  initialSessions: ExamSessionWithCounts[];
  admissionCycles: { id: string; name: string; academicYear: string }[];
  branchId?: string;
}

const STATUS_CONFIG = {
  SCHEDULED: { label: "Scheduled", class: "bg-blue-100 text-blue-700 border-blue-200" },
  IN_PROGRESS: { label: "In Progress", class: "bg-amber-100 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", class: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED: { label: "Cancelled", class: "bg-red-100 text-red-700 border-red-200" },
};

const MODE_CONFIG = {
  ONLINE: { label: "Online", class: "bg-blue-100 text-blue-700 border-blue-200" },
  ON_CAMPUS: { label: "On Campus", class: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

export default function ExamSessionsManager({
  initialSessions,
  admissionCycles,
  branchId,
}: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ExamSessionWithCounts[]>(initialSessions);
  const [filterCycleId, setFilterCycleId] = useState<string>(
    admissionCycles[0]?.id ?? "all",
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ExamSessionWithCounts | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDateInput, setNewDateInput] = useState("");

  const filteredSessions =
    filterCycleId === "all"
      ? sessions
      : sessions.filter((s) => s.admissionCycleId === filterCycleId);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      admissionCycleId: admissionCycles[0]?.id ?? "",
      title: "",
      description: "",
      examDates: [],
      startTime: "09:00",
      endTime: "11:00",
      durationMinutes: 120,
      mode: "ON_CAMPUS",
      venue: "",
      onlineLink: "",
      capacity: 50,
      classLevels: [],
    },
  });

  const watchedMode = form.watch("mode");
  const watchedClassLevels = form.watch("classLevels");
  const watchedExamDates = form.watch("examDates");

  function openCreateDialog() {
    form.reset({
      admissionCycleId: admissionCycles[0]?.id ?? "",
      title: "",
      description: "",
      examDates: [],
      startTime: "09:00",
      endTime: "11:00",
      durationMinutes: 120,
      mode: "ON_CAMPUS",
      venue: "",
      onlineLink: "",
      capacity: 50,
      classLevels: [],
    });
    setNewDateInput("");
    setEditingSession(null);
    setIsCreateOpen(true);
  }

  function openEditDialog(session: ExamSessionWithCounts) {
    // Populate examDates from the session's examDates array, fall back to examDate
    const dates = session.examDates.length > 0
      ? session.examDates.map((d) => new Date(d).toISOString().split("T")[0])
      : [new Date(session.examDate).toISOString().split("T")[0]];
    form.reset({
      admissionCycleId: session.admissionCycleId,
      title: session.title,
      description: session.description ?? "",
      examDates: dates,
      startTime: session.startTime,
      endTime: session.endTime,
      durationMinutes: session.durationMinutes,
      mode: session.mode,
      venue: session.venue ?? "",
      onlineLink: session.onlineLink ?? "",
      capacity: session.capacity,
      classLevels: session.classLevels as FormValues["classLevels"],
    });
    setNewDateInput("");
    setEditingSession(session);
    setIsCreateOpen(true);
  }

  function addDate() {
    if (!newDateInput) return;
    const current = watchedExamDates as string[];
    if (current.includes(newDateInput)) return;
    const sorted = [...current, newDateInput].sort();
    form.setValue("examDates", sorted);
    setNewDateInput("");
  }

  function removeDate(date: string) {
    form.setValue("examDates", (watchedExamDates as string[]).filter((d) => d !== date));
  }

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      // examDate (primary) = first sorted date for backwards compatibility
      const examDate = (values.examDates as string[]).sort()[0];
      const payload = { ...values, examDate };

      let res: Response;
      if (editingSession) {
        res = await fetch(`/api/admin/exams/${editingSession.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, ...(branchId ? { branchId } : {}) }),
        });
      }

      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Something went wrong");
        return;
      }

      toast.success(editingSession ? "Exam session updated" : "Exam session created");
      setIsCreateOpen(false);
      router.refresh();
      // Optimistic update
      if (editingSession) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === editingSession.id
              ? { ...s, ...json.data }
              : s
          )
        );
      } else {
        setSessions((prev) => [
          ...prev,
          { ...json.data, _count: { bookings: 0 } },
        ]);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel(sessionId: string) {
    try {
      const res = await fetch(`/api/admin/exams/${sessionId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Failed to cancel session");
        return;
      }
      toast.success("Exam session cancelled");
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: "CANCELLED" } : s))
      );
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  function toggleClassLevel(level: ClassLevel) {
    const current = watchedClassLevels as ClassLevel[];
    if (current.includes(level)) {
      form.setValue("classLevels", current.filter((l) => l !== level) as FormValues["classLevels"]);
    } else {
      form.setValue("classLevels", [...current, level] as FormValues["classLevels"]);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-gray-600 whitespace-nowrap">Filter by cycle:</Label>
          <Select value={filterCycleId} onValueChange={(v) => setFilterCycleId(v ?? "all")}>
            <SelectTrigger className="w-64">
              <span className="flex-1 text-left text-sm truncate">
                {filterCycleId === "all"
                  ? "All cycles"
                  : admissionCycles.find((c) => c.id === filterCycleId)
                    ? `${admissionCycles.find((c) => c.id === filterCycleId)!.name} (${admissionCycles.find((c) => c.id === filterCycleId)!.academicYear})`
                    : "All cycles"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cycles</SelectItem>
              {admissionCycles.map((cycle) => (
                <SelectItem key={cycle.id} value={cycle.id}>
                  {cycle.name} ({cycle.academicYear})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <Button
              onClick={openCreateDialog}
              className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create Session
            </Button>

          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSession ? "Edit Exam Session" : "Create New Exam Session"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Admission Cycle */}
              <div className="space-y-1.5">
                <Label>Admission Cycle <span className="text-red-500">*</span></Label>
                <Select
                  value={form.watch("admissionCycleId")}
                  onValueChange={(v) => form.setValue("admissionCycleId", v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(() => {
                        const selected = admissionCycles.find(
                          (c) => c.id === form.watch("admissionCycleId"),
                        );
                        return selected
                          ? `${selected.name} (${selected.academicYear})`
                          : <span className="text-muted-foreground">Select cycle</span>;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {admissionCycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.academicYear})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.admissionCycleId && (
                  <p className="text-xs text-red-500">{form.formState.errors.admissionCycleId.message}</p>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label>Session Title <span className="text-red-500">*</span></Label>
                <Input
                  {...form.register("title")}
                  placeholder="e.g., JSS1 Entrance Exam – Morning Session"
                />
                {form.formState.errors.title && (
                  <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label>Description <span className="text-gray-400 text-xs">(optional)</span></Label>
                <Textarea
                  {...form.register("description")}
                  placeholder="Additional details about this exam session..."
                  rows={2}
                />
              </div>

              {/* Exam Dates — multi-date picker */}
              <div className="space-y-1.5">
                <Label>
                  Exam Dates <span className="text-red-500">*</span>
                  <span className="ml-1 text-xs font-normal text-gray-400">(add one or more dates — parents choose)</span>
                </Label>

                {/* Existing dates list */}
                {(watchedExamDates as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
                    {(watchedExamDates as string[]).map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#1B4332]/20 bg-white px-2.5 py-1 text-xs font-medium text-[#1B4332]"
                      >
                        <Calendar className="h-3 w-3" />
                        {new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        <button
                          type="button"
                          onClick={() => removeDate(d)}
                          className="ml-0.5 text-gray-400 hover:text-red-500"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add date input */}
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={newDateInput}
                    onChange={(e) => setNewDateInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDate(); } }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addDate}
                    disabled={!newDateInput}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>

                {form.formState.errors.examDates && (
                  <p className="text-xs text-red-500">
                    {typeof form.formState.errors.examDates?.message === "string"
                      ? form.formState.errors.examDates.message
                      : "At least one date is required"}
                  </p>
                )}
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Time <span className="text-red-500">*</span></Label>
                  <Input type="time" {...form.register("startTime")} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Time <span className="text-red-500">*</span></Label>
                  <Input type="time" {...form.register("endTime")} />
                </div>
              </div>

              {/* Duration + Capacity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Duration (minutes) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min={30}
                    max={480}
                    {...form.register("durationMinutes")}
                  />
                  {form.formState.errors.durationMinutes && (
                    <p className="text-xs text-red-500">{form.formState.errors.durationMinutes.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Capacity <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min={1}
                    {...form.register("capacity")}
                  />
                  {form.formState.errors.capacity && (
                    <p className="text-xs text-red-500">{form.formState.errors.capacity.message}</p>
                  )}
                </div>
              </div>

              {/* Mode toggle */}
              <div className="space-y-1.5">
                <Label>Exam Mode <span className="text-red-500">*</span></Label>
                <div className="flex gap-2">
                  {(["ON_CAMPUS", "ONLINE"] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => form.setValue("mode", m)}
                      className={cn(
                        "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                        watchedMode === m
                          ? "border-[#1B4332] bg-[#1B4332] text-white"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      {m === "ON_CAMPUS" ? "On Campus" : "Online"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Venue / Link */}
              {watchedMode === "ON_CAMPUS" && (
                <div className="space-y-1.5">
                  <Label>Venue</Label>
                  <Input
                    {...form.register("venue")}
                    placeholder="e.g., Main Examination Hall, Block A"
                  />
                </div>
              )}
              {watchedMode === "ONLINE" && (
                <div className="space-y-1.5">
                  <Label>Online Link</Label>
                  <Input
                    {...form.register("onlineLink")}
                    type="url"
                    placeholder="https://meet.example.com/exam"
                  />
                  {form.formState.errors.onlineLink && (
                    <p className="text-xs text-red-500">{form.formState.errors.onlineLink.message}</p>
                  )}
                </div>
              )}

              {/* Class Levels */}
              <div className="space-y-2">
                <Label>Class Levels <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-3 gap-2">
                  {CLASS_LEVELS.map((level) => (
                    <label
                      key={level}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors",
                        (watchedClassLevels as ClassLevel[]).includes(level)
                          ? "border-[#1B4332] bg-[#1B4332]/5"
                          : "border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <Checkbox
                        checked={(watchedClassLevels as ClassLevel[]).includes(level)}
                        onCheckedChange={() => toggleClassLevel(level)}
                      />
                      <span className="font-medium">{CLASS_LEVEL_CONFIG[level].label}</span>
                    </label>
                  ))}
                </div>
                {form.formState.errors.classLevels && (
                  <p className="text-xs text-red-500">{form.formState.errors.classLevels.message}</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                >
                  {isSubmitting
                    ? editingSession
                      ? "Saving..."
                      : "Creating..."
                    : editingSession
                    ? "Save Changes"
                    : "Create Session"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sessions list */}
      {filteredSessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No exam sessions found</p>
          <p className="mt-1 text-xs text-gray-400">
            Create your first exam session to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSessions.map((session) => {
            const fillPct = session.capacity > 0
              ? Math.round((session.bookedCount / session.capacity) * 100)
              : 0;
            const isCancelled = session.status === "CANCELLED";

            return (
              <Card
                key={session.id}
                className={cn(
                  "relative overflow-hidden transition-shadow hover:shadow-md",
                  isCancelled && "opacity-60"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
                      {session.title}
                    </CardTitle>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                          STATUS_CONFIG[session.status].class
                        )}
                      >
                        {STATUS_CONFIG[session.status].label}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                          MODE_CONFIG[session.mode].class
                        )}
                      >
                        {MODE_CONFIG[session.mode].label}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {/* Date & Time */}
                  <div className="flex flex-col gap-1 text-xs text-gray-600">
                    {session.examDates.length > 1 ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 text-gray-400 font-medium">
                          <Calendar className="h-3.5 w-3.5" />
                          {session.examDates.length} dates available
                        </span>
                        <div className="flex flex-wrap gap-1 pl-5">
                          {session.examDates.slice().sort().map((d) => (
                            <span key={String(d)} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px]">
                              {formatDate(d)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {formatDate(session.examDate)}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      {session.startTime} – {session.endTime}
                      <span className="text-gray-400">({session.durationMinutes} min)</span>
                    </span>
                    {session.venue && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        {session.venue}
                      </span>
                    )}
                    {session.onlineLink && (
                      <span className="flex items-center gap-1.5">
                        <Monitor className="h-3.5 w-3.5 text-gray-400" />
                        <a
                          href={session.onlineLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="max-w-[180px] truncate text-[#1B4332] hover:underline"
                        >
                          {session.onlineLink}
                        </a>
                      </span>
                    )}
                  </div>

                  {/* Class levels */}
                  <div className="flex flex-wrap gap-1">
                    {session.classLevels.map((level) => (
                      <span
                        key={level}
                        className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                      >
                        {CLASS_LEVEL_CONFIG[level].label}
                      </span>
                    ))}
                  </div>

                  <Separator />

                  {/* Capacity */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-gray-500">
                        <Users className="h-3.5 w-3.5" />
                        Capacity
                      </span>
                      <span className="font-medium text-gray-700">
                        {session.bookedCount} / {session.capacity} booked
                      </span>
                    </div>
                    <Progress value={fillPct} className="h-1.5">
                      <ProgressTrack className="h-1.5 bg-gray-100">
                        <ProgressIndicator
                          className={cn(
                            "h-full transition-all",
                            fillPct >= 90 ? "bg-red-500" : fillPct >= 70 ? "bg-amber-500" : "bg-[#1B4332]"
                          )}
                        />
                      </ProgressTrack>
                    </Progress>
                  </div>

                  {/* Cycle info */}
                  <p className="text-xs text-gray-400">
                    {session.admissionCycle.name} · {session.branch.name}
                  </p>

                  {/* Actions */}
                  {!isCancelled && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => openEditDialog(session)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger
                          render={<Button variant="outline" size="sm" className="flex-1 border-red-200 text-xs text-red-600 hover:bg-red-50" />}
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Cancel
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Exam Session?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will cancel &ldquo;{session.title}&rdquo; and notify booked
                              applicants. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Session</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleCancel(session.id)}
                              className="bg-red-600 text-white hover:bg-red-700"
                            >
                              Yes, Cancel Session
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
