"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, MapPin, Send, CalendarDays, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type ApplicationContactTabsProps = {
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string | null;
  guardianTitle?: string | null;
  residentialAddress?: string | null;
  studentName: string;
  schoolName: string;
  classApplied: string;
};

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value: string) {
  if (!value) return "[selected date]";
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function buildTestInviteMessage(studentName: string, schoolName: string, classApplied: string, date: string) {
  return `This is to inform you that ${studentName}'s application to ${schoolName} for ${classApplied} has been reviewed.

${studentName} has been scheduled to write the entrance test on ${formatDisplayDate(date)}.

Please ensure the applicant is available on the scheduled date.

Thank you.`;
}

function buildSuccessMessage(studentName: string, schoolName: string, classApplied: string) {
  return `Congratulations. We are pleased to inform you that ${studentName}'s application to ${schoolName} for ${classApplied} was successful.

Further admission instructions will be communicated by the school.

Thank you.`;
}

export default function ApplicationContactTabs({
  applicationId,
  applicantName,
  applicantEmail,
  applicantPhone,
  guardianTitle,
  residentialAddress,
  studentName,
  schoolName,
  classApplied,
}: ApplicationContactTabsProps) {
  const [testDate, setTestDate] = useState(formatInputDate(new Date()));
  const [testMessage, setTestMessage] = useState(() =>
    buildTestInviteMessage(studentName, schoolName, classApplied, formatInputDate(new Date())),
  );
  const [successMessage, setSuccessMessage] = useState(() =>
    buildSuccessMessage(studentName, schoolName, classApplied),
  );
  const [sendingType, setSendingType] = useState<"TEST_INVITE" | "SUCCESS" | null>(null);

  const initials = useMemo(
    () =>
      applicantName
        .split(" ")
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "?",
    [applicantName],
  );

  useEffect(() => {
    setTestMessage(buildTestInviteMessage(studentName, schoolName, classApplied, testDate));
  }, [classApplied, schoolName, studentName, testDate]);

  async function sendMessage(type: "TEST_INVITE" | "SUCCESS") {
    const message = type === "TEST_INVITE" ? testMessage : successMessage;
    setSendingType(type);

    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message,
          scheduledDate: type === "TEST_INVITE" ? testDate : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Unable to send message");
      toast.success("Email sent to applicant.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send message");
    } finally {
      setSendingType(null);
    }
  }

  return (
    <Card>
      <Tabs defaultValue="contact">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">Applicant</CardTitle>
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
            <TabsTrigger value="success">Success</TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="pt-4">
          <TabsContent value="contact" className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1B4332]/10 text-sm font-bold text-[#1B4332]">
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{applicantName}</p>
                <p className="text-xs text-gray-500">{guardianTitle ?? "Parent/Guardian"}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="size-3.5 shrink-0 text-gray-400" />
                <a href={`mailto:${applicantEmail}`} className="truncate hover:text-primary">
                  {applicantEmail}
                </a>
              </div>
              {applicantPhone ? (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="size-3.5 shrink-0 text-gray-400" />
                  <span>{applicantPhone}</span>
                </div>
              ) : null}
              {residentialAddress ? (
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-gray-400" />
                  <span className="text-xs">{residentialAddress}</span>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="test" className="space-y-3">
            <label className="space-y-1.5 text-sm font-medium text-gray-700">
              Test date
              <Input type="date" value={testDate} onChange={(event) => setTestDate(event.target.value)} />
            </label>
            <Textarea
              value={testMessage}
              onChange={(event) => setTestMessage(event.target.value)}
              className="min-h-48 resize-y"
            />
            <Button
              type="button"
              className="w-full"
              onClick={() => sendMessage("TEST_INVITE")}
              disabled={sendingType !== null || !testDate || !testMessage.trim()}
            >
              {sendingType === "TEST_INVITE" ? (
                <CalendarDays className="size-4 animate-pulse" />
              ) : (
                <Send className="size-4" />
              )}
              Send Test Invite
            </Button>
          </TabsContent>

          <TabsContent value="success" className="space-y-3">
            <Textarea
              value={successMessage}
              onChange={(event) => setSuccessMessage(event.target.value)}
              className="min-h-48 resize-y"
            />
            <Button
              type="button"
              className="w-full"
              onClick={() => sendMessage("SUCCESS")}
              disabled={sendingType !== null || !successMessage.trim()}
            >
              {sendingType === "SUCCESS" ? (
                <CheckCircle2 className="size-4 animate-pulse" />
              ) : (
                <Send className="size-4" />
              )}
              Send Success Message
            </Button>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
