"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays, Clock, MapPin, Monitor, Users, QrCode,
  CheckCircle2, XCircle, Loader2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import type { ExamSessionForBooking, BookingWithSession } from "./page";

interface ApplicationSummary {
  id: string;
  applicationNumber: string;
  classApplied: string;
  status: string;
  branch: { name: string };
}

interface ExamBookingUIProps {
  applications: ApplicationSummary[];
  availableSessions: ExamSessionForBooking[];
  existingBookings: BookingWithSession[];
}

export default function ExamBookingUI({
  applications,
  availableSessions,
  existingBookings,
}: ExamBookingUIProps) {
  const router = useRouter();

  // Map applicationId → active booking
  const bookingByApp = new Map<string, BookingWithSession>();
  for (const b of existingBookings) {
    if (b.status === "BOOKED" || b.status === "CHECKED_IN") {
      bookingByApp.set(b.applicationId, b);
    }
  }

  // Date picker state: when a session has multiple dates, show a date-first dialog
  const [datePicker, setDatePicker] = useState<{
    session: ExamSessionForBooking;
    app: ApplicationSummary;
  } | null>(null);

  // Apps still waiting to be booked
  const unbookedApps = applications.filter(
    (a) => a.status === "APPROVED" && !bookingByApp.has(a.id),
  );

  // Booking loading state keyed by "sessionId:appId"
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);

  // Cancel dialog state
  const [cancelTarget, setCancelTarget] = useState<{ bookingId: string; appNumber: string } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Child picker dialog: when a session covers multiple unbooked apps
  const [pickerSession, setPickerSession] = useState<ExamSessionForBooking | null>(null);
  const [pickerApps, setPickerApps] = useState<ApplicationSummary[]>([]);

  async function bookSlot(session: ExamSessionForBooking, app: ApplicationSummary, bookedDate?: string) {
    const key = `${session.id}:${app.id}`;
    setBookingLoading(key);
    setPickerSession(null);
    setDatePicker(null);
    try {
      const res = await fetch("/api/exam-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: app.id,
          examSessionId: session.id,
          ...(bookedDate ? { bookedDate } : {}),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? "Booking failed");
      toast.success(`Booked for ${app.applicationNumber}!`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to book exam slot.");
    } finally {
      setBookingLoading(null);
    }
  }

  function handleBookClick(session: ExamSessionForBooking) {
    const eligible = unbookedApps.filter((a) =>
      session.classLevels.includes(a.classApplied as never),
    );
    if (eligible.length === 0) {
      toast.error("No eligible unbooked applications for this session.");
      return;
    }
    const app = eligible.length === 1 ? eligible[0] : null;

    // Multiple children — pick child first
    if (!app) {
      setPickerApps(eligible);
      setPickerSession(session);
      return;
    }

    // Single app — check if date selection needed
    const availableDates = session.examDates?.length > 1 ? session.examDates : null;
    if (availableDates) {
      setDatePicker({ session, app });
    } else {
      bookSlot(session, app);
    }
  }

  // Called from child picker when a child is selected — then check for date picker
  function handleChildPicked(session: ExamSessionForBooking, app: ApplicationSummary) {
    setPickerSession(null);
    const availableDates = session.examDates?.length > 1 ? session.examDates : null;
    if (availableDates) {
      setDatePicker({ session, app });
    } else {
      bookSlot(session, app);
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/exam-bookings/${cancelTarget.bookingId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? "Cancellation failed");
      toast.success("Exam booking cancelled.");
      setCancelTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking.");
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <div className="space-y-8">

      {/* ── Per-application status summary ─────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {applications.map((app) => {
          const booking = bookingByApp.get(app.id);
          return (
            <div
              key={app.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-white p-3 transition-shadow",
                booking ? "border-[#1B4332]/30 shadow-sm" : "border-gray-200",
              )}
            >
              <div className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                booking ? "bg-[#1B4332]/10" : "bg-gray-100",
              )}>
                <CheckCircle2 className={cn("h-5 w-5", booking ? "text-[#1B4332]" : "text-gray-400")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{app.applicationNumber}</p>
                <p className="text-xs text-gray-500">
                  {CLASS_LEVEL_CONFIG[app.classApplied as keyof typeof CLASS_LEVEL_CONFIG]?.label ?? app.classApplied} · {app.branch.name}
                </p>
              </div>
              <Badge className={cn(
                "shrink-0 text-xs",
                booking
                  ? "bg-blue-100 text-blue-700"
                  : "bg-green-100 text-green-700",
              )}>
                {booking ? "BOOKED" : "APPROVED"}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* ── Existing bookings ───────────────────────────────── */}
      {bookingByApp.size > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            Confirmed Bookings
            <span className="ml-2 rounded-full bg-[#1B4332]/10 px-2 py-0.5 text-xs font-medium text-[#1B4332]">
              {bookingByApp.size}
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[...bookingByApp.entries()].map(([appId, booking]) => {
              const app = applications.find((a) => a.id === appId);
              return (
                <Card key={booking.id} className="border-[#1B4332]/20 bg-[#1B4332]/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 text-[#1B4332]">
                        <QrCode className="h-4 w-4" />
                        {app?.applicationNumber ?? "Application"}
                      </span>
                      <span className="text-xs font-normal text-gray-500">
                        {CLASS_LEVEL_CONFIG[app?.classApplied as keyof typeof CLASS_LEVEL_CONFIG]?.label ?? app?.classApplied} · {app?.branch.name}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-1">
                    <div className="grid gap-2 sm:grid-cols-2 text-xs">
                      <InfoRow
                        icon={<CalendarDays className="h-3.5 w-3.5 text-gray-400" />}
                        label="Your Exam Date"
                        value={formatDate(booking.bookedDate ?? booking.examSession.examDate)}
                      />
                      <InfoRow
                        icon={<Clock className="h-3.5 w-3.5 text-gray-400" />}
                        label="Time"
                        value={`${booking.examSession.startTime} – ${booking.examSession.endTime}`}
                      />
                      <InfoRow
                        icon={booking.examSession.mode === "ONLINE"
                          ? <Monitor className="h-3.5 w-3.5 text-gray-400" />
                          : <MapPin className="h-3.5 w-3.5 text-gray-400" />}
                        label={booking.examSession.mode === "ONLINE" ? "Mode" : "Venue"}
                        value={
                          booking.examSession.mode === "ONLINE"
                            ? "Online"
                            : (booking.examSession.venue ?? "To be announced")
                        }
                      />
                      {booking.seatNumber && (
                        <InfoRow
                          icon={<Users className="h-3.5 w-3.5 text-gray-400" />}
                          label="Seat"
                          value={booking.seatNumber}
                        />
                      )}
                    </div>

                    {/* QR reference */}
                    <div className="rounded-lg border border-[#1B4332]/20 bg-white px-3 py-2 text-center">
                      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Booking Reference
                      </p>
                      <p className="font-mono text-sm font-bold tracking-widest text-[#1B4332]">
                        {booking.qrCode}
                      </p>
                    </div>

                    {booking.status === "BOOKED" && (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        onClick={() =>
                          setCancelTarget({
                            bookingId: booking.id,
                            appNumber: app?.applicationNumber ?? "this application",
                          })
                        }
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel Booking
                      </button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Available sessions (only shown when there are still unbooked apps) ─ */}
      {unbookedApps.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Available Exam Sessions</h2>
            {unbookedApps.length > 0 && (
              <span className="text-xs text-gray-500">
                {unbookedApps.length} application{unbookedApps.length > 1 ? "s" : ""} awaiting booking
              </span>
            )}
          </div>

          {availableSessions.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CalendarDays className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">No exam sessions available yet</p>
                <p className="mt-1 text-xs text-gray-400">
                  Exam sessions will appear here once scheduled by the school.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availableSessions.map((session) => {
                const eligible = unbookedApps.filter((a) =>
                  session.classLevels.includes(a.classApplied as never),
                );
                const available = session.capacity - session.bookedCount;
                const fillPct = Math.round((session.bookedCount / session.capacity) * 100);
                const isFull = available <= 0;
                const isLow = !isFull && fillPct >= 80;
                const noEligible = eligible.length === 0;
                // Loading key for any of the eligible apps
                const isLoading = eligible.some((a) =>
                  bookingLoading === `${session.id}:${a.id}`,
                );

                return (
                  <Card
                    key={session.id}
                    className={cn(
                      "transition-shadow hover:shadow-md",
                      (isFull || noEligible) && "opacity-60",
                    )}
                  >
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight text-gray-900">
                          {session.title}
                        </p>
                        <Badge className={cn(
                          "shrink-0 text-xs",
                          session.mode === "ONLINE"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700",
                        )}>
                          {session.mode === "ONLINE" ? "Online" : "On-Campus"}
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-xs text-gray-500">
                        {session.examDates?.length > 1 ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-medium text-[#1B4332]">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {session.examDates.length} dates — you choose
                            </div>
                            <div className="flex flex-wrap gap-1 pl-5">
                              {session.examDates
                                .slice()
                                .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                                .map((d) => (
                                  <span key={String(d)} className="rounded bg-[#1B4332]/8 px-1.5 py-0.5 text-[11px] text-[#1B4332]">
                                    {formatDate(d)}
                                  </span>
                                ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(session.examDate)}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {session.startTime} – {session.endTime} ({session.durationMinutes} mins)
                        </div>
                        {session.mode === "ON_CAMPUS" && session.venue && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {session.venue}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {session.classLevels.map((cl) => (
                          <span
                            key={cl}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {CLASS_LEVEL_CONFIG[cl as keyof typeof CLASS_LEVEL_CONFIG]?.label ?? cl}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span>
                          {isFull ? (
                            <span className="font-medium text-red-600">Fully Booked</span>
                          ) : (
                            <span className={cn("font-medium", isLow ? "text-amber-600" : "text-green-600")}>
                              {available} slot{available !== 1 ? "s" : ""} left
                            </span>
                          )}
                        </span>
                        <span className="text-gray-400">
                          {session.bookedCount}/{session.capacity}
                        </span>
                      </div>

                      <Button
                        className="w-full bg-[#1B4332] hover:bg-[#1B4332]/90 text-white text-xs"
                        size="sm"
                        disabled={isFull || noEligible || isLoading}
                        onClick={() => handleBookClick(session)}
                      >
                        {isLoading ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Booking…</>
                        ) : isFull ? (
                          "Fully Booked"
                        ) : noEligible ? (
                          "Already Booked"
                        ) : (
                          "Book This Slot"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── All booked, nothing left ────────────────────────── */}
      {unbookedApps.length === 0 && bookingByApp.size > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
          <p className="text-sm font-semibold text-green-800">All applications have been booked</p>
          <p className="mt-1 text-xs text-green-700">
            Each child has an exam slot. You'll receive details via email.
          </p>
        </div>
      )}

      {/* ── Child picker dialog (multiple children match a session) ── */}
      <Dialog open={!!pickerSession} onOpenChange={(open) => { if (!open) setPickerSession(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Child</DialogTitle>
            <DialogDescription>
              Multiple applications are eligible for <strong>{pickerSession?.title}</strong>.
              Choose which child to book for.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {pickerApps.map((app) => (
              <button
                key={app.id}
                disabled={!!bookingLoading}
                onClick={() => pickerSession && handleChildPicked(pickerSession, app)}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#1B4332]/40 hover:bg-[#1B4332]/5 disabled:opacity-50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B4332]/10">
                  <CheckCircle2 className="h-5 w-5 text-[#1B4332]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{app.applicationNumber}</p>
                  <p className="text-xs text-gray-500">
                    {CLASS_LEVEL_CONFIG[app.classApplied as keyof typeof CLASS_LEVEL_CONFIG]?.label ?? app.classApplied} · {app.branch.name}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Date picker dialog (session has multiple dates) ── */}
      <Dialog open={!!datePicker} onOpenChange={(open) => { if (!open) setDatePicker(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose Your Exam Date</DialogTitle>
            <DialogDescription>
              Select the date that best suits your schedule for{" "}
              <strong>{datePicker?.session.title}</strong>.
              {datePicker?.app && (
                <span className="block mt-1 text-xs">
                  Booking for: <strong>{datePicker.app.applicationNumber}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {datePicker?.session.examDates
              .slice()
              .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
              .map((d) => {
                const dateObj = new Date(d);
                const dateStr = dateObj.toISOString().split("T")[0];
                const formatted = dateObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
                return (
                  <button
                    key={dateStr}
                    disabled={!!bookingLoading}
                    onClick={() =>
                      datePicker && bookSlot(datePicker.session, datePicker.app, dateStr)
                    }
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-[#1B4332]/40 hover:bg-[#1B4332]/5 disabled:opacity-50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B4332]/10">
                      <CalendarDays className="h-5 w-5 text-[#1B4332]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{formatted}</p>
                      <p className="text-xs text-gray-500">
                        {datePicker.session.startTime} – {datePicker.session.endTime} ({datePicker.session.durationMinutes} mins)
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel confirmation dialog ──────────────────────── */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Exam Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the exam slot for <strong>{cancelTarget?.appNumber}</strong>.
              The application will return to Approved status and you can rebook a different slot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelLoading ? "Cancelling…" : "Yes, Cancel Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-[10px] text-gray-400">{label}</p>
        <p className="text-xs font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
