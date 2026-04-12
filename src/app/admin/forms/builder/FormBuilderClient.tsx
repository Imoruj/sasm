"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Lock, Save, CheckCircle2, LayoutTemplate } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FORM_FIELD_REGISTRY,
  LOCKED_FIELD_IDS,
  ALL_FIELD_IDS,
  type MasterSection,
} from "@/constants/formFieldRegistry";

interface Props {
  templateId?: string;
  initialName?: string;
  initialDescription?: string;
  initialClassLevel?: string | null;
  initialStatus?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  initialEnabledFields?: string[];
}

export default function FormBuilderClient({
  templateId,
  initialName        = "Standard Admission Form",
  initialDescription = "",
  initialClassLevel  = null,
  initialStatus      = "DRAFT",
  initialEnabledFields,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── State ────────────────────────────────────────────────────────────────────
  const [name,        setName]        = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [classLevel,  setClassLevel]  = useState<string>(initialClassLevel ?? "ALL");
  const [status,      setStatus]      = useState<"DRAFT" | "PUBLISHED">(
    initialStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
  );
  const [enabled, setEnabled] = useState<Set<string>>(
    new Set(initialEnabledFields ?? ALL_FIELD_IDS),
  );
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(FORM_FIELD_REGISTRY.map((s) => s.id)),
  );
  const [saved, setSaved] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const toggle = (fieldId: string, on: boolean) => {
    if (LOCKED_FIELD_IDS.has(fieldId)) return;
    setEnabled((prev) => {
      const next = new Set(prev);
      on ? next.add(fieldId) : next.delete(fieldId);
      return next;
    });
    setSaved(false);
  };

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  };

  const getSectionFieldIds = (section: MasterSection): string[] => [
    ...section.fields.map((f) => f.id),
    ...(section.subsections ?? []).flatMap((sub) => sub.fields.map((f) => f.id)),
  ];

  const sectionEnabledCount = (section: MasterSection) =>
    getSectionFieldIds(section).filter((id) => enabled.has(id)).length;

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = () => {
    startTransition(async () => {
      const body = {
        name,
        description,
        classLevel: classLevel === "ALL" ? null : classLevel,
        status,
        enabledFields: [...enabled],
      };

      try {
        let res: Response;
        if (templateId) {
          res = await fetch(`/api/admin/forms/${templateId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } else {
          res = await fetch("/api/admin/forms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, schema: { enabledFields: [...enabled] } }),
          });
        }

        const json = await res.json() as { success: boolean; error?: { message: string } };
        if (!json.success) throw new Error(json.error?.message ?? "Save failed");

        setSaved(true);
        toast.success(status === "PUBLISHED" ? "Form published successfully" : "Draft saved");
        router.push("/admin/forms");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save template");
      }
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Settings bar ── */}
      <Card>
        <CardContent className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Label htmlFor="tpl-name" className="mb-1.5 block text-xs font-medium text-gray-700">Template Name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setSaved(false); }}
                placeholder="e.g. JSS 1 Admission Form"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-gray-700">Class Level</Label>
              <Select value={classLevel ?? "ALL"} onValueChange={(v) => { setClassLevel(v ?? "ALL"); setSaved(false); }}>
                <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Classes</SelectItem>
                  <SelectItem value="NURSERY">Nursery</SelectItem>
                  <SelectItem value="PRIMARY">Primary</SelectItem>
                  <SelectItem value="JSS1">JSS 1</SelectItem>
                  <SelectItem value="JSS2">JSS 2</SelectItem>
                  <SelectItem value="JSS3">JSS 3</SelectItem>
                  <SelectItem value="SS1">SS 1</SelectItem>
                  <SelectItem value="SS2">SS 2</SelectItem>
                  <SelectItem value="SS3">SS 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-gray-700">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => { setStatus(v as "DRAFT" | "PUBLISHED"); setSaved(false); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {description !== undefined && (
            <div className="mt-3">
              <Label htmlFor="tpl-desc" className="mb-1.5 block text-xs font-medium text-gray-700">Description (optional)</Label>
              <Input
                id="tpl-desc"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
                placeholder="Short description of this form"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-gray-400" />
          Always included (locked)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-[#1B4332]" />
          Enabled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-200" />
          Disabled — applicants won't see this field
        </span>
        <span className="ml-auto font-medium text-gray-700">
          {enabled.size} / {ALL_FIELD_IDS.length} fields enabled
        </span>
      </div>

      {/* ── Sections ── */}
      {FORM_FIELD_REGISTRY.map((section) => {
        const isOpen      = openSections.has(section.id);
        const allFieldIds = getSectionFieldIds(section);
        const enabledCount = sectionEnabledCount(section);

        return (
          <Card key={section.id}>
            {/* Section header */}
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-3">
                <LayoutTemplate className="h-4 w-4 text-[#1B4332]" />
                <span className="font-semibold text-gray-900">{section.title}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  {enabledCount} / {allFieldIds.length} fields
                </span>
              </div>
              {isOpen
                ? <ChevronDown className="h-4 w-4 text-gray-400" />
                : <ChevronRight className="h-4 w-4 text-gray-400" />}
            </button>

            {isOpen && (
              <>
                <Separator />
                <CardContent className="p-0">
                  {/* Subsections */}
                  {section.subsections?.map((sub) => (
                    <div key={sub.id}>
                      <p className="bg-gray-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {sub.label}
                      </p>
                      {sub.fields.map((field) => (
                        <FieldRow
                          key={field.id}
                          fieldId={field.id}
                          label={field.label}
                          type={field.type}
                          required={field.required}
                          locked={!!field.locked}
                          isEnabled={enabled.has(field.id)}
                          onToggle={(on) => toggle(field.id, on)}
                        />
                      ))}
                    </div>
                  ))}

                  {/* Direct fields */}
                  {section.fields.length > 0 && (
                    <>
                      {section.subsections && section.subsections.length > 0 && (
                        <p className="bg-gray-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Family Information
                        </p>
                      )}
                      {section.fields.map((field) => (
                        <FieldRow
                          key={field.id}
                          fieldId={field.id}
                          label={field.label}
                          type={field.type}
                          required={field.required}
                          locked={!!field.locked}
                          isEnabled={enabled.has(field.id)}
                          onToggle={(on) => toggle(field.id, on)}
                        />
                      ))}
                    </>
                  )}

                  {section.helpText && (
                    <p className="px-5 pb-3 pt-1 text-[11px] text-gray-400 italic">{section.helpText}</p>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        );
      })}

      {/* ── Save bar ── */}
      <div className="sticky bottom-4 flex justify-end">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </span>
          )}
          <Button variant="outline" onClick={() => router.push("/admin/forms")}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending
              ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Saving…</>
              : <><Save className="mr-1 h-4 w-4" />{status === "PUBLISHED" ? "Save & Publish" : "Save Draft"}</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Field row ────────────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text", textarea: "Long Text", select: "Dropdown",
  radio: "Radio", checkbox: "Checkbox", date: "Date",
  tel: "Phone", email: "Email", number: "Number", file: "File Upload",
};

function FieldRow({
  fieldId, label, type, required, locked, isEnabled, onToggle,
}: {
  fieldId:   string;
  label:     string;
  type:      string;
  required:  boolean;
  locked:    boolean;
  isEnabled: boolean;
  onToggle:  (on: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-3 border-b border-gray-50 px-5 py-3 last:border-0 transition-colors ${!isEnabled ? "opacity-40" : ""}`}>
      {/* Toggle */}
      <Switch
        checked={isEnabled}
        onCheckedChange={onToggle}
        disabled={locked}
        aria-label={`Toggle ${label}`}
      />

      {/* Label & meta */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className={`text-sm ${isEnabled ? "text-gray-900" : "text-gray-400"}`}>{label}</span>
        {required && (
          <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
            Required
          </span>
        )}
        {locked && (
          <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-gray-400">
            <Lock className="h-3 w-3" /> Locked
          </span>
        )}
      </div>

      {/* Type chip */}
      <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
        {FIELD_TYPE_LABELS[type] ?? type}
      </span>
    </div>
  );
}
