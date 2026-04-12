import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Reports"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Reports" }]}
      />
      <Card>
        <CardContent className="py-16 text-center text-gray-400">
          <p>Reports — coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
