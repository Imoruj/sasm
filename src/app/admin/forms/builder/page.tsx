import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import PageHeader from "@/components/shared/PageHeader";
import FormBuilderClient from "./FormBuilderClient";

interface Props {
  searchParams: Promise<{ id?: string }>;
}

export default async function FormBuilderPage({ searchParams }: Props) {
  const session = await auth();
  const { id } = await searchParams;

  // If editing an existing template, load it
  let template: {
    id:           string;
    name:         string;
    description:  string | null;
    classLevel:   string | null;
    status:       "DRAFT" | "PUBLISHED" | "ARCHIVED";
    schema:       unknown;
  } | null = null;

  if (id) {
    template = await db.formTemplate.findFirst({
      where: { id, organizationId: session!.user.organizationId ?? "" },
      select: { id: true, name: true, description: true, classLevel: true, status: true, schema: true },
    });
  }

  const schema        = (template?.schema ?? {}) as Record<string, unknown>;
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
        templateId={template?.id}
        initialName={template?.name ?? "Standard Admission Form"}
        initialDescription={template?.description ?? ""}
        initialClassLevel={template?.classLevel ?? null}
        initialStatus={template?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
        initialEnabledFields={enabledFields}
      />
    </div>
  );
}
