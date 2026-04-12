import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Organisation Settings"
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin" }, { label: "Organisation Settings" }]}
      />
      <Card>
        <CardContent className="py-16 text-center text-gray-400">
          <p>Organisation Settings — coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
