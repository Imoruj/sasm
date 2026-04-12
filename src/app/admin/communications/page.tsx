import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Communications"
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Communications" }]}
      />
      <Card>
        <CardContent className="py-16 text-center text-gray-400">
          <p>Communications — coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
