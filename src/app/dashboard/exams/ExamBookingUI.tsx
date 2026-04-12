"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Clock, MapPin, Monitor, Users, QrCode, CheckCircle2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const activeBooking = existingBookings.find((b) => b.status === "BOOKED" || b.status === "CHECKED_IN");
  const bookedApp = activeBooking
    ? applications.find((a) => a.id === activeBooking.applicationId)
    : null;

  async function handleBook(sessionId: string) {
    const app = applications.find((a) => a.status === "APPROVED");
    if (!app) {
      toast.error("No approved application found to book an exam for.");
      return;
    }
    setBookingLoading(sessionId);
    try {
      const res = await fetch("/api/exam-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: app.id, examSessionId: sessionId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? "Booking failed");
      toast.success("Exam slot booked successfully!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to book exam slot.");
    } finally {
      setBookingLoading(null);
    }
  }

  async function handleCancel() {
    if (!cancelBookingId) return;
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/exam-bookings/${cancelBookingId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message ?? "Cancellation failed");
      toast.success("Exam booking cancelled.");
      setCancelOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking.");
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Approved applications summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {applications.map((app) => (
          <div
            key={app.id}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B4332]/10">
              <CheckCircle2 className="h-5 w-5 text-[#1B4332]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{app.applicationNumber}</p>
              <p className="text-xs text-gray-500">
                {CLASS_LEVEL_CONFIG[app.classApplied as keyof typeof CLASS_LEVEL_CONFIG]?.label ?? app.classApplied} · {app.branch.name}
              </p>
            </div>
            <Badge
              className={cn(
                "ml-auto shrink-0 text-xs",
                app.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
              )}
            >
              {app.status.replace(/_/g, " ")}
            </Badge>
          </div>
        ))}
      </div>

      {/* Active booking card */}
      {activeBooking && bookedApp && (
        <Card className="border-[#1B4332]/20 bg-[#1B4332]/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-[#1B4332]">
              <QrCode className="h-5 w-5" />
              Your Exam Booking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow
                icon={<CalendarDays className="h-4 w-4 text-gray-400" />}
                label="Date"
                value={formatDate(activeBooking.examSession.examDate)}
              />
              <InfoRow
                icon={<Clock className="h-4 w-4 text-gray-400" />}
                label="Time"
                value={`${activeBooking.examSession.startTime} – ${activeBooking.examSession.endTime}`}
              />
              <InfoRow
                icon={activeBooking.examSession.mode === "ONLINE"
                  ? <Monitor className="h-4 w-4 text-gray-400" />
                  : <MapPin className="h-4 w-4 text-gray-400" />}
                label={activeBooking.examSession.mode === "ONLINE" ? "Mode" : "Venue"}
                value={
                  activeBooking.examSession.mode === "ONLINE"
                    ? "Online"
                    : (activeBooking.examSession.venue ?? "To be announced")
                }
              />
              {activeBooking.seatNumber && (
                <InfoRow
                  icon={<Users className="h-4 w-4 text-gray-400" />}
                  label="Seat Number"
                  value={activeBooking.seatNumber}
                />
              )}
            </div>

            {/* QR Code reference */}
            <div className="rounded-lg border border-[#1B4332]/20 bg-white p-4 text-center">
              <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">Booking Reference / QR Code</p>
              <p className="font-mono text-lg font-bold tracking-widest text-[#1B4332]">
                {activeBooking.qrCode}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Present this code at the exam venue for check-in.
              </p>
            </div>

            {activeBooking.status === "BOOKED" && (
              <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => { setCancelBookingId(activeBooking.id); setCancelOpen(true); }}
                >
                  Cancel Booking
                </button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Exam Booking?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel your exam slot. You will need to rebook if you change your mind.
                      Your application will return to Approved status.
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
            )}
          </CardContent>
        </Card>
      )}

      {/* Available sessions */}
      {!activeBooking && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-gray-900">Available Exam Sessions</h2>
          {availableSessions.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CalendarDays className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">No exam sessions available yet</p>
                <p className="mt-1 text-xs text-gray-400">
                  Exam sessions for your class will appear here once scheduled by the school.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availableSessions.map((session) => {
                const available = session.capacity - session.bookedCount;
                const fillPct = Math.round((session.bookedCount / session.capacity) * 100);
                const isFull = available <= 0;
                const isLow = !isFull && fillPct >= 80;

                return (
                  <Card key={session.id} className={cn("transition-shadow hover:shadow-md", isFull && "opacity-60")}>
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 leading-tight">{session.title}</p>
                        <Badge
                          className={cn(
                            "shrink-0 text-xs",
                            session.mode === "ONLINE" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                          )}
                        >
                          {session.mode === "ONLINE" ? "Online" : "On-Campus"}
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(session.examDate)}
                        </div>
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
                          <span key={cl} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {CLASS_LEVEL_CONFIG[cl as keyof typeof CLASS_LEVEL_CONFIG]?.label ?? cl}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          {isFull ? (
                            <span className="text-red-600 font-medium">Fully Booked</span>
                          ) : (
                            <span className={cn(isLow ? "text-amber-600" : "text-green-600", "font-medium")}>
                              {available} slot{available !== 1 ? "s" : ""} left
                            </span>
                          )}
                        </span>
                        <span className="text-gray-400">{session.bookedCount}/{session.capacity}</span>
                      </div>

                      <Button
                        className="w-full bg-[#1B4332] hover:bg-[#1B4332]/90 text-white text-xs"
                        size="sm"
                        disabled={isFull || bookingLoading === session.id}
                        onClick={() => handleBook(session.id)}
                      >
                        {bookingLoading === session.id ? "Booking…" : isFull ? "Fully Booked" : "Book This Slot"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
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
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
