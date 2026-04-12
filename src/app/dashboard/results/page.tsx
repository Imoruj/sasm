import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Results"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Results" }]}
      />
      <Card>
        <CardContent className="py-16 text-center text-gray-400">
          <p>Results — coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
