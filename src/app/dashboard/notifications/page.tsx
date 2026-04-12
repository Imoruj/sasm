import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import PageHeader from "@/components/shared/PageHeader";
import NotificationList, { type NotificationItem } from "./NotificationList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: session!.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.notification.count({
      where: { userId: session!.user.id, isRead: false },
    }),
  ]);

  // Serialise Dates to ISO strings for safe client-component hydration
  const serialised: NotificationItem[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    category: n.category,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
            : "You're all caught up"
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Notifications" },
        ]}
        actions={
          unreadCount > 0 ? (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 text-xs font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null
        }
      />

      <NotificationList
        initialNotifications={serialised}
        unreadCount={unreadCount}
      />
    </div>
  );
}
