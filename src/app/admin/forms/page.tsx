import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, FileText, Pencil, Eye, Copy, MoreHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import { CLASS_LEVEL_CONFIG } from "@/constants/classLevels";
import { formatDate } from "@/lib/utils";
import type { ClassLevel, FormTemplateStatus } from "@prisma/client";

const STATUS_STYLES: Record<FormTemplateStatus, string> = {
  DRAFT:     "bg-yellow-50 text-yellow-700 border border-yellow-200",
  PUBLISHED: "bg-green-50 text-green-700 border border-green-200",
  ARCHIVED:  "bg-gray-100 text-gray-500 border border-gray-200",
};

export default async function FormTemplatesPage() {
  const session = await auth();

  const templates = await db.formTemplate.findMany({
    where: {
      organizationId: session!.user.organizationId ?? "",
      ...(session!.user.branchId
        ? { OR: [{ branchId: session!.user.branchId }, { branchId: null }] }
        : {}),
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <div>
      <PageHeader
        title="Form Templates"
        description="Manage the admission application forms shown to applicants"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Form Templates" }]}
        actions={
          <Button asChild>
            <Link href="/admin/forms/builder">
              <Plus className="h-4 w-4 mr-1" />
              New Template
            </Link>
          </Button>
        }
      />

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <FileText className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">No form templates yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create a form template to define what information applicants must provide.
            </p>
            <Button asChild>
              <Link href="/admin/forms/builder">
                <Plus className="h-4 w-4 mr-1" />
                Create your first template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((tpl) => {
            type SubSection = { fields: unknown[] };
            type Section   = { id: string; title: string; fields?: unknown[]; subsections?: SubSection[] };
            const schema = tpl.schema as { sections?: Section[] };
            const sectionCount = schema?.sections?.length ?? 0;
            const fieldCount   = schema?.sections?.reduce((acc, s) => {
              const direct = s.fields?.length ?? 0;
              const nested = s.subsections?.reduce((n, sub) => n + (sub.fields?.length ?? 0), 0) ?? 0;
              return acc + direct + nested;
            }, 0) ?? 0;

            return (
              <Card key={tpl.id} className="flex flex-col">
                <CardContent className="flex flex-col gap-3 p-5 flex-1">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1B4332]/10">
                        <FileText className="h-4 w-4 text-[#1B4332]" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 text-sm leading-tight">{tpl.name}</p>
                        {tpl.isDefault && (
                          <span className="text-[10px] font-medium text-[#1B4332]">Default</span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[tpl.status]}`}>
                      {tpl.status}
                    </span>
                  </div>

                  {/* Description */}
                  {tpl.description && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{tpl.description}</p>
                  )}

                  {/* Meta chips */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      {tpl.classLevel ? CLASS_LEVEL_CONFIG[tpl.classLevel as ClassLevel].label : "All Classes"}
                    </span>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      {sectionCount} section{sectionCount !== 1 ? "s" : ""}
                    </span>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                    </span>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      v{tpl.version}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400 mt-auto">Updated {formatDate(tpl.updatedAt)}</p>

                  {/* Actions */}
                  <div className="flex gap-2 border-t border-gray-100 pt-3">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                      <Link href={`/admin/forms/builder?id=${tpl.id}`}>
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                      <Link href={`/admin/forms/${tpl.id}/preview`}>
                        <Eye className="h-3 w-3 mr-1" />
                        Preview
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
