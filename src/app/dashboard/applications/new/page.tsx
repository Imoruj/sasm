"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Building2, User, Users, GraduationCap, Heart, FileCheck2, CreditCard,
  CheckCircle2, ChevronRight, ChevronLeft, Loader2, Plus, Trash2,
  Cloud, CloudOff, CloudUpload, MapPin, Monitor, AlertTriangle,
  Upload, CheckCircle, Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/components/shared/PageHeader";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import { NIGERIAN_STATES } from "@/constants/nigeria";
import { ALL_FIELD_IDS, LOCKED_FIELD_IDS } from "@/constants/formFieldRegistry";
import type { ClassLevel } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string; address: string; hasTemplate: boolean; }
interface Cycle  { id: string; name: string; academicYear: string; }
interface BranchTemplate {
  id: string;
  name: string;
  description: string | null;
  classLevels: ClassLevel[];
  branchId: string | null;
  resolvedBranchId: string | null;
  resolvedAdmissionCycleId: string | null;
  resolvedAdmissionCycleName: string | null;
  resolvedAdmissionCycleYear: string | null;
  enabledFields: string[];
}
type SaveStatus  = "idle" | "saving" | "saved" | "error";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ALL_CLASSES = [
  "PRE_NURSERY", "NURSERY1", "NURSERY2", "NURSERY", "PRIMARY",
  "BASIC1", "BASIC2", "BASIC3", "BASIC4", "BASIC5", "BASIC6",
  "JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3",
] as const;
const optionalUuid = (message: string) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().uuid(message).optional(),
  );

const step1Schema = z.object({
  branchId:         z.string().uuid("Please select a branch").min(1, "Please select a branch"),
  admissionCycleId: optionalUuid("Please select an admission cycle"),
  classApplied:     z.enum(ALL_CLASSES, { required_error: "Please select a class" }),
  studentType:      z.enum(["NEW", "TRANSFER"], { required_error: "Please select student type" }),
});

const step2Schema = z.object({
  studentLastName:      z.string().min(2, "Surname is required").max(100),
  studentFirstName:     z.string().min(2, "First name is required").max(100),
  studentMiddleName:    z.string().max(100).optional(),
  studentGender:        z.enum(["Male", "Female"], { required_error: "Please select gender" }),
  religion:             z.string().min(1, "Religion is required"),
  placeOfBirth:         z.string().min(2, "Place of birth is required"),
  studentDob:           z.string().min(1, "Date of birth is required"),
  studentStateOfOrigin: z.string().min(2, "State of origin is required"),
  studentLga:           z.string().min(2, "LGA is required"),
  studentNationality:   z.string().min(2, "Nationality is required"),
  passportNumber:       z.string().optional(),
});

const siblingSchema = z.object({
  name: z.string().min(1, "Name required"),
  age:  z.string(),
});

const step3Schema = z.object({
  fatherSurname:        z.string().optional(),
  fatherOtherNames:     z.string().optional(),
  fatherOccupation:     z.string().optional(),
  fatherHomeAddress:    z.string().optional(),
  fatherOfficeAddress:  z.string().optional(),
  fatherHomePhone:      z.string().optional(),
  fatherMobilePhone:    z.string().optional(),
  fatherEmail:          z.string().email("Invalid email").optional().or(z.literal("")),
  fatherOfficePhone:    z.string().optional(),
  motherSurname:        z.string().optional(),
  motherOtherNames:     z.string().optional(),
  motherOccupation:     z.string().optional(),
  motherHomeAddress:    z.string().optional(),
  motherOfficeAddress:  z.string().optional(),
  motherHomePhone:      z.string().optional(),
  motherMobilePhone:    z.string().optional(),
  motherEmail:          z.string().email("Invalid email").optional().or(z.literal("")),
  motherOfficePhone:    z.string().optional(),
  guardianName:         z.string().optional(),
  guardianRelationship: z.string().optional(),
  guardianPhone:        z.string().optional(),
  guardianEmail:        z.string().email("Invalid email").optional().or(z.literal("")),
  guardianAddress:      z.string().optional(),
  numberOfChildren:     z.string().optional(),
  brothers:             z.array(siblingSchema).optional(),
  sisters:              z.array(siblingSchema).optional(),
});

const step4Schema = z.object({
  primarySchoolName:        z.string().optional(),
  primarySchoolAddress:     z.string().optional(),
  previousSecondarySchool:  z.string().optional(),
  previousSecondaryClass:   z.string().optional(),
  reasonForTransfer:        z.string().optional(),
});

const step5Schema = z.object({
  hasFoodAllergy:           z.boolean().default(false),
  foodAllergyDetails:       z.string().optional(),
  hasDrugAllergy:           z.boolean().default(false),
  drugAllergyDetails:       z.string().optional(),
  hasPlantAllergy:          z.boolean().default(false),
  plantAllergyDetails:      z.string().optional(),
  hasPhysicalDisability:    z.boolean().default(false),
  physicalDisabilityDetails:z.string().optional(),
  eyeCheckDone:             z.boolean().default(false),
  eyeCheckWhere:            z.string().optional(),
  eyeCheckDate:             z.string().optional(),
  dentalCheckDone:          z.boolean().default(false),
  dentalCheckWhere:         z.string().optional(),
  dentalCheckDate:          z.string().optional(),
  otherAilments:            z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Step4Data = z.infer<typeof step4Schema>;
type Step5Data = z.infer<typeof step5Schema>;

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Enrollment",  icon: Building2   },
  { label: "Candidate",   icon: User        },
  { label: "Family",      icon: Users       },
  { label: "Education",   icon: GraduationCap },
  { label: "Health",      icon: Heart       },
  { label: "Declaration", icon: FileCheck2  },
  { label: "Payment",     icon: CreditCard  },
];


// ─── UI Helpers ──────────────────────────────────────────────────────────────

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className="flex items-center gap-1.5 text-xs">
      {status === "saving" && (
        <><CloudUpload className="size-3.5 animate-pulse text-gray-400" /><span className="text-gray-400">Saving…</span></>
      )}
      {status === "saved" && (
        <><Cloud className="size-3.5 text-green-500" /><span className="text-green-600">Draft saved</span></>
      )}
      {status === "error" && (
        <><CloudOff className="size-3.5 text-red-400" /><span className="text-red-500">Save failed</span></>
      )}
    </span>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

function FormField({
  label, required, children, error,
}: {
  label: string; required?: boolean; children: ReactNode; error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      <FieldError msg={error} />
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold text-gray-700">{children}</p>;
}

// ─── Payment Invoice Step ────────────────────────────────────────────────────

interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode?: string;
}

function PaymentInvoiceStep({
  applicationId,
  applicationNumber,
  feesData,
  placementTestType,
  onBack,
}: {
  applicationId: string;
  applicationNumber: string;
  feesData: { applicationFeeKobo: number; onlineTestFeeKobo: number } | null;
  placementTestType: "ON_CAMPUS" | "ONLINE";
  onBack: () => void;
}) {
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done">("idle");
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch bank details from org settings
  useEffect(() => {
    fetch("/api/org/bank-details")
      .then((r) => r.json())
      .then((j) => { if (j.success) setBankDetails(j.data); })
      .catch(() => {});
  }, []);

  const isOnline = placementTestType === "ONLINE";
  const appFeeKobo = feesData?.applicationFeeKobo ?? 0;
  const onlineFeeKobo = isOnline ? (feesData?.onlineTestFeeKobo ?? 0) : 0;
  const totalKobo = appFeeKobo + onlineFeeKobo;
  const totalNaira = (totalKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });

  function copyAppNumber() {
    navigator.clipboard.writeText(applicationNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Only JPG, PNG, WEBP, or PDF files are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File must be under 5MB");
      return;
    }

    setUploadState("uploading");
    setUploadError(null);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("folder", `payment-evidence/${applicationId}`);

      const uploadRes = await fetch("/api/uploads", { method: "POST", body: uploadFormData });
      const uploadJson = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok) {
        throw new Error(uploadJson?.error?.message ?? "Upload failed");
      }
      const publicUrl = uploadJson?.data?.publicUrl as string | undefined;
      if (!publicUrl) throw new Error("Upload completed without a public URL");

      // Save evidence URL
      const saveRes = await fetch(`/api/applications/${applicationId}/payment-evidence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceUrl: publicUrl }),
      });
      const saveJson = await saveRes.json().catch(() => null);
      if (!saveRes.ok) {
        throw new Error(saveJson?.error?.message ?? "Failed to save evidence");
      }

      setEvidenceUrl(publicUrl);
      setUploadState("done");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadState("idle");
    }
  }

  return (
    <div className="space-y-4">

      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
        <p className="text-sm font-medium text-red-700">
          Your application will <strong>not be processed</strong> until payment has been received and confirmed by the school.
        </p>
      </div>

      {/* Invoice card */}
      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Payment Invoice</CardTitle>
            <span className="text-xs text-gray-400">Application Fee</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">

          {/* Application number — prominent */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">Your Application Number</p>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xl font-bold tracking-widest text-primary">
                {applicationNumber || "Loading…"}
              </span>
              <button
                type="button"
                onClick={copyAppNumber}
                className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-gray-500 hover:bg-white transition-colors"
              >
                {copied ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-700 font-medium">
              ⚠ Quote this number as your payment narration/description
            </p>
          </div>

          {/* Fee table */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Fee Breakdown</p>
            <div className="rounded-lg border divide-y text-sm">
              <div className="flex justify-between px-4 py-3">
                <span className="text-gray-600">Application Fee</span>
                <span className="font-medium">
                  {feesData ? `₦${(appFeeKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}` : <Loader2 className="h-4 w-4 animate-spin inline" />}
                </span>
              </div>
              {isOnline && feesData && onlineFeeKobo > 0 && (
                <div className="flex justify-between px-4 py-3">
                  <span className="text-gray-600">Online Placement Test Fee</span>
                  <span className="font-medium">₦{(onlineFeeKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3 bg-gray-50 font-semibold">
                <span>Total Amount Due</span>
                <span className="text-primary">₦{totalNaira}</span>
              </div>
            </div>
          </div>

          {/* Bank details */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Bank Account Details</p>
            {bankDetails ? (
              <div className="rounded-lg border divide-y text-sm">
                <div className="flex justify-between px-4 py-3">
                  <span className="text-gray-500">Bank Name</span>
                  <span className="font-medium">{bankDetails.bankName}</span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="text-gray-500">Account Name</span>
                  <span className="font-medium">{bankDetails.accountName}</span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="text-gray-500">Account Number</span>
                  <span className="font-mono font-bold text-primary tracking-widest">{bankDetails.accountNumber}</span>
                </div>
                {bankDetails.sortCode && (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-gray-500">Sort Code</span>
                    <span className="font-medium">{bankDetails.sortCode}</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-3 bg-amber-50">
                  <span className="text-amber-700 font-medium">Narration / Reference</span>
                  <span className="font-mono font-bold text-amber-800">{applicationNumber}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border px-4 py-6 text-center text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Loading bank details…
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Upload evidence */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">Upload Payment Evidence</CardTitle>
          <p className="text-xs text-gray-500 mt-0.5">
            After making the transfer, upload your receipt or bank screenshot below.
          </p>
        </CardHeader>
        <CardContent className="pt-5">
          {uploadState === "done" ? (
            <div className="flex items-start gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-4">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">Payment evidence submitted</p>
                <p className="text-sm text-green-700 mt-0.5">
                  The school will verify your payment and confirm your application. You will receive a confirmation email once processed.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label
                className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
                  uploadState === "uploading" ? "opacity-60 pointer-events-none" : "hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="sr-only"
                  onChange={handleFileUpload}
                  disabled={uploadState === "uploading"}
                />
                {uploadState === "uploading" ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : (
                  <Upload className="h-8 w-8 text-gray-400" />
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    {uploadState === "uploading" ? "Uploading…" : "Click to upload receipt"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP or PDF · max 5MB</p>
                </div>
              </label>
              {uploadError && (
                <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{uploadError}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={uploadState === "uploading"}>
          <ChevronLeft className="h-4 w-4 mr-1" />Back
        </Button>
        {uploadState === "done" && evidenceUrl && (
          <a
            href="/dashboard/applications"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <CheckCircle className="h-4 w-4" />
            Done — View My Applications
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NewApplicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const actingApplicantEmail = searchParams.get("actingApplicantEmail") ?? undefined;

  const pageTopRef = useRef<HTMLDivElement | null>(null);
  const [currentStep, setCurrentStep]             = useState(0);
  const [applicationId, setApplicationId]         = useState<string | null>(null);
  const [applicationNumber, setApplicationNumber] = useState<string>("");
  const [saveStatus, setSaveStatus]               = useState<SaveStatus>("idle");
  const [creatingDraft, setCreatingDraft]         = useState(false);
  const [createError, setCreateError]             = useState<string | null>(null);
  const [stateLgas, setStateLgas]                 = useState<string[]>([]);
  const [hobbies, setHobbies]                     = useState("");
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [placementTestType, setPlacementTestType] = useState<"ON_CAMPUS" | "ONLINE">("ON_CAMPUS");
  const [payLoading, setPayLoading]               = useState(false);
  const [payError, setPayError]                   = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Forms (declared first so form1.watch can be used in queries below) ────
  const form1 = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      branchId: undefined, admissionCycleId: undefined,
      classApplied: undefined, studentType: undefined,
    },
  });

  const form2 = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: { studentNationality: "Nigerian" },
  });

  const form3 = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: { brothers: [], sisters: [] },
  });

  const form4 = useForm<Step4Data>({ resolver: zodResolver(step4Schema) });

  const form5 = useForm<Step5Data>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      hasFoodAllergy: false, hasDrugAllergy: false, hasPlantAllergy: false,
      hasPhysicalDisability: false, eyeCheckDone: false, dentalCheckDone: false,
    },
  });

  const { fields: brotherFields, append: addBrother, remove: removeBrother } =
    useFieldArray({ control: form3.control, name: "brothers" });
  const { fields: sisterFields, append: addSister, remove: removeSister } =
    useFieldArray({ control: form3.control, name: "sisters" });

  // ── Resume existing application ──────────────────────────────────────────
  const resumeId = searchParams.get("resume");
  useEffect(() => {
    if (!resumeId) return;
    (async () => {
      try {
        const res = await fetch(`/api/applications/${resumeId}`);
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: app } = await res.json() as { data: Record<string, any> };

        setApplicationId(app.id as string);
        setApplicationNumber((app.applicationNumber as string) ?? "");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fd = (app.formData ?? {}) as Record<string, any>;

        // Step 1 — enrollment
        form1.reset({
          branchId:         app.branchId ?? undefined,
          admissionCycleId: app.admissionCycleId ?? undefined,
          classApplied:     app.classApplied ?? undefined,
          studentType:      fd.enrollment?.studentType ?? undefined,
        });

        // Step 2 — candidate
        if (app.studentFirstName) {
          form2.reset({
            studentFirstName:     app.studentFirstName ?? "",
            studentLastName:      app.studentLastName ?? "",
            studentMiddleName:    app.studentMiddleName ?? "",
            studentDob:           app.studentDob
              ? new Date(app.studentDob as string).toISOString().slice(0, 10)
              : "",
            studentGender:        app.studentGender ?? undefined,
            studentNationality:   app.studentNationality ?? "Nigerian",
            studentStateOfOrigin: app.studentStateOfOrigin ?? "",
            studentLga:           app.studentLga ?? "",
            religion:             fd.candidate?.religion ?? "",
            placeOfBirth:         fd.candidate?.placeOfBirth ?? "",
            passportNumber:       fd.candidate?.passportNumber ?? "",
          });
        }

        // Step 3 — family
        if (fd.family) {
          form3.reset(fd.family);
        }

        // Step 4 — education
        if (fd.education) {
          form4.reset(fd.education);
        }

        // Step 5 — health
        if (fd.health) {
          form5.reset(fd.health);
        }

        // Hobbies / declaration
        if (fd.hobbies) setHobbies(fd.hobbies as string);
        else if (fd.candidate?.hobbies) setHobbies(fd.candidate.hobbies as string);
        if (fd.declarationAccepted) setDeclarationAccepted(true);
        if (fd.placementTestType === "ONLINE" || fd.placementTestType === "ON_CAMPUS") {
          setPlacementTestType(fd.placementTestType as "ON_CAMPUS" | "ONLINE");
        }

        // Determine resume step — advance to the last completed step + 1
        let resumeStep = 1;
        if (app.studentFirstName)                                       resumeStep = 2;
        if (fd.family)                                                  resumeStep = 3;
        if (fd.education)                                               resumeStep = 4;
        if (fd.health)                                                  resumeStep = 5;
        if (fd.declarationAccepted || fd.hobbies !== undefined)         resumeStep = 6;
        // If payment evidence already uploaded, stay on payment step (6)
        if (app.paymentEvidenceUrl || app.status === "UNDER_REVIEW")    resumeStep = 6;

        setCurrentStep(resumeStep);
      } catch {
        // silently ignore — user can start fresh
      }
    })();
  }, [resumeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Remote data ──────────────────────────────────────────────────────────
  const { data: branchesData, isLoading: loadingBranches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to load branches");
      const json = await res.json();
      return json.data as { branches: Branch[]; cycles: Cycle[] };
    },
  });
  const selectedBranchIdForQuery = form1.watch("branchId");
  const {
    data: templateData,
    isLoading: loadingTemplate,
    error: templateLoadError,
  } = useQuery({
    queryKey: ["application-template", selectedBranchIdForQuery],
    queryFn: async () => {
      const url = selectedBranchIdForQuery
        ? `/api/applications/template?branchId=${selectedBranchIdForQuery}`
        : "/api/applications/template";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to load application template");
      return json.data as { template: BranchTemplate };
    },
    enabled: !!selectedBranchIdForQuery,
  });

  const { data: feesData } = useQuery({
    queryKey: ["application-fees", applicationId],
    queryFn: async () => {
      const res = await fetch(`/api/applications/fees?applicationId=${applicationId}`);
      const json = await res.json();
      if (!res.ok) return { applicationFeeKobo: 0, onlineTestFeeKobo: 0 };
      return json.data as { applicationFeeKobo: number; onlineTestFeeKobo: number };
    },
    enabled: !!applicationId && currentStep === 6,
  });

  const allBranches   = branchesData?.branches ?? [];
  const branches      = allBranches.filter((b) => b.hasTemplate);
  const cycles        = branchesData?.cycles ?? [];
  const branchTemplate = templateData?.template ?? null;

  // ── Derived watch values ─────────────────────────────────────────────────
  const selectedBranchId    = selectedBranchIdForQuery;
  const templateClassLevels = branchTemplate?.classLevels ?? [];
  const availableClasses    = selectedBranchId
    ? (templateClassLevels.length > 0
        ? [...ALL_CLASSES].filter((c) => (templateClassLevels as string[]).includes(c))
        : [...ALL_CLASSES])
    : [];
  const resolvedAdmissionCycleId = branchTemplate?.resolvedAdmissionCycleId ?? null;
  const enabledFields       = branchTemplate?.enabledFields ?? ALL_FIELD_IDS;
  const isFieldEnabled      = (id: string) => LOCKED_FIELD_IDS.has(id) || enabledFields.includes(id);
  const studentType         = form1.watch("studentType");
  const classApplied        = form1.watch("classApplied");
  const isTransfer          = studentType === "TRANSFER";
  const watchedState        = form2.watch("studentStateOfOrigin");
  const hasFoodAllergy      = form5.watch("hasFoodAllergy");
  const hasDrugAllergy      = form5.watch("hasDrugAllergy");
  const hasPlantAllergy     = form5.watch("hasPlantAllergy");
  const hasPhysicalDisability = form5.watch("hasPhysicalDisability");
  const eyeCheckDone        = form5.watch("eyeCheckDone");
  const dentalCheckDone     = form5.watch("dentalCheckDone");

  // Pre-select the only available branch automatically
  useEffect(() => {
    if (branches.length === 1 && !selectedBranchId) {
      form1.setValue("branchId", branches[0].id, { shouldValidate: true });
    }
  }, [form1, branches.length, selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-select admission cycle from template
  useEffect(() => {
    if (resolvedAdmissionCycleId) {
      form1.setValue("admissionCycleId", resolvedAdmissionCycleId, { shouldValidate: true });
    }
  }, [form1, resolvedAdmissionCycleId]);

  // Reset class selection if branch changes and previously selected class is no longer available
  useEffect(() => {
    if (classApplied && availableClasses.length > 0 && !availableClasses.includes(classApplied)) {
      form1.setValue("classApplied", undefined as unknown as typeof ALL_CLASSES[number]);
    }
  }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveToStep = useCallback((step: number) => {
    setCurrentStep(step);
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      pageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const enrollmentReady = Boolean(
    branchTemplate &&
    selectedBranchId &&
    classApplied &&
    studentType,
  );

  // ── Auto-save ────────────────────────────────────────────────────────────
  const patchApplication = useCallback(async (payload: Record<string, unknown>) => {
    if (!applicationId) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [applicationId]);

  const scheduleSave = useCallback((payload: Record<string, unknown>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("idle");
    saveTimer.current = setTimeout(() => void patchApplication(payload), 2000);
  }, [patchApplication]);

  const flushSave = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
  }, []);

  // Auto-save: Step 2 — candidate fields
  const step2Values = form2.watch();
  useEffect(() => {
    if (currentStep !== 1 || !applicationId) return;
    const v = form2.getValues();
    if (!v.studentFirstName && !v.studentLastName) return;
    const { studentLastName, studentFirstName, studentMiddleName, studentDob,
      studentGender, studentNationality, studentStateOfOrigin, studentLga, ...extra } = v;
    scheduleSave({
      studentLastName, studentFirstName, studentMiddleName, studentDob,
      studentGender, studentNationality, studentStateOfOrigin, studentLga,
      formData: { candidate: extra },
    });
  }, [JSON.stringify(step2Values)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save: Step 3 — family
  const step3Values = form3.watch();
  useEffect(() => {
    if (currentStep !== 2 || !applicationId) return;
    scheduleSave({ formData: { family: form3.getValues() } });
  }, [JSON.stringify(step3Values)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save: Step 4 — education
  const step4Values = form4.watch();
  useEffect(() => {
    if (currentStep !== 3 || !applicationId) return;
    const v = form4.getValues();
    scheduleSave({
      previousSchool: v.primarySchoolName,
      previousSchoolAddress: v.primarySchoolAddress,
      formData: { education: v },
    });
  }, [JSON.stringify(step4Values)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save: Step 5 — health
  const step5Values = form5.watch();
  useEffect(() => {
    if (currentStep !== 4 || !applicationId) return;
    scheduleSave({ formData: { health: form5.getValues() } });
  }, [JSON.stringify(step5Values)]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step handlers ────────────────────────────────────────────────────────
  async function handleStep1Submit(data: Step1Data) {
    setCreatingDraft(true);
    setCreateError(null);
    try {
      if (!branchTemplate) {
        throw new Error("No published admission template is available for the selected branch");
      }
      const branchId = data.branchId;
      if (!branchId) {
        throw new Error("Please select a branch to continue.");
      }

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: branchTemplate.id,
          branchId,
          admissionCycleId: data.admissionCycleId,
          classApplied: data.classApplied,
          ...(actingApplicantEmail ? { actingApplicantEmail } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message = json.error?.message ?? "Failed to create draft";
        if (actingApplicantEmail && (json.error?.code === "NOT_FOUND" || message.toLowerCase().includes("not found"))) {
          throw new Error("Applicant account not found. Please go back and use 'New Application' to set up the applicant account before opening the wizard.");
        }
        throw new Error(message);
      }
      const id = json.data.id as string;
      setApplicationId(id);
      setApplicationNumber((json.data.applicationNumber as string) ?? "");
      // Save enrollment extras (studentType + selected branch name) immediately
      const branchName = branches.find((b) => b.id === branchId)?.name ?? "";
      await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: { enrollment: { branchName, studentType: data.studentType } },
        }),
      });
      // Persist resume param in URL so a browser refresh returns to this draft
      router.replace(`/dashboard/applications/new?resume=${id}${actingApplicantEmail ? `&actingApplicantEmail=${encodeURIComponent(actingApplicantEmail)}` : ""}`);
      moveToStep(1);
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreatingDraft(false);
    }
  }

  async function handleStep2Submit(data: Step2Data) {
    await flushSave();
    const { studentLastName, studentFirstName, studentMiddleName, studentDob,
      studentGender, studentNationality, studentStateOfOrigin, studentLga, ...extra } = data;
    await patchApplication({
      studentLastName, studentFirstName, studentMiddleName, studentDob,
      studentGender, studentNationality, studentStateOfOrigin, studentLga,
      formData: { candidate: extra },
    });
    moveToStep(2);
  }

  async function handleStep3Submit(data: Step3Data) {
    await flushSave();
    await patchApplication({ formData: { family: data } });
    moveToStep(3);
  }

  async function handleStep4Submit(data: Step4Data) {
    await flushSave();
    await patchApplication({
      previousSchool: data.primarySchoolName,
      previousSchoolAddress: data.primarySchoolAddress,
      formData: { education: data },
    });
    moveToStep(4);
  }

  async function handleStep5Submit(data: Step5Data) {
    await flushSave();
    await patchApplication({ formData: { health: data } });
    moveToStep(5);
  }

  async function handleFinalSubmit() {
    if (!applicationId) return;
    await patchApplication({ formData: { hobbies, declarationAccepted: true, placementTestType } });
    moveToStep(6);
  }

  async function handlePayNow() {
    if (!applicationId) return;
    setPayLoading(true);
    setPayError(null);
    try {
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          paymentType: "APPLICATION_FEE",
          placementTestType,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPayError(json.error?.message ?? "Failed to initialize payment.");
        return;
      }
      window.location.href = json.data.authorizationUrl;
    } catch {
      setPayError("Network error. Please try again.");
    } finally {
      setPayLoading(false);
    }
  }

  function goBack() {
    void flushSave();
    moveToStep(Math.max(currentStep - 1, 0));
  }

  // Snapshots for the summary card
  const s1 = form1.getValues();
  const s2 = form2.getValues();

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div ref={pageTopRef} className="max-w-3xl mx-auto pb-16">
      <PageHeader
        title="New Application"
        breadcrumbs={[
          { label: "Applications", href: "/dashboard/applications" },
          { label: "New Application" },
        ]}
        actions={currentStep > 0 ? <SaveIndicator status={saveStatus} /> : undefined}
      />

      {/* ── Step Indicator ── */}
      <div className="flex items-start mb-8 overflow-x-auto">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentStep;
          const isActive    = index === currentStep;
          return (
            <div key={index} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors shrink-0 ${
                  isCompleted ? "border-primary bg-primary text-white"
                  : isActive  ? "border-primary bg-white text-primary"
                  : "border-gray-200 bg-white text-gray-400"
                }`}>
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`mt-1 text-[11px] font-medium whitespace-nowrap ${
                  isActive ? "text-primary" : isCompleted ? "text-primary/70" : "text-gray-400"
                }`}>{step.label}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mt-[-14px] ${index < currentStep ? "bg-primary" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ══════════════ STEP 1: ENROLLMENT ══════════════ */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Information</CardTitle>
            <CardDescription>
              Complete the enrollment details required by the published admission template.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBranches ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <form onSubmit={form1.handleSubmit(handleStep1Submit)} className="space-y-6">

                {selectedBranchId && loadingTemplate && (
                  <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading branch form…
                  </div>
                )}

                {selectedBranchId && !loadingTemplate && templateLoadError && (
                  <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">
                    {templateLoadError instanceof Error ? templateLoadError.message : "Failed to load the application form for this branch."}
                  </p>
                )}

                {branchTemplate && (
                  <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">{branchTemplate.name}</p>
                    {branchTemplate.description && (
                      <p className="mt-1 text-sm text-gray-600">{branchTemplate.description}</p>
                    )}
                  </div>
                )}

                {/* Branch selection */}
                <FormField label="Campus Type" required error={form1.formState.errors.branchId?.message}>
                  {loadingBranches ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading branches…
                    </div>
                  ) : branches.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">No branches with an active application form. Contact your school administrator.</p>
                  ) : (
                    <div className={`grid gap-3 mt-1 ${branches.length === 1 ? "sm:grid-cols-1" : branches.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                      {branches.map((branch) => (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => {
                            form1.setValue("branchId", branch.id, { shouldValidate: true });
                          }}
                          className={`text-left rounded-lg border p-3.5 transition-all ${
                            selectedBranchId === branch.id
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                              : "border-gray-200 hover:border-primary/40"
                          }`}
                        >
                          <p className="font-semibold text-sm text-gray-900">{branch.name}</p>
                          {branch.address && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{branch.address}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </FormField>

                {/* Class — shown after branch selected and template loaded */}
                {selectedBranchId && branchTemplate && (
                  <FormField label="Class Applying For" required error={form1.formState.errors.classApplied?.message}>
                    {availableClasses.length === 1 ? (
                      <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm font-medium text-gray-900">
                        {CLASS_LEVEL_CONFIG[availableClasses[0]].label}
                      </div>
                    ) : (
                      <div className="space-y-3 mt-1">
                        {(["Early Years", "Basic", "Junior", "Senior"] as const).map((group) => {
                          const classesInGroup = availableClasses.filter(
                            (cl) => CLASS_LEVEL_CONFIG[cl].group === group,
                          );
                          if (!classesInGroup.length) return null;
                          return (
                            <div key={group}>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{group}</p>
                              <div className="flex flex-wrap gap-2">
                                {classesInGroup.map((cl) => (
                                  <button
                                    key={cl}
                                    type="button"
                                    onClick={() => form1.setValue("classApplied", cl, { shouldValidate: true })}
                                    className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-colors ${
                                      form1.watch("classApplied") === cl
                                        ? "border-primary bg-primary text-white"
                                        : "border-gray-200 hover:border-primary/50"
                                    }`}
                                  >
                                    {CLASS_LEVEL_CONFIG[cl].label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </FormField>
                )}

                {/* Student Type */}
                <FormField label="Student Type" required error={form1.formState.errors.studentType?.message}>
                  <div className="flex gap-3 mt-1">
                    {([["NEW", "New Student"], ["TRANSFER", "Transfer Student"]] as const).map(([val, lbl]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => form1.setValue("studentType", val, { shouldValidate: true })}
                        className={`flex-1 rounded-lg border p-3 text-sm font-medium transition-all ${
                          form1.watch("studentType") === val
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 text-primary"
                            : "border-gray-200 hover:border-primary/40 text-gray-700"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </FormField>

                {createError && (
                  <p className="text-sm text-red-600 rounded-lg bg-red-50 px-3 py-2">{createError}</p>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={!enrollmentReady || creatingDraft || loadingBranches || (!!selectedBranchId && loadingTemplate)}
                  >
                    {creatingDraft && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Continue <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* ══════════════ STEP 2: CANDIDATE DETAILS ══════════════ */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Candidate Details</CardTitle>
            <CardDescription>
              Enter the applicant&apos;s personal information exactly as it appears on official documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form2.handleSubmit(handleStep2Submit)} className="space-y-5">

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Surname" required error={form2.formState.errors.studentLastName?.message}>
                  <Input placeholder="e.g. Okafor" {...form2.register("studentLastName")} />
                </FormField>
                <FormField label="First Name" required error={form2.formState.errors.studentFirstName?.message}>
                  <Input placeholder="e.g. Chukwuemeka" {...form2.register("studentFirstName")} />
                </FormField>
                <FormField label="Other Names">
                  <Input placeholder="Middle / other names" {...form2.register("studentMiddleName")} />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Gender" required error={form2.formState.errors.studentGender?.message}>
                  <RadioGroup
                    className="flex gap-6 pt-1"
                    value={form2.watch("studentGender") ?? ""}
                    onValueChange={(v) =>
                      form2.setValue("studentGender", v as "Male" | "Female", { shouldValidate: true })
                    }
                  >
                    {(["Male", "Female"] as const).map((g) => (
                      <div key={g} className="flex items-center gap-2">
                        <RadioGroupItem value={g} id={`gender-${g}`} />
                        <Label htmlFor={`gender-${g}`} className="cursor-pointer font-normal">{g}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormField>
                {isFieldEnabled("religion") && (
                  <FormField label="Religion" required error={form2.formState.errors.religion?.message}>
                    <Select
                      value={form2.watch("religion") ?? ""}
                      onValueChange={(v) => form2.setValue("religion", v ?? "", { shouldValidate: true })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select religion" /></SelectTrigger>
                      <SelectContent>
                        {["Christianity", "Islam", "Traditional", "Other"].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Date of Birth" required error={form2.formState.errors.studentDob?.message}>
                  <Input type="date" {...form2.register("studentDob")} />
                </FormField>
                {isFieldEnabled("placeOfBirth") && (
                  <FormField label="Place of Birth" required error={form2.formState.errors.placeOfBirth?.message}>
                    <Input placeholder="City / Town of birth" {...form2.register("placeOfBirth")} />
                  </FormField>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {isFieldEnabled("studentNationality") && (
                  <FormField label="Nationality" required error={form2.formState.errors.studentNationality?.message}>
                    <Input {...form2.register("studentNationality")} />
                  </FormField>
                )}
                <FormField label="State of Origin" required error={form2.formState.errors.studentStateOfOrigin?.message}>
                  <Select
                    value={form2.watch("studentStateOfOrigin") ?? ""}
                    onValueChange={(v) => {
                      const val = v ?? "";
                      form2.setValue("studentStateOfOrigin", val, { shouldValidate: true });
                      form2.setValue("studentLga", "");
                      setStateLgas(NIGERIAN_STATES.find((s) => s.name === val)?.lgas ?? []);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      {NIGERIAN_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="LGA" required error={form2.formState.errors.studentLga?.message}>
                  <Select
                    value={form2.watch("studentLga") ?? ""}
                    onValueChange={(v) => form2.setValue("studentLga", v ?? "", { shouldValidate: true })}
                    disabled={!watchedState}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={watchedState ? "Select LGA" : "Select state first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {stateLgas.map((lga) => (
                        <SelectItem key={lga} value={lga}>{lga}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              {isFieldEnabled("passportNumber") && (
                <FormField label="International Passport Number">
                  <Input
                    placeholder="Optional — for non-Nigerian citizens"
                    {...form2.register("passportNumber")}
                  />
                </FormField>
              )}

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Back
                </Button>
                <Button type="submit">
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ══════════════ STEP 3: PARENTS & FAMILY ══════════════ */}
      {currentStep === 2 && (
        <form onSubmit={form3.handleSubmit(handleStep3Submit)} className="space-y-4">

          {/* Father */}
          {isFieldEnabled("fatherSurname") && <Card>
            <CardHeader>
              <CardTitle className="text-base">Father&apos;s Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Surname">
                  <Input {...form3.register("fatherSurname")} />
                </FormField>
                <FormField label="Other Names">
                  <Input {...form3.register("fatherOtherNames")} />
                </FormField>
              </div>
              <FormField label="Occupation">
                <Input {...form3.register("fatherOccupation")} />
              </FormField>
              <FormField label="Home Address">
                <Input {...form3.register("fatherHomeAddress")} />
              </FormField>
              <FormField label="Office / Business Address">
                <Input {...form3.register("fatherOfficeAddress")} />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Home Phone">
                  <Input type="tel" placeholder="07x / 08x / 09x…" {...form3.register("fatherHomePhone")} />
                </FormField>
                <FormField label="Mobile Phone">
                  <Input type="tel" placeholder="07x / 08x / 09x…" {...form3.register("fatherMobilePhone")} />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Office Phone">
                  <Input type="tel" {...form3.register("fatherOfficePhone")} />
                </FormField>
                <FormField label="Email Address" error={form3.formState.errors.fatherEmail?.message}>
                  <Input type="email" {...form3.register("fatherEmail")} />
                </FormField>
              </div>
            </CardContent>
          </Card>}

          {/* Mother */}
          {isFieldEnabled("motherSurname") && <Card>
            <CardHeader>
              <CardTitle className="text-base">Mother&apos;s Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Surname">
                  <Input {...form3.register("motherSurname")} />
                </FormField>
                <FormField label="Other Names">
                  <Input {...form3.register("motherOtherNames")} />
                </FormField>
              </div>
              <FormField label="Occupation">
                <Input {...form3.register("motherOccupation")} />
              </FormField>
              <FormField label="Home Address">
                <Input {...form3.register("motherHomeAddress")} />
              </FormField>
              <FormField label="Office / Business Address">
                <Input {...form3.register("motherOfficeAddress")} />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Home Phone">
                  <Input type="tel" placeholder="07x / 08x / 09x…" {...form3.register("motherHomePhone")} />
                </FormField>
                <FormField label="Mobile Phone">
                  <Input type="tel" placeholder="07x / 08x / 09x…" {...form3.register("motherMobilePhone")} />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Office Phone">
                  <Input type="tel" {...form3.register("motherOfficePhone")} />
                </FormField>
                <FormField label="Email Address" error={form3.formState.errors.motherEmail?.message}>
                  <Input type="email" {...form3.register("motherEmail")} />
                </FormField>
              </div>
            </CardContent>
          </Card>}

          {/* Guardian */}
          {isFieldEnabled("guardianSurname") && <Card>
            <CardHeader>
              <CardTitle className="text-base">Guardian / Sponsor</CardTitle>
              <CardDescription className="text-xs">
                Complete only if different from parents above.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Full Name">
                  <Input {...form3.register("guardianName")} />
                </FormField>
                <FormField label="Relationship to Candidate">
                  <Input placeholder="e.g. Uncle, Aunt, Sponsor" {...form3.register("guardianRelationship")} />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Phone Number">
                  <Input type="tel" {...form3.register("guardianPhone")} />
                </FormField>
                <FormField label="Email Address" error={form3.formState.errors.guardianEmail?.message}>
                  <Input type="email" {...form3.register("guardianEmail")} />
                </FormField>
              </div>
              <FormField label="Address">
                <Input {...form3.register("guardianAddress")} />
              </FormField>
            </CardContent>
          </Card>}

          {/* Siblings */}
          {isFieldEnabled("brothersNameAge") && <Card>
            <CardHeader>
              <CardTitle className="text-base">Family Composition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField label="Total Number of Children in Family">
                <Input
                  type="number"
                  min="1"
                  max="20"
                  className="w-28"
                  {...form3.register("numberOfChildren")}
                />
              </FormField>

              <Separator />

              {/* Brothers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Brothers</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addBrother({ name: "", age: "" })}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />Add
                  </Button>
                </div>
                {brotherFields.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No brothers added</p>
                )}
                {brotherFields.map((field, i) => (
                  <div key={field.id} className="flex gap-3 items-start">
                    <div className="flex-1">
                      <Input placeholder="Full name" {...form3.register(`brothers.${i}.name`)} />
                      <FieldError msg={form3.formState.errors.brothers?.[i]?.name?.message} />
                    </div>
                    <div className="w-24">
                      <Input placeholder="Age" type="number" min="0" max="40" {...form3.register(`brothers.${i}.age`)} />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeBrother(i)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Sisters */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Sisters</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addSister({ name: "", age: "" })}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />Add
                  </Button>
                </div>
                {sisterFields.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No sisters added</p>
                )}
                {sisterFields.map((field, i) => (
                  <div key={field.id} className="flex gap-3 items-start">
                    <div className="flex-1">
                      <Input placeholder="Full name" {...form3.register(`sisters.${i}.name`)} />
                      <FieldError msg={form3.formState.errors.sisters?.[i]?.name?.message} />
                    </div>
                    <div className="w-24">
                      <Input placeholder="Age" type="number" min="0" max="40" {...form3.register(`sisters.${i}.age`)} />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeSister(i)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>}

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={goBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />Back
            </Button>
            <Button type="submit">
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </form>
      )}

      {/* ══════════════ STEP 4: EDUCATIONAL BACKGROUND ══════════════ */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Educational Background</CardTitle>
            <CardDescription>Provide details of the applicant&apos;s previous schooling.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form4.handleSubmit(handleStep4Submit)} className="space-y-5">

              {isFieldEnabled("primarySchoolName") && (<>
              <SectionTitle>Primary School Attended</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Name of Primary School">
                  <Input placeholder="School name" {...form4.register("primarySchoolName")} />
                </FormField>
                <FormField label="School Address / Location">
                  <Input placeholder="City / State" {...form4.register("primarySchoolAddress")} />
                </FormField>
              </div>
              </>)}

              {isTransfer && (
                <>
                  <Separator />
                  <SectionTitle>Previous Secondary School (Transfer)</SectionTitle>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Name of School">
                      <Input
                        placeholder="Secondary school name"
                        {...form4.register("previousSecondarySchool")}
                      />
                    </FormField>
                    <FormField label="Last Class Attended">
                      <Select
                        value={form4.watch("previousSecondaryClass") ?? ""}
                        onValueChange={(v) => form4.setValue("previousSecondaryClass", v ?? "")}
                      >
                        <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                        <SelectContent>
                          {["JSS1", "JSS2", "JSS3", "SS1", "SS2"].map((cl) => (
                            <SelectItem key={cl} value={cl}>{cl}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  </div>
                  <FormField label="Reason for Leaving / Transfer">
                    <Textarea
                      rows={3}
                      placeholder="Briefly explain the reason for transfer…"
                      {...form4.register("reasonForTransfer")}
                    />
                  </FormField>
                </>
              )}

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Back
                </Button>
                <Button type="submit">
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ══════════════ STEP 5: HEALTH DETAILS ══════════════ */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Health Details</CardTitle>
            <CardDescription>
              Please provide accurate health information to ensure the candidate&apos;s safety and wellbeing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form5.handleSubmit(handleStep5Submit)} className="space-y-5">

              {/* Allergies */}
              {isFieldEnabled("allergyFood") && (<>
              <SectionTitle>Allergies</SectionTitle>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="foodAllergy"
                    checked={hasFoodAllergy}
                    onCheckedChange={(v) => form5.setValue("hasFoodAllergy", !!v)}
                  />
                  <Label htmlFor="foodAllergy" className="cursor-pointer">Food Allergy</Label>
                </div>
                {hasFoodAllergy && (
                  <FormField label="Specify food allergies">
                    <Input placeholder="e.g. Peanuts, Shellfish" {...form5.register("foodAllergyDetails")} />
                  </FormField>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="drugAllergy"
                    checked={hasDrugAllergy}
                    onCheckedChange={(v) => form5.setValue("hasDrugAllergy", !!v)}
                  />
                  <Label htmlFor="drugAllergy" className="cursor-pointer">Drug / Medication Allergy</Label>
                </div>
                {hasDrugAllergy && (
                  <FormField label="Specify drug allergies">
                    <Input placeholder="e.g. Penicillin, Aspirin" {...form5.register("drugAllergyDetails")} />
                  </FormField>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="plantAllergy"
                    checked={hasPlantAllergy}
                    onCheckedChange={(v) => form5.setValue("hasPlantAllergy", !!v)}
                  />
                  <Label htmlFor="plantAllergy" className="cursor-pointer">Plant / Environmental Allergy</Label>
                </div>
                {hasPlantAllergy && (
                  <FormField label="Specify plant / environmental allergies">
                    <Input placeholder="e.g. Pollen, Dust mites" {...form5.register("plantAllergyDetails")} />
                  </FormField>
                )}
              </div>
              </>)}

              {isFieldEnabled("physicalDisability") && (<>
              <Separator />

              {/* Physical Disability */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="disability"
                    checked={hasPhysicalDisability}
                    onCheckedChange={(v) => form5.setValue("hasPhysicalDisability", !!v)}
                  />
                  <Label htmlFor="disability" className="cursor-pointer">
                    Physical Disability or Special Needs
                  </Label>
                </div>
                {hasPhysicalDisability && (
                  <FormField label="Please describe">
                    <Textarea rows={2} {...form5.register("physicalDisabilityDetails")} />
                  </FormField>
                )}
              </div>
              </>)}

              {isFieldEnabled("eyeCheckDone") && (<>
              <Separator />

              {/* Medical Checks */}
              <SectionTitle>Recent Medical Checks</SectionTitle>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="eyeCheck"
                    checked={eyeCheckDone}
                    onCheckedChange={(v) => form5.setValue("eyeCheckDone", !!v)}
                  />
                  <Label htmlFor="eyeCheck" className="cursor-pointer">Eye Check Conducted</Label>
                </div>
                {eyeCheckDone && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Where (Hospital / Clinic)">
                      <Input placeholder="Name of facility" {...form5.register("eyeCheckWhere")} />
                    </FormField>
                    <FormField label="Date of Check">
                      <Input type="date" {...form5.register("eyeCheckDate")} />
                    </FormField>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="dentalCheck"
                    checked={dentalCheckDone}
                    onCheckedChange={(v) => form5.setValue("dentalCheckDone", !!v)}
                  />
                  <Label htmlFor="dentalCheck" className="cursor-pointer">Dental Check Conducted</Label>
                </div>
                {dentalCheckDone && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Where (Hospital / Clinic)">
                      <Input placeholder="Name of facility" {...form5.register("dentalCheckWhere")} />
                    </FormField>
                    <FormField label="Date of Check">
                      <Input type="date" {...form5.register("dentalCheckDate")} />
                    </FormField>
                  </div>
                )}
              </div>
              </>)}

              {isFieldEnabled("otherHealthChallenges") && (
              <FormField label="Other Ailments / Medical Conditions">
                <Textarea
                  rows={3}
                  placeholder="Any other health conditions the school should be aware of…"
                  {...form5.register("otherAilments")}
                />
              </FormField>
              )}

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Back
                </Button>
                <Button type="submit">
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ══════════════ STEP 6: HOBBIES & DECLARATION ══════════════ */}
      {currentStep === 5 && (
        <div className="space-y-4">

          {/* Hobbies */}
          {isFieldEnabled("hobbies") && <Card>
            <CardHeader>
              <CardTitle className="text-base">Hobbies &amp; Interests</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField label="List the applicant's hobbies and interests">
                <Textarea
                  rows={3}
                  placeholder="e.g. Reading, Football, Music, Drawing, Swimming…"
                  value={hobbies}
                  onChange={(e) => setHobbies(e.target.value)}
                />
              </FormField>
            </CardContent>
          </Card>}

          {/* Application Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application Summary</CardTitle>
              <CardDescription className="text-xs">Review before submitting your application.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-y-3 gap-x-4 sm:grid-cols-3 text-sm">
                <div>
                  <dt className="text-gray-500">Branch</dt>
                  <dd className="font-medium mt-0.5">
                    {branches.find((b) => b.id === s1.branchId)?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Class Applied</dt>
                  <dd className="font-medium mt-0.5">
                    {s1.classApplied ? CLASS_LEVEL_CONFIG[s1.classApplied]?.label : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Admission Cycle</dt>
                  <dd className="font-medium mt-0.5">
                    {cycles.find((c) => c.id === s1.admissionCycleId)?.name
                      ?? branchTemplate?.resolvedAdmissionCycleName
                      ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Student Type</dt>
                  <dd className="font-medium mt-0.5">{s1.studentType ?? "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Candidate Name</dt>
                  <dd className="font-medium mt-0.5">
                    {[s2.studentLastName, s2.studentFirstName, s2.studentMiddleName]
                      .filter(Boolean).join(", ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Date of Birth</dt>
                  <dd className="font-medium mt-0.5">{s2.studentDob || "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Gender</dt>
                  <dd className="font-medium mt-0.5">{s2.studentGender || "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">State of Origin</dt>
                  <dd className="font-medium mt-0.5">{s2.studentStateOfOrigin || "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Placement Test Preference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="size-4 text-gray-400" />
                Placement Test Preference
              </CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">
                How would you prefer to sit the placement/entrance test?
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPlacementTestType("ON_CAMPUS")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-sm font-medium transition-colors ${
                    placementTestType === "ON_CAMPUS"
                      ? "border-[#1B4332] bg-[#1B4332]/5 text-[#1B4332]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <MapPin className="size-6" />
                  <span>On Campus</span>
                  <span className="text-xs font-normal text-gray-400">Visit the school on exam day</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlacementTestType("ONLINE")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-sm font-medium transition-colors ${
                    placementTestType === "ONLINE"
                      ? "border-[#1B4332] bg-[#1B4332]/5 text-[#1B4332]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Monitor className="size-6" />
                  <span>Online</span>
                  <span className="text-xs font-normal text-gray-400">Take the test remotely</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Declaration */}
          <Card className="border-amber-200 bg-amber-50/40">
            <CardHeader>
              <CardTitle className="text-base">Declaration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                I/We hereby declare that the information provided in this application form is true, accurate,
                and complete to the best of my/our knowledge. I/We understand that any false or misleading
                information may result in the cancellation of this application or expulsion from the school.
                I/We agree to abide by the rules and regulations of the school if the candidate is admitted.
              </p>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="declaration"
                  checked={declarationAccepted}
                  onCheckedChange={(v) => setDeclarationAccepted(!!v)}
                />
                <Label htmlFor="declaration" className="cursor-pointer text-sm leading-relaxed">
                  I confirm that I have read and understood the above declaration, and all information
                  provided is accurate and complete.
                </Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={goBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />Back
            </Button>
            <Button onClick={handleFinalSubmit} disabled={!declarationAccepted}>
              Continue to Payment <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════ STEP 7: PAYMENT INVOICE ══════════════ */}
      {currentStep === 6 && applicationId && (
        <PaymentInvoiceStep
          applicationId={applicationId}
          applicationNumber={applicationNumber}
          feesData={feesData ?? null}
          placementTestType={placementTestType}
          onBack={goBack}
        />
      )}
    </div>
  );
}
