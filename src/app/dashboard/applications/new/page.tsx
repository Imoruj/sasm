"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Building2, User, Users, GraduationCap, Heart, FileCheck2,
  CheckCircle2, ChevronRight, ChevronLeft, Loader2, Plus, Trash2,
  Cloud, CloudOff, CloudUpload,
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
import { CLASS_LEVEL_CONFIG, CAMPUS_CLASS_MAP } from "@/constants/classLevels";
import { NIGERIAN_STATES } from "@/constants/nigeria";
import type { ClassLevel } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string; address: string; }
interface Cycle  { id: string; name: string; academicYear: string; }
type SaveStatus  = "idle" | "saving" | "saved" | "error";
type CampusType  = "BOARDING" | "DAY" | "METRO";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ALL_CLASSES = ["NURSERY", "PRIMARY", "JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"] as const;

const step1Schema = z.object({
  campusType:       z.enum(["BOARDING", "DAY", "METRO"], { required_error: "Please select a campus type" }),
  branchId:         z.string().uuid("Please select a branch"),
  admissionCycleId: z.string().uuid("Please select an admission cycle"),
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
];

const CAMPUS_OPTIONS: { value: CampusType; label: string; desc: string }[] = [
  { value: "BOARDING", label: "Boarding School", desc: "JSS 1 – SS 3 only"  },
  { value: "DAY",      label: "Day School",      desc: "Nursery – SS 3"     },
  { value: "METRO",    label: "Metro Campus",    desc: "Nursery – SS 3"     },
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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NewApplicationPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep]             = useState(0);
  const [applicationId, setApplicationId]         = useState<string | null>(null);
  const [saveStatus, setSaveStatus]               = useState<SaveStatus>("idle");
  const [creatingDraft, setCreatingDraft]         = useState(false);
  const [createError, setCreateError]             = useState<string | null>(null);
  const [stateLgas, setStateLgas]                 = useState<string[]>([]);
  const [hobbies, setHobbies]                     = useState("");
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const branches = branchesData?.branches ?? [];
  const cycles   = branchesData?.cycles   ?? [];

  // ── Forms ────────────────────────────────────────────────────────────────
  const form1 = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      campusType: undefined, branchId: "", admissionCycleId: "",
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

  // ── Derived watch values ─────────────────────────────────────────────────
  const campusType          = form1.watch("campusType");
  const availableClasses    = campusType ? CAMPUS_CLASS_MAP[campusType] : [];
  const studentType         = form1.watch("studentType");
  const isTransfer          = studentType === "TRANSFER";
  const watchedState        = form2.watch("studentStateOfOrigin");
  const hasFoodAllergy      = form5.watch("hasFoodAllergy");
  const hasDrugAllergy      = form5.watch("hasDrugAllergy");
  const hasPlantAllergy     = form5.watch("hasPlantAllergy");
  const hasPhysicalDisability = form5.watch("hasPhysicalDisability");
  const eyeCheckDone        = form5.watch("eyeCheckDone");
  const dentalCheckDone     = form5.watch("dentalCheckDone");

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
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: data.branchId,
          admissionCycleId: data.admissionCycleId,
          classApplied: data.classApplied,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to create draft");
      const id = json.data.id as string;
      setApplicationId(id);
      // Save enrollment extras (campusType + studentType) immediately
      await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: { enrollment: { campusType: data.campusType, studentType: data.studentType } },
        }),
      });
      setCurrentStep(1);
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
    setCurrentStep(2);
  }

  async function handleStep3Submit(data: Step3Data) {
    await flushSave();
    await patchApplication({ formData: { family: data } });
    setCurrentStep(3);
  }

  async function handleStep4Submit(data: Step4Data) {
    await flushSave();
    await patchApplication({
      previousSchool: data.primarySchoolName,
      previousSchoolAddress: data.primarySchoolAddress,
      formData: { education: data },
    });
    setCurrentStep(4);
  }

  async function handleStep5Submit(data: Step5Data) {
    await flushSave();
    await patchApplication({ formData: { health: data } });
    setCurrentStep(5);
  }

  async function handleFinalSubmit() {
    if (!applicationId) return;
    await patchApplication({ formData: { hobbies, declarationAccepted: true } });
    router.push(`/dashboard/applications/${applicationId}`);
  }

  function goBack() {
    void flushSave();
    setCurrentStep((s) => s - 1);
  }

  // Snapshots for the summary card
  const s1 = form1.getValues();
  const s2 = form2.getValues();

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-3xl mx-auto pb-16">
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
              Select your campus, branch, admission cycle, and the class you are applying for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBranches ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <form onSubmit={form1.handleSubmit(handleStep1Submit)} className="space-y-6">

                {/* Campus Type */}
                <FormField label="Campus Type" required error={form1.formState.errors.campusType?.message}>
                  <div className="grid gap-3 sm:grid-cols-3 mt-1">
                    {CAMPUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          form1.setValue("campusType", opt.value, { shouldValidate: true });
                          form1.setValue("classApplied", undefined as unknown as typeof ALL_CLASSES[number]);
                        }}
                        className={`text-left rounded-lg border p-3.5 transition-all ${
                          form1.watch("campusType") === opt.value
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-gray-200 hover:border-primary/40"
                        }`}
                      >
                        <p className="font-semibold text-sm text-gray-900">{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </FormField>

                {/* Branch */}
                <FormField label="School Branch" required error={form1.formState.errors.branchId?.message}>
                  <div className="grid gap-3 sm:grid-cols-2 mt-1">
                    {branches.map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => {
                          form1.setValue("branchId", branch.id, { shouldValidate: true });
                          form1.setValue("admissionCycleId", "");
                        }}
                        className={`text-left rounded-lg border p-4 transition-all ${
                          form1.watch("branchId") === branch.id
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-gray-200 hover:border-primary/40"
                        }`}
                      >
                        <p className="font-medium text-gray-900">{branch.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{branch.address}</p>
                      </button>
                    ))}
                  </div>
                </FormField>

                {/* Admission Cycle */}
                <FormField label="Admission Cycle" required error={form1.formState.errors.admissionCycleId?.message}>
                  <Select
                    value={form1.watch("admissionCycleId")}
                    onValueChange={(v) => form1.setValue("admissionCycleId", v ?? "", { shouldValidate: true })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select admission cycle" /></SelectTrigger>
                    <SelectContent>
                      {cycles.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} — {c.academicYear}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                {/* Class — filtered by campus type */}
                {campusType && (
                  <FormField label="Class Applying For" required error={form1.formState.errors.classApplied?.message}>
                    <div className="space-y-3 mt-1">
                      {(["Early Years", "Junior", "Senior"] as const).map((group) => {
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
                  <Button type="submit" disabled={creatingDraft}>
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
                    value={form2.watch("studentGender")}
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Date of Birth" required error={form2.formState.errors.studentDob?.message}>
                  <Input type="date" {...form2.register("studentDob")} />
                </FormField>
                <FormField label="Place of Birth" required error={form2.formState.errors.placeOfBirth?.message}>
                  <Input placeholder="City / Town of birth" {...form2.register("placeOfBirth")} />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Nationality" required error={form2.formState.errors.studentNationality?.message}>
                  <Input {...form2.register("studentNationality")} />
                </FormField>
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

              <FormField label="International Passport Number">
                <Input
                  placeholder="Optional — for non-Nigerian citizens"
                  {...form2.register("passportNumber")}
                />
              </FormField>

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
          <Card>
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
          </Card>

          {/* Mother */}
          <Card>
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
          </Card>

          {/* Guardian */}
          <Card>
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
          </Card>

          {/* Siblings */}
          <Card>
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
          </Card>

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

              <SectionTitle>Primary School Attended</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Name of Primary School">
                  <Input placeholder="School name" {...form4.register("primarySchoolName")} />
                </FormField>
                <FormField label="School Address / Location">
                  <Input placeholder="City / State" {...form4.register("primarySchoolAddress")} />
                </FormField>
              </div>

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

              <FormField label="Other Ailments / Medical Conditions">
                <Textarea
                  rows={3}
                  placeholder="Any other health conditions the school should be aware of…"
                  {...form5.register("otherAilments")}
                />
              </FormField>

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
          <Card>
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
          </Card>

          {/* Application Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application Summary</CardTitle>
              <CardDescription className="text-xs">Review before submitting your application.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-y-3 gap-x-4 sm:grid-cols-3 text-sm">
                <div>
                  <dt className="text-gray-500">Campus</dt>
                  <dd className="font-medium mt-0.5">{s1.campusType ?? "—"}</dd>
                </div>
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
                    {cycles.find((c) => c.id === s1.admissionCycleId)?.name ?? "—"}
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
              Save &amp; View Application
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
