import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Admission Cycles"
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Admission Cycles" }]}
      />
      <Card>
        <CardContent className="py-16 text-center text-gray-400">
          <p>Admission Cycles — coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
