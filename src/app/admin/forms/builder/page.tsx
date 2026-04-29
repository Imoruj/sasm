import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import PageHeader from "@/components/shared/PageHeader";
import FormBuilderClient from "./FormBuilderClient";

interface Props {
  searchParams: Promise<{ id?: string }>;
}

export default async function FormBuilderPage({ searchParams }: Props) {
  const session = await auth();
  const orgId = session!.user.organizationId ?? "";
  const { id } = await searchParams;

  const [templateRaw, branches] = await Promise.all([
    id ? db.formTemplate.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, name: true, description: true, classLevels: true, status: true, schema: true, branchId: true },
    }) : null,
    db.branch.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const schema        = (templateRaw?.schema ?? {}) as Record<string, unknown>;
  const enabledFields = Array.isArray(schema.enabledFields) ? (schema.enabledFields as string[]) : undefined;

  return (
    <div>
      <PageHeader
        title={id ? "Edit Form Template" : "New Form Template"}
        description="Toggle fields on or off to customise the admission form for your school"
        breadcrumbs={[
          { label: "Admin",          href: "/admin" },
          { label: "Form Templates", href: "/admin/forms" },
          { label: id ? "Edit" : "New Template" },
        ]}
      />

      <FormBuilderClient
        templateId={templateRaw?.id}
        initialName={templateRaw?.name ?? "Standard Admission Form"}
        initialDescription={templateRaw?.description ?? ""}
        initialClassLevels={templateRaw?.classLevels ?? []}
        initialStatus={templateRaw?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
        initialEnabledFields={enabledFields}
        initialBranchId={templateRaw?.branchId ?? null}
        branches={branches}
      />
    </div>
  );
}
